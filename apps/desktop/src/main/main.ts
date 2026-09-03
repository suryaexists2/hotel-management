import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { execSync, fork } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let apiServer: any = null;
let nextjsProcess: any = null;

// ---------------------------------------------------------------------------
// Instrumentation helpers
// ---------------------------------------------------------------------------
const T0 = Date.now();
function log(step: string, status: 'START' | 'END' | 'SUCCESS' | 'FAILURE' | 'INFO', detail?: string) {
  const elapsed = ((Date.now() - T0) / 1000).toFixed(1);
  const msg = `[${elapsed}s] [${status}] ${step}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
}

// Track pending timeouts so we can clear them on success
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

function startTimeout(ms: number, label: string) {
  const t = setTimeout(() => {
    const elapsed = ((Date.now() - T0) / 1000).toFixed(1);
    console.error(`[${elapsed}s] [TIMEOUT] ${label} exceeded ${ms}ms`);
    console.error(new Error(`Timeout stack for: ${label}`).stack);
    log('APP', 'FAILURE', `Timed out at: ${label}`);
    // Emergency exit so we don't hang forever
    app.quit();
    process.exit(1);
  }, ms);
  pendingTimeouts.push(t);
  return t;
}

function clearTimeouts() {
  while (pendingTimeouts.length) {
    clearTimeout(pendingTimeouts.pop()!);
  }
}

// ---------------------------------------------------------------------------
// Original helpers (unchanged logic, just instrumented)
// ---------------------------------------------------------------------------

function getDbPath(): string {
  const p = path.join(app.getPath('userData'), 'innsight.db');
  log('getDbPath', 'INFO', p);
  return p;
}

function getProjectRoot(): string {
  if (app.isPackaged) {
    const r = process.resourcesPath;
    log('getProjectRoot', 'INFO', `packaged, resourcesPath=${r}`);
    return r;
  }
  const r = path.join(__dirname, '..', '..', '..', '..');
  log('getProjectRoot', 'INFO', `dev, root=${r}`);
  return r;
}

function findFreePort(): Promise<number> {
  log('findFreePort', 'START');
  const timeout = startTimeout(10000, 'findFreePort');
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => {
        clearTimeout(timeout);
        log('findFreePort', 'SUCCESS', `port=${port}`);
        resolve(port);
      });
    });
    s.on('error', (err) => {
      clearTimeout(timeout);
      log('findFreePort', 'FAILURE', err.message);
      reject(err);
    });
  });
}

async function initializeDatabase(): Promise<void> {
  log('initializeDatabase', 'START');
  const timeout = startTimeout(30000, 'initializeDatabase');
  try {
    const dbPath = getDbPath();
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      log('initializeDatabase', 'INFO', 'creating db dir');
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) {
      log('initializeDatabase', 'SUCCESS', 'db already exists');
      clearTimeout(timeout);
      return;
    }

    log('initializeDatabase', 'INFO', 'no db found, initializing');
    const root = getProjectRoot();
    const bundledDbCandidates = [
      path.join(root, 'prisma', 'template.db'),
      path.join(__dirname, 'template.db'),
      path.join(__dirname, '..', '..', '..', 'prisma', 'template.db'),
    ];
    const bundledDb = bundledDbCandidates.find((p) => fs.existsSync(p));
    if (bundledDb) {
      fs.copyFileSync(bundledDb, dbPath);
      log('initializeDatabase', 'SUCCESS', 'created from template');
      clearTimeout(timeout);
      return;
    }
    log('initializeDatabase', 'INFO', 'no template, running prisma db push');

    const schemaCandidates = [
      path.join(root, 'prisma', 'schema.prisma'),
      path.join(__dirname, '..', '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma'),
    ];
    let schemaPath = schemaCandidates.find((p) => fs.existsSync(p));
    if (!schemaPath) {
      log('initializeDatabase', 'FAILURE', 'prisma schema not found');
      throw new Error('Prisma schema not found');
    }
    log('initializeDatabase', 'INFO', `schema at ${schemaPath}`);
    const env = { ...process.env, DATABASE_URL: `file:${dbPath}` };
    log('initializeDatabase', 'INFO', 'running npx prisma db push...');
    execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, { env, stdio: 'pipe', timeout: 60000 });
    log('initializeDatabase', 'SUCCESS', 'schema created');
    clearTimeout(timeout);
  } catch (err: any) {
    clearTimeout(timeout);
    log('initializeDatabase', 'FAILURE', err.message);
    throw err;
  }
}

async function startApiServer(port: number, nextPort: number): Promise<void> {
  log('startApiServer', 'START', `apiPort=${port}, nextPort=${nextPort}`);
  const timeout = startTimeout(30000, 'startApiServer');
  try {
    const bundlePath = path.join(__dirname, 'api-bundle.cjs');
    log('startApiServer', 'INFO', `bundlePath=${bundlePath}, exists=${fs.existsSync(bundlePath)}`);

    if (!fs.existsSync(bundlePath)) {
      log('startApiServer', 'FAILURE', 'api-bundle.cjs not found');
      throw new Error(`api-bundle.cjs not found at ${bundlePath}`);
    }

    process.env.DATABASE_URL = `file:${getDbPath()}`;
    process.env.ELECTRON_RUN = 'true';
    process.env.ELECTRON_ROOT = getProjectRoot();
    process.env.NODE_ENV = 'production';
    process.env.PORT = String(port);
    process.env.JWT_SECRET = 'innsight-desktop-secure-jwt-secret-min-32-chars';
    process.env.JWT_REFRESH_SECRET = 'innsight-desktop-refresh-secret-min-32-chars';
    process.env.CORS_ORIGIN = `http://localhost:${nextPort}`;
    process.env.NEXTJS_PORT = String(nextPort);
    process.env.NEXT_PUBLIC_API_URL = `http://localhost:${port}/api/v1`;
    process.env.LOG_LEVEL = 'error';
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
    process.env.SMTP_HOST = '';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    process.env.SMTP_FROM = 'noreply@innsight.io';
    process.env.UPLOADS_DIR = path.join(app.getPath('userData'), 'uploads');
    try {
      fs.mkdirSync(path.join(process.env.UPLOADS_DIR, 'id-proofs'), { recursive: true });
      log('startApiServer', 'INFO', `uploads dir ready at ${process.env.UPLOADS_DIR}`);
    } catch (err: any) {
      log('startApiServer', 'FAILURE', `could not create uploads dir: ${err.message}`);
    }
    delete process.env.REDIS_URL;

    log('startApiServer', 'INFO', 'require bundle...');
    const tBefore = Date.now();
    const appModule = require(bundlePath);
    log('startApiServer', 'SUCCESS', `require completed in ${Date.now() - tBefore}ms`);

    return new Promise((resolve, reject) => {
      log('startApiServer', 'INFO', 'calling app.listen()...');
      apiServer = appModule.default.listen(port, '127.0.0.1', () => {
        clearTimeout(timeout);
        log('startApiServer', 'SUCCESS', `listening on 127.0.0.1:${port}`);
        resolve();
      });
      apiServer.on('error', (err: Error) => {
        clearTimeout(timeout);
        log('startApiServer', 'FAILURE', `listen error: ${err.message}`);
        reject(err);
      });
    });
  } catch (err: any) {
    clearTimeout(timeout);
    log('startApiServer', 'FAILURE', err.message);
    throw err;
  }
}

