import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const APP_EXE = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked', 'InnSight Hotel Management.exe');
const APP_DIR = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-results', 'repro');
const DB_PATH = path.join(process.env.APPDATA || '', '@innsight', 'desktop', 'innsight.db');
const PDF_OUT = path.resolve(__dirname, '..', 'test-results', 'invoice-output.pdf');

let electronApp: ElectronApplication;
let window: Page;

function sl(ms: number) { return window.waitForTimeout(ms); }

async function ss(name: string) {
  try { await window.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) }); } catch {}
}

async function waitForText(text: string, timeout = 15000) {
  try {
    await window.waitForFunction((t: string) => document.body.innerText.includes(t), text, { timeout });
    return true;
  } catch { return false; }
}

async function clickButton(text: string | RegExp) {
  const btn = window.getByRole('button', { name: text });
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) { await btn.click(); return true; }
  return false;
}

async function fillInput(label: string, value: string) {
  try {
    const input = window.getByLabel(label, { exact: false });
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) { await input.fill(value); return true; }
  } catch {}
  const byName = window.locator(`input[name="${label}"]`);
  if (await byName.isVisible({ timeout: 1000 }).catch(() => false)) { await byName.fill(value); return true; }
  return false;
}

async function selectByPartialText(label: string, optionContains: string) {
  try {
    const select = window.getByLabel(label, { exact: false });
    if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
      const optValue = await select.evaluate((el: HTMLSelectElement, text: string) => {
        for (const opt of el.options) { if (opt.text.includes(text)) return opt.value; }
        return '';
      }, optionContains);
      if (optValue) { await select.selectOption(optValue); return true; }
    }
  } catch {}
  return false;
}

async function nav(pathname: string) {
  const origin = new URL(window.url()).origin;
  await window.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sl(2000);
}

async function waitForLoadingDone() {
  await window.waitForFunction(() => {
    const loading = document.body.innerText.includes('Loading...');
    const spinners = document.querySelectorAll('[class*="spinner"], [class*="Spinner"], [role="status"]');
    return !loading && spinners.length === 0;
  }, { timeout: 15000 }).catch(() => {});
  await sl(500);
}

function fmtDate(d: Date): string { return d.toISOString().split('T')[0]; }

