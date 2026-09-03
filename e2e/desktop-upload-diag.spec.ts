import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const APP_EXE = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked', 'InnSight Hotel Management.exe');
const APP_DIR = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked');
const DB_PATH = path.join(process.env.APPDATA || '', '@innsight', 'desktop', 'innsight.db');
const TEST_ID = path.resolve(__dirname, '..', 'test-results', 'test-id.png');

let electronApp: ElectronApplication;
let window: Page;
const collected = { stdout: '', stderr: '' };

function sl(ms: number) { return window.waitForTimeout(ms); }
async function waitForText(text: string, timeout = 15000) {
  try { await window.waitForFunction((t: string) => document.body.innerText.includes(t), text, { timeout }); return true; }
  catch { return false; }
}
async function fillInput(label: string, value: string) {
  try {
    const input = window.getByLabel(label, { exact: false });
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) { await input.fill(value); return true; }
  } catch {}
  return false;
}
async function clickButton(text: string | RegExp) {
  const btn = window.getByRole('button', { name: text });
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) { await btn.click(); return true; }
  return false;
}
async function selectByPartialText(label: string, optionContains: string) {
  const select = window.getByLabel(label, { exact: false });
  if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
    const v = await select.evaluate((el: HTMLSelectElement, text: string) => {
      for (const o of el.options) { if (o.text.includes(text)) return o.value; }
      return '';
    }, optionContains);
    if (v) { await select.selectOption(v); return true; }
  }
  return false;
}
async function nav(pathname: string) {
  const origin = new URL(window.url()).origin;
  await window.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sl(2000);
}
function fmtDate(d: Date): string { return d.toISOString().split('T')[0]; }

test.describe('Diagnose upload', () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);
    fs.mkdirSync(path.dirname(TEST_ID), { recursive: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(TEST_ID, png);

    try { require('child_process').execSync('taskkill /f /im "InnSight Hotel Management.exe" 2>nul', { stdio: 'ignore' }); } catch {}
    await new Promise(r => setTimeout(r, 2000));
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
    }

    electronApp = await electron.launch({ executablePath: APP_EXE, args: [], cwd: APP_DIR, timeout: 60000 });
    const proc = electronApp.process();
    proc.stdout?.on('data', (d: Buffer) => { collected.stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { collected.stderr += d.toString(); });
    window = await electronApp.firstWindow({ timeout: 60000 });
    await window.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    window.on('pageerror', (err) => console.log('PAGE_ERROR:', err.message));
    window.on('console', (msg) => console.log('CONSOLE_' + msg.type() + ':', msg.text()));
    await sl(3000);

    const welcome = await waitForText('Welcome', 10000);
    expect(welcome).toBeTruthy();
    await fillInput('Hotel Name', 'Grand Pacific Hotel');
    await fillInput('Phone', '+1-555-0100');
    const t = window.locator('textarea');
    if (await t.isVisible({ timeout: 2000 }).catch(() => false)) await t.fill('100 Ocean Blvd');
    const c = window.getByRole('button', { name: /Create/i });
    if (await c.isVisible({ timeout: 3000 }).catch(() => false)) { await c.click(); await sl(3000); }
    expect(await waitForText('Dashboard', 15000) || await waitForText('Occupancy', 8000)).toBeTruthy();

    await nav('/dashboard/guests/new');
    await sl(1000);
    await fillInput('First Name', 'Sarah');
    await fillInput('Last Name', 'Johnson');
    await fillInput('Email', 'sarah.j@example.com');
    await clickButton('Create Guest');
    await sl(2500);
    expect(await waitForText('Sarah', 8000)).toBeTruthy();
  });

  test('Upload diagnosis', async () => {
    test.setTimeout(120000);
    const guestInfo = await window.evaluate(async () => {
      const token = localStorage.getItem('innsight_access_token');
      const resp = await fetch('/api/v1/guests?page=1&limit=10', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await resp.json();
      const list = json.success && json.data ? json.data : [];
      return list[0] ? { id: list[0].id } : null;
    });
    expect(guestInfo).toBeTruthy();

    // 1) Upload via direct fetch from page (same as hook)
    const directResult = await window.evaluate(async ({ guestId, fileData, fileName }) => {
      const token = localStorage.getItem('innsight_access_token');
      const fd = new FormData();
      fd.append('idProofFront', new File([new Uint8Array(fileData)], fileName, { type: 'image/png' }));
      const resp = await fetch(`/api/v1/guests/${guestId}/id-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const text = await resp.text();
      return { status: resp.status, text: text.substring(0, 500) };
    }, { guestId: guestInfo.id, fileData: Array.from(fs.readFileSync(TEST_ID)), fileName: 'test-id.png' });
    console.log('DIRECT UPLOAD:', JSON.stringify(directResult));

    // 2) Check where files got written on disk
    const filesOnDisk = require('child_process').execSync('powershell -Command "Get-ChildItem -Path $env:APPDATA\\@innsight\\desktop, C:\\Users\\surya\\Downloads\\first-demo\\apps\\desktop\\dist, C:\\Users\\surya\\Downloads\\first-demo\\apps\\desktop\\release\\win-unpacked\\resources -Recurse -Filter proof-* -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName"').toString();
    console.log('FILES ON DISK:', filesOnDisk);

    // 4) Dump recent electron stdout/stderr for the error trace
    const outTail = collected.stdout;
    const errTail = collected.stderr;
    console.log('ELECTRON STDOUT TAIL:', outTail.substring(outTail.length - 3000));
    console.log('ELECTRON STDERR TAIL:', errTail.substring(errTail.length - 3000));
  });

  test.afterAll(async () => {
    if (electronApp) await electronApp.close().catch(() => {});
  });
});