async function startNextjsServer(port: number, apiPort: number): Promise<number | null> {
  log('startNextjsServer', 'START', `nextPort=${port}, apiPort=${apiPort}`);
  const timeout = startTimeout(20000, 'startNextjsServer');
  try {
    const root = getProjectRoot();
    const serverScript = path.join(root, 'apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js');
    log('startNextjsServer', 'INFO', `serverScript=${serverScript}, exists=${fs.existsSync(serverScript)}`);

    if (!fs.existsSync(serverScript)) {
      log('startNextjsServer', 'FAILURE', 'Next.js standalone server not found');
      clearTimeout(timeout);
      return null;
    }

    return new Promise((resolve, reject) => {
      const env: any = { ...process.env };
      env.PORT = String(port);
      env.HOSTNAME = '127.0.0.1';
      env.NEXT_PUBLIC_API_URL = `http://localhost:${apiPort}/api/v1`;
      env.API_UPSTREAM_URL = `http://127.0.0.1:${apiPort}`;

      log('startNextjsServer', 'INFO', `forking ${serverScript}`);
      nextjsProcess = fork(serverScript, [], {
        env,
        stdio: 'pipe',
        cwd: path.dirname(serverScript),
      });

      let started = false;
      const timeout2 = startTimeout(15000, 'startNextjsServer — waiting for ready message');

      nextjsProcess.stdout.on('data', (data: Buffer) => {
        const msg = data.toString();
        console.log('[Next.js]', msg.trim());
        if (!started && (msg.includes('started') || msg.includes('listening') || msg.includes('Ready'))) {
          started = true;
          clearTimeout(timeout);
          clearTimeout(timeout2);
          log('startNextjsServer', 'SUCCESS', `Next.js ready on port ${port}`);
          resolve(port);
        }
      });
      nextjsProcess.stderr.on('data', (data: Buffer) => {
        const msg = data.toString();
        console.error('[Next.js]', msg.trim());
        if (!started && (msg.includes('started') || msg.includes('listening') || msg.includes('Ready'))) {
          started = true;
          clearTimeout(timeout);
          clearTimeout(timeout2);
          log('startNextjsServer', 'SUCCESS', `Next.js ready (stderr) on port ${port}`);
          resolve(port);
        }
      });
      nextjsProcess.on('error', (err: Error) => {
        clearTimeout(timeout);
        clearTimeout(timeout2);
        if (!started) {
          log('startNextjsServer', 'FAILURE', `fork error: ${err.message}`);
          reject(err);
        }
      });
      nextjsProcess.on('exit', (code: number) => {
        log('startNextjsServer', 'INFO', `exited with code ${code}`);
        if (!started) {
          clearTimeout(timeout);
          clearTimeout(timeout2);
          log('startNextjsServer', 'FAILURE', `exited with code ${code}`);
          reject(new Error(`Next.js exited with code ${code}`));
        }
      });
    });
  } catch (err: any) {
    clearTimeout(timeout);
    log('startNextjsServer', 'FAILURE', err.message);
    throw err;
  }
}