test.describe('Invoice PDF generation', () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    try { require('child_process').execSync('taskkill /f /im "InnSight Hotel Management.exe" 2>nul', { stdio: 'ignore' }); } catch {}
    await new Promise(r => setTimeout(r, 2000));
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
    }

    electronApp = await electron.launch({ executablePath: APP_EXE, args: [], cwd: APP_DIR, timeout: 60000 });
    window = await electronApp.firstWindow({ timeout: 60000 });
    await window.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    window.on('pageerror', (err) => console.log('PAGE_ERROR:', err.message));
    window.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text());
    });
    await sl(3000);

    console.log('--- SETUP ---');
    const welcome = await waitForText('Welcome', 10000);
    expect(welcome).toBeTruthy();
    await fillInput('Hotel Name', 'Grand Pacific Hotel');
    await fillInput('Phone', '+1-555-0100');
    const textareas = window.locator('textarea');
    if (await textareas.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textareas.fill('100 Ocean Boulevard, Santa Monica, CA 90401');
    }
    const createBtn = window.getByRole('button', { name: /Create/i });
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await createBtn.click(); await sl(3000); }
    const setupDone = await waitForText('Dashboard', 15000) || await waitForText('Occupancy', 8000);
    expect(setupDone).toBeTruthy();
    console.log('Setup done');

    console.log('--- ROOM TYPE ---');
    await nav('/dashboard/room-types/new');
    await waitForLoadingDone();
    await fillInput('Name', 'Standard King');
    await fillInput('Base Rate', '250');
    await fillInput('Max Occupancy', '2');
    await fillInput('Max Adults', '2');
    await fillInput('Max Children', '1');
    await fillInput('Amenities', 'WiFi, TV, AC');
    await clickButton('Create Room Type');
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('Standard King', 8000)).toBeTruthy();

    console.log('--- ROOM ---');
    await nav('/dashboard/rooms/new');
    await waitForLoadingDone();
    await fillInput('Room Number', '101');
    await fillInput('Floor', '1');
    await selectByPartialText('Room Type', 'Standard King');
    await clickButton('Create Room');
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('101', 8000)).toBeTruthy();

    console.log('--- GUEST ---');
    await nav('/dashboard/guests/new');
    await waitForLoadingDone();
    await fillInput('First Name', 'Sarah');
    await fillInput('Last Name', 'Johnson');
    await fillInput('Email', 'sarah.j@example.com');
    await fillInput('Phone', '+1-555-1001');
    await clickButton('Create Guest');
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('Sarah', 8000)).toBeTruthy();
  });

  test('Invoice flow + PDF export is valid', async () => {
    test.setTimeout(600000);

    console.log('--- RESERVATION ---');
    await nav('/dashboard/reservations/new');
    await waitForLoadingDone();
    await selectByPartialText('Guest', 'Sarah');
    await selectByPartialText('Room Type', 'Standard King');
    const checkIn = new Date(); checkIn.setDate(checkIn.getDate() - 1);
    const checkOut = new Date(); checkOut.setDate(checkOut.getDate() + 1);
    await fillInput('Check-in Date', fmtDate(checkIn));
    await fillInput('Check-out Date', fmtDate(checkOut));
    await fillInput('Adults', '2');
    await clickButton('Create Reservation');
    await sl(4000);
    await waitForLoadingDone();
    expect(await waitForText('CONFIRMED', 10000)).toBeTruthy();

    const resInfo = await window.evaluate(async () => {
      const token = localStorage.getItem('innsight_access_token');
      const resp = await fetch('/api/v1/reservations?page=1&limit=10', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await resp.json();
      const list = json.success && json.data ? json.data : [];
      return list[0] ? { id: list[0].id } : null;
    });
    expect(resInfo).toBeTruthy();
    const reservationId = resInfo.id;

    console.log('--- OCCUPANTS ---');
    await nav(`/dashboard/reservations/${reservationId}`);
    await waitForLoadingDone();
    await clickButton(/Add/);
    await sl(1500);
    await waitForText('Add Occupant', 3000);
    await fillInput('First Name', 'Anjali');
    await fillInput('Last Name', 'Sharma');
    await selectByPartialText('Gender', 'Female');
    await fillInput('Phone', '+1-555-2001');
    await fillInput('Relationship', 'Spouse');
    await window.locator('form button[type="submit"]').last().click();
    await sl(3000);
    expect(await waitForText('Anjali', 5000)).toBeTruthy();

    console.log('--- CHECK-IN ---');
    const checkInBtn = window.getByRole('button', { name: 'Check In' });
    expect(await checkInBtn.isVisible({ timeout: 15000 }).catch(() => false)).toBeTruthy();
    await checkInBtn.click();
    await sl(1500);
    const roomSelect = window.getByLabel('Room', { exact: false });
    if (await roomSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const v = await roomSelect.evaluate((el: HTMLSelectElement) => {
        for (const o of el.options) { if (o.text.includes('101')) return o.value; }
        return '';
      });
      if (v) await roomSelect.selectOption(v);
    }
    await clickButton('Confirm Check-In');
    await sl(4000);
    await waitForLoadingDone();
    expect(await waitForText('CHECKED IN', 10000)).toBeTruthy();

    console.log('--- CHARGES ---');
    await nav(`/dashboard/billing/${reservationId}`);
    await waitForLoadingDone();
    expect(await waitForText('Total Charges', 10000)).toBeTruthy();
    await window.getByRole('button', { name: /Add Charge/ }).first().click();
    await sl(1500);
    await waitForText('Add Charge', 3000);
    await selectByPartialText('Category', 'Restaurant');
    await fillInput('Description', 'Dinner - Table 4');
    await fillInput('Unit Price', '45.50');
    await window.locator('form button[type="submit"]').last().click();
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('Dinner', 5000)).toBeTruthy();

    console.log('--- SETTLE ---');
    const balanceInfo = await window.evaluate(async () => {
      const token = localStorage.getItem('innsight_access_token');
      const resId = window.location.pathname.split('/').pop();
      const resp = await fetch(`/api/v1/billing/reservations/${resId}/folio`, { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await resp.json();
      if (!json.success) return { error: 'folio api failed' };
      return { balance: json.data.balance, folioId: json.data.id };
    });
    console.log('Balance:', JSON.stringify(balanceInfo));
    const balance = parseFloat(balanceInfo.balance);

    await clickButton('Payments');
    await sl(1000);
    await window.getByRole('button', { name: /Add Payment/ }).first().click();
    await sl(1500);
    await waitForText('Add Payment', 3000);
    await fillInput('Amount', balance.toFixed(2));
    await selectByPartialText('Payment Method', 'Cash');
    await fillInput('Reference No.', 'SETTLE-PDF-TEST');
    await window.locator('form button[type="submit"]').last().click();
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('SETTLE-PDF-TEST', 5000) || await waitForText('Cash', 3000)).toBeTruthy();

    console.log('--- CHECK-OUT ---');
    await nav(`/dashboard/reservations/${reservationId}`);
    await waitForLoadingDone();
    const coBtn = window.getByRole('button', { name: 'Check Out' });
    expect(await coBtn.isVisible({ timeout: 10000 }).catch(() => false)).toBeTruthy();
    await coBtn.click();
    await sl(4000);
    await waitForLoadingDone();
    expect(await waitForText('CHECKED OUT', 10000)).toBeTruthy();

    console.log('--- INVOICE ---');
    await nav('/dashboard/billing/invoices');
    await waitForLoadingDone();
    const invBody = await window.evaluate(() => document.body.innerText);
    const hasInvoice = invBody.includes('INV-');
    console.log('Invoice list has INV-:', hasInvoice);
    expect(hasInvoice).toBeTruthy();

    const invoiceId = await window.evaluate(async () => {
      const token = localStorage.getItem('innsight_access_token');
      const resp = await fetch('/api/v1/billing/invoices?page=1&limit=5', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await resp.json();
      const list = json.success && json.data ? json.data : [];
      const items = Array.isArray(list) ? list : (list.items || []);
      return items[0] ? items[0].id : null;
    });
    expect(invoiceId).toBeTruthy();
    await nav(`/dashboard/invoice/${invoiceId}`);
    await waitForLoadingDone();
    const invDetail = await window.evaluate(() => document.body.innerText);
    expect(invDetail).toContain('INVOICE');
    expect(invDetail).toContain('Grand Total');
    expect(invDetail).toContain('Sarah Johnson');
    expect(invDetail).toContain('Guests Staying');
    expect(invDetail).toContain('Anjali Sharma');
    await ss('p1-invoice-page');

    console.log('--- PDF EXPORT ---');
    const pdfB64 = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const data = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      return data.toString('base64');
    });
    const pdfBuffer = Buffer.from(pdfB64, 'base64');
    fs.writeFileSync(PDF_OUT, pdfBuffer);
    console.log('PDF bytes:', pdfBuffer.length);

    expect(pdfBuffer.length).toBeGreaterThan(10000);
    expect(pdfBuffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    console.log('PDF saved:', PDF_OUT);
  });

  test.afterAll(async () => {
    if (electronApp) await electronApp.close().catch(() => {});
  });
});
