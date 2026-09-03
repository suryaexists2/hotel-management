import express, { Express, type NextFunction, type Request, type Response } from 'express';
import http from 'node:http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import * as fs from 'node:fs';
import { prisma } from '@innsight/database';
import { env, corsOrigins } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './shared/errors/app-error.js';
import { apiV1Router } from './routes/index.js';
import { uploadsDir } from './shared/uploads/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();

if (env.TRUST_PROXY > 0) {
  app.set('trust proxy', env.TRUST_PROXY);
}

if (env.NODE_ENV !== 'production' || !process.env.ELECTRON_RUN) {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
      credentials: true,
    }),
  );
}

app.use('/uploads', express.static(uploadsDir));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(requestLogger);

app.use(
  '/api/v1',
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    error: null,
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ success: true, data: { status: 'READY' }, error: null });
  } catch {
    res.status(503).json({
      success: false,
      data: null,
      error: { code: 'NOT_READY', message: 'Database is not reachable' },
    });
  }
});

app.get('/api/v1', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'InnSight API',
      version: '1.0.0',
      status: 'operational',
    },
    error: null,
  });
});

app.use('/api/v1', apiV1Router);

// Serve Next.js frontend in Electron mode
if (process.env.ELECTRON_RUN === 'true') {
  const root = process.env.ELECTRON_ROOT || path.resolve(__dirname, '..', '..');

  const nextDir = path.resolve(root, 'apps', 'web', '.next');
  const serverAppDir = path.join(nextDir, 'standalone', 'apps', 'web', '.next', 'server', 'app');

  // Serve Next.js static assets (at .next root level)
  const staticDir = path.join(nextDir, 'static');
  if (fs.existsSync(staticDir)) {
    app.use('/_next/static', express.static(staticDir, { maxAge: '1y', immutable: true }));
  }

  // Serve favicon and other root assets
  const publicDir = path.resolve(root, 'apps', 'web', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Serve Next.js pre-rendered pages and RSC payloads for client-side navigation
  if (fs.existsSync(serverAppDir)) {
    // Helper: map a request path to a file in the server/app directory
    const findFile = (reqPath: string, ext: string, walkUp: boolean): string | null => {
      const clean = reqPath.replace(/\/$/, '') || '/';
      // Try exact match (e.g., /dashboard => dashboard.html)
      const exact = path.join(serverAppDir, clean.slice(1) + ext);
      if (fs.existsSync(exact)) return exact;
      // Try index file in subdirectory (e.g., /dashboard/reservations => reservations/index.html)
      const indexFile = path.join(serverAppDir, clean.slice(1), 'index' + ext);
      if (fs.existsSync(indexFile)) return indexFile;
      if (walkUp) {
        // Walk up path segments for RSC data (e.g., /dashboard/reservations/{id} => dashboard.rsc)
        const segments = clean.split('/').filter(Boolean);
        for (let i = segments.length - 1; i > 0; i--) {
          const ancestor = segments.slice(0, i);
          const ancestorFile = path.join(serverAppDir, ...ancestor) + ext;
          if (fs.existsSync(ancestorFile)) return ancestorFile;
        }
      }
      return null;
    };

    // Helper: detect if request is for RSC data (client-side navigation)
    const isRscRequest = (req: Request): boolean =>
      req.headers['rsc'] === '1' || req.headers['accept'] === 'text/x-component' || req.headers['next-router-state-tree'] !== undefined;

    // Helper: find the best SPA shell for a given path.
    // Always use index.html — it has generic RSC data (canonical path ["",""]) that
    // works for any route. Using dashboard.html for dashboard sub-paths would serve
    // RSC data pinned to the /dashboard route, causing the client-side router to
    // render the Dashboard instead of the correct dynamic page on hydration.
    const spaShellPage = (_reqPath: string): string | null => {
      return path.join(serverAppDir, 'index.html');
    };

    // Helper: SPA fallback
    const sendSpaFallback = (reqPath: string, r: Response) => {
      const sf = spaShellPage(reqPath);
      if (sf && fs.existsSync(sf)) {
        r.setHeader('Content-Type', 'text/html; charset=utf-8');
        r.sendFile(sf);
      } else {
        r.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Page not found' } });
      }
    };

    // Helper: proxy to Next.js SSR for dynamic routes
    const proxyToNext = (reqPath: string, r: Request, rs: Response) => {
      const nextPort = process.env.NEXTJS_PORT;
      if (!nextPort) { sendSpaFallback(reqPath, rs); return; }
      try {
        const proxyReq = http.get(`http://127.0.0.1:${nextPort}${r.url}`, {
          headers: {
            ...r.headers,
            host: `127.0.0.1:${nextPort}`,
            'accept-encoding': 'identity',
          },
          timeout: 3000,
        }, (proxyRes) => {
          if (!proxyRes.statusCode || proxyRes.statusCode >= 500) {
            sendSpaFallback(reqPath, rs);
            return;
          }
          // Forward headers
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(proxyRes.headers)) {
            if (typeof v === 'string') headers[k] = v;
          }
          rs.writeHead(proxyRes.statusCode, headers);
          proxyRes.pipe(rs);
        });
        proxyReq.on('error', () => sendSpaFallback(reqPath, rs));
        proxyReq.on('timeout', () => { proxyReq.destroy(); sendSpaFallback(reqPath, rs); });
      } catch {
        sendSpaFallback(reqPath, rs);
      }
    };

    // Serve all non-API page requests
    app.get(/^\/(?!api\/|_next\/)(.*)$/, (req: Request, res: Response) => {
      const isRsc = isRscRequest(req);
      // RSC data: try exact/index match only (no walk-up — the walk-up would return
      // the wrong page's flight data for dynamic routes like /dashboard/reservations/:id).
      // Unmatched dynamic routes fall through to the Next.js SSR proxy below.
      if (isRsc) {
        const rscFile = findFile(req.path, '.rsc', false);
        if (rscFile) {
          res.setHeader('Content-Type', 'text/x-component');
          return res.sendFile(rscFile);
        }
      }
      // HTML: try exact/index match first (no walk-up — avoid serving wrong sibling page)
      const htmlFile = findFile(req.path, '.html', false);
      if (htmlFile) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.sendFile(htmlFile);
      }
      // Dynamic route: proxy to Next.js SSR (which can generate dynamic RSC/flight data)
      proxyToNext(req.path, req, res);
    });
  } else {
    app.use((_req, _res, _next) => {
      _res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Page not found' } });
    });
  }
} else {
  // Non-Electron mode: serve static export if available
  const webOutPath = path.resolve(__dirname, '../../web/out');
  if (fs.existsSync(webOutPath)) {
    app.use(express.static(webOutPath));
    app.get('*', (_req: Request, res: Response, _next: NextFunction) => {
      const htmlPath = path.join(webOutPath, 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
      } else {
        res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Page not found' } });
      }
    });
  } else {
    app.use((_req, _res, next) => {
      next(new NotFoundError('The requested API route does not exist'));
    });
  }
}

app.use(errorHandler);

export default app;