function createWindow(url: string): void {
  log('createWindow', 'START', `url=${url}`);
  const timeout = startTimeout(30000, 'createWindow');

  try {
    log('createWindow', 'INFO', 'new BrowserWindow...');
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: 'InnSight Hotel Management',
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.svg'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      show: false,
      backgroundColor: '#0a0a0a',
    });
    log('createWindow', 'SUCCESS', 'BrowserWindow created');

    log('createWindow', 'INFO', 'registering ready-to-show handler');
    mainWindow.once('ready-to-show', () => {
      clearTimeout(timeout);
      log('createWindow', 'SUCCESS', 'ready-to-show fired, showing window');
      mainWindow?.show();
    });

    mainWindow.on('closed', () => {
      log('createWindow', 'INFO', 'window closed');
      mainWindow = null;
    });

    log('createWindow', 'INFO', 'registering did-fail-load handler');
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      log('createWindow', 'FAILURE', `did-fail-load url=${validatedURL} error=${errorDescription} (${errorCode})`);
      console.error(`[Renderer] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    });

    log('createWindow', 'INFO', 'registering did-finish-load handler');
    mainWindow.webContents.on('did-finish-load', () => {
      log('createWindow', 'SUCCESS', `did-finish-load for ${mainWindow?.webContents?.getURL()}`);
    });

    log('createWindow', 'INFO', 'calling loadURL...');
    mainWindow.loadURL(url)
      .then(() => {
        log('createWindow', 'SUCCESS', 'loadURL promise resolved');
      })
      .catch((err) => {
        log('createWindow', 'FAILURE', `loadURL rejected: ${err.message}`);
        clearTimeout(timeout);
      });

    log('createWindow', 'END', 'createWindow completed (async load in progress)');
  } catch (err: any) {
    clearTimeout(timeout);
    log('createWindow', 'FAILURE', `constructor error: ${err.message}`);
    throw err;
  }
}

function setupIpcHandlers(): void {
  log('setupIpcHandlers', 'START');
  ipcMain.handle('get-db-path', () => getDbPath());

  ipcMain.handle('backup-database', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Backup Database',
      defaultPath: `innsight-backup-${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, message: 'Backup cancelled' };
    try {
      fs.copyFileSync(getDbPath(), result.filePath);
      return { success: true, message: `Backup saved to ${result.filePath}` };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle('print-to-pdf', async (_event, options: Record<string, any>) => {
    if (!mainWindow) throw new Error('No window');
    const pdfOptions: any = {
      pageSize: options?.pageSize ?? 'A4',
      printBackground: options?.printBackground ?? true,
    };
    if (options?.marginsType !== undefined) {
      pdfOptions.margins = { marginType: options.marginsType };
    }
    const pdf = await mainWindow.webContents.printToPDF(pdfOptions);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PDF',
      defaultPath: `invoice-${new Date().toISOString().split('T')[0]}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, message: 'Save cancelled' };
    await fs.promises.writeFile(result.filePath, pdf);
    return { success: true, path: result.filePath };
  });

  ipcMain.handle('restore-database', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Restore Database',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { success: false, message: 'Restore cancelled' };
    try {
      fs.copyFileSync(result.filePaths[0], getDbPath());
      return { success: true, message: 'Database restored' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  });
  log('setupIpcHandlers', 'SUCCESS');
}

// ---------------------------------------------------------------------------
// Main startup
// ---------------------------------------------------------------------------
const startTimeout_ = startTimeout(120000, 'app.whenReady — total startup');

app.whenReady().then(async () => {
  log('app.whenReady', 'SUCCESS', 'Electron app ready');
  clearTimeout(startTimeout_);

  const stepTimeout = startTimeout(110000, 'total startup sequence');

  try {
    log('STARTUP', 'INFO', '=== Beginning startup sequence ===');

    // Step 1: IPC handlers
    log('STARTUP', 'INFO', 'Step 1/6: setupIpcHandlers');
    const t1 = Date.now();
    setupIpcHandlers();
    log('STARTUP', 'SUCCESS', `Step 1/6 done in ${Date.now() - t1}ms`);

    // Step 2: Initialize database
    log('STARTUP', 'INFO', 'Step 2/6: initializeDatabase');
    const t2 = Date.now();
    await initializeDatabase();
    log('STARTUP', 'SUCCESS', `Step 2/6 done in ${Date.now() - t2}ms`);

    // Step 3: Find API port
    log('STARTUP', 'INFO', 'Step 3/6: findFreePort (API)');
    const t3 = Date.now();
    const apiPort = await findFreePort();
    log('STARTUP', 'SUCCESS', `Step 3/6 done in ${Date.now() - t3}ms — API port=${apiPort}`);

    // Step 4: Find Next.js port
    log('STARTUP', 'INFO', 'Step 4/6: findFreePort (Next.js)');
    const t4 = Date.now();
    const nextPort = await findFreePort();
    log('STARTUP', 'SUCCESS', `Step 4/6 done in ${Date.now() - t4}ms — Next port=${nextPort}`);

    // Step 5: Start API server
    log('STARTUP', 'INFO', 'Step 5/6: startApiServer');
    const t5 = Date.now();
    await startApiServer(apiPort, nextPort);
    log('STARTUP', 'SUCCESS', `Step 5/6 done in ${Date.now() - t5}ms`);

    // Step 6: Start Next.js (if available) — used for SSR, not for window URL
    log('STARTUP', 'INFO', 'Step 6/6: startNextjsServer');
    const t6 = Date.now();
    let activeNextPort: number | null = null;
    try {
      activeNextPort = await startNextjsServer(nextPort, apiPort);
      if (activeNextPort !== null) {
        log('STARTUP', 'SUCCESS', `Next.js active on port ${activeNextPort}`);
      } else {
        log('STARTUP', 'INFO', 'Next.js not available');
        // Clear NEXTJS_PORT so the API server proxy falls back to SPA immediately
        // instead of waiting for a 3-second timeout on a dead port.
        delete process.env.NEXTJS_PORT;
      }
    } catch (e: any) {
      log('STARTUP', 'INFO', `Next.js error: ${e.message}`);
      delete process.env.NEXTJS_PORT;
    }
    log('STARTUP', 'SUCCESS', `Step 6/6 done in ${Date.now() - t6}ms`);

    // Create window — always point to API server which serves frontend AND handles API
    const windowUrl = `http://localhost:${apiPort}`;
    log('STARTUP', 'INFO', `Creating window with URL: ${windowUrl}`);
    createWindow(windowUrl);

    // Check that the API is actually listening
    log('STARTUP', 'INFO', 'Verifying API server is listening...');
    const http = require('http') as typeof import('http');
    const checkReq = http.get(`http://127.0.0.1:${apiPort}/health`, (res) => {
      let data = '';
      res.on('data', (c: string) => data += c);
      res.on('end', () => {
        log('STARTUP', 'SUCCESS', `API health check: ${res.statusCode} — ${data.substring(0, 100)}`);
      });
    });
    checkReq.on('error', (err: Error) => {
      log('STARTUP', 'FAILURE', `API health check failed: ${err.message}`);
    });

    log('STARTUP', 'SUCCESS', '=== Startup sequence complete ===');
    clearTimeout(stepTimeout);
  } catch (error: any) {
    clearTimeout(stepTimeout);
    log('STARTUP', 'FAILURE', error.message);
    console.error('Startup error:', error);
    dialog.showErrorBox('Startup Error', String(error));
    app.quit();
  }
});

// ---------------------------------------------------------------------------
// Global error handlers
// ---------------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  log('UNHANDLED_REJECTION', 'FAILURE', String(reason));
  console.error('💥 Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  log('UNCAUGHT_EXCEPTION', 'FAILURE', err.message);
  console.error('💥 Uncaught exception:', err);
});

app.on('before-quit', () => {
  log('app.before-quit', 'INFO');
  if (apiServer) apiServer.close();
  if (nextjsProcess) nextjsProcess.kill();
});

app.on('window-all-closed', () => {
  log('app.window-all-closed', 'INFO');
  if (apiServer) apiServer.close();
  if (nextjsProcess) nextjsProcess.kill();
  app.quit();
});
