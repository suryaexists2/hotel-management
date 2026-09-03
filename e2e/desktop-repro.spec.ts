import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const APP_EXE = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked', 'InnSight Hotel Management.exe');
const APP_DIR = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-results', 'repro');
const DB_PATH = path.join(process.env.APPDATA || '', '@innsight', 'desktop', 'innsight.db');
const TEST_ID = path.resolve(__dirname, '..', 'test-results', 'test-id.png');

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

test.describe('Repro: ID upload + checkout invoice', () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(TEST_ID), { recursive: true });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(TEST_ID, png);

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

  test('Issue 1: Guest ID upload', async () => {
    test.setTimeout(180000);

    // Get the guest id
    const guestInfo = await window.evaluate(async () => {
      try {
        const token = localStorage.getItem('innsight_access_token');
        const resp = await fetch('/api/v1/guests?page=1&limit=10', { headers: { 'Authorization': `Bearer ${token}` } });
        const json = await resp.json();
        const list = json.success && json.data ? json.data : [];
        if (!list.length) return { error: 'no guests' };
        return { id: list[0].id, name: list[0].firstName + ' ' + list[0].lastName };
      } catch (e) { return { error: String(e) }; }
    });
    console.log('Guest:', JSON.stringify(guestInfo));
    expect(guestInfo.id).toBeTruthy();

    // Navigate to guest profile
    await nav(`/dashboard/guests/${guestInfo.id}`);
    await waitForLoadingDone();
    await ss('r1-guest-profile');

    // Click Upload Front
    const uploadFrontBtn = window.getByRole('button', { name: 'Upload Front' });
    if (!(await uploadFrontBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Maybe already uploaded from a previous run
      console.log('Upload Front button not visible (may already have ID)');
    }
    const fileInput = window.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_ID).catch(() => {});
    await sl(4000);
    await ss('r2-after-upload');

    const bodyAfter = await window.evaluate(() => document.body.innerText);
    console.log('Upload status text:', bodyAfter.substring(0, 500));

    const hasImg = await window.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(i => ({ src: i.src, alt: i.alt })).filter(i => i.alt === 'ID Front');
    });
    console.log('ID Front img:', JSON.stringify(hasImg));
    expect(hasImg.length).toBeGreaterThan(0);
    expect(hasImg[0].src).toContain('/uploads/');

    // Fetch the image to verify it serves
    const imgFetch = await window.evaluate(async (src) => {
      const r = await fetch(src);
      return { status: r.status, len: (await r.arrayBuffer()).byteLength };
    }, hasImg[0].src);
    console.log('Image fetch:', JSON.stringify(imgFetch));
    expect(imgFetch.status).toBe(200);
    expect(imgFetch.len).toBeGreaterThan(0);

    // Reload the page to verify persistence
    await nav(`/dashboard/guests/${guestInfo.id}`);
    await waitForLoadingDone();
    const persists = await window.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => i.alt === 'ID Front');
      return imgs.length > 0 ? imgs[0].src : null;
    });
    console.log('After reload ID Front src:', persists);
    expect(persists).toContain('/uploads/');
    await ss('r3-after-reload');
  });

  test('Issue 2: Checkout generates invoice + Issue 3: occupants', async () => {
    test.setTimeout(600000);

    // ── Create reservation ──
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
    await ss('r4-reservation-form');
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

    // ── Add occupants (Issue 3) ──
    console.log('--- OCCUPANTS ---');
    await nav(`/dashboard/reservations/${reservationId}`);
    await waitForLoadingDone();
    await ss('r5-reservation-detail');

    // Add occupant 1
    await clickButton(/Add/);
    await sl(1500);
    await waitForText('Add Occupant', 3000);
    await fillInput('First Name', 'Anjali');
    await fillInput('Last Name', 'Sharma');
    await selectByPartialText('Gender', 'Female');
    await fillInput('Phone', '+1-555-2001');
    await fillInput('Relationship', 'Spouse');
    await ss('r6-occupant-1-form');
    await window.locator('form button[type="submit"]').last().click();
    await sl(3000);
    expect(await waitForText('Anjali', 5000)).toBeTruthy();
    await ss('r7-occupant-1-added');

    // Add occupant 2
    await clickButton(/Add/);
    await sl(1500);
    await waitForText('Add Occupant', 3000);
    await fillInput('First Name', 'Rohan');
    await fillInput('Last Name', 'Sharma');
    await selectByPartialText('Gender', 'Male');
    await fillInput('Relationship', 'Child');
    await window.locator('form button[type="submit"]').last().click();
    await sl(3000);
    expect(await waitForText('Rohan', 5000)).toBeTruthy();

    // Verify room info shows 3 Guests
    const roomOccupants = await window.evaluate(() => document.body.innerText);
    expect(roomOccupants).toContain('3 Guests');
    await ss('r8-occupants-added');

    // ── Check-in ──
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
    await ss('r9-checkin-modal');
    await clickButton('Confirm Check-In');
    await sl(4000);
    await waitForLoadingDone();
    expect(await waitForText('CHECKED IN', 10000)).toBeTruthy();

    // ── Add charge ──
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

    // ── Get balance and settle fully ──
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
    await fillInput('Reference No.', 'SETTLE-REPRO');
    await ss('r10-settle-payment');
    await window.locator('form button[type="submit"]').last().click();
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('SETTLE-REPRO', 5000) || await waitForText('Cash', 3000)).toBeTruthy();

    // ── Check-out ──
    console.log('--- CHECK-OUT ---');
    await nav(`/dashboard/reservations/${reservationId}`);
    await waitForLoadingDone();
    const coBtn = window.getByRole('button', { name: 'Check Out' });
    expect(await coBtn.isVisible({ timeout: 10000 }).catch(() => false)).toBeTruthy();
    await coBtn.click();
    await sl(4000);
    await waitForLoadingDone();
    expect(await waitForText('CHECKED OUT', 10000)).toBeTruthy();
    await ss('r11-checked-out');

    // ── Verify invoice generated ──
    console.log('--- INVOICE CHECK ---');
    await nav('/dashboard/billing/invoices');
    await waitForLoadingDone();
    await ss('r12-invoice-list');
    const invBody = await window.evaluate(() => document.body.innerText);
    const hasInvoice = invBody.includes('INV-');
    console.log('Invoice list has INV-:', hasInvoice);
    expect(hasInvoice).toBeTruthy();

    // Open the invoice (View button opens a new tab, which is not supported in Electron)
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
    await ss('r13-invoice-detail');
    const invDetail = await window.evaluate(() => document.body.innerText);
    expect(invDetail).toContain('INVOICE');
    expect(invDetail).toContain('Grand Total');
    expect(invDetail).toContain('Sarah Johnson');
    // Occupants on invoice
    expect(invDetail).toContain('Guests Staying');
    expect(invDetail).toContain('Anjali Sharma');
    expect(invDetail).toContain('Rohan Sharma');
    await ss('r14-invoice-verified');

    // Print button
    const printBtn = window.getByRole('button', { name: /Print/i });
    expect(await printBtn.isVisible({ timeout: 3000 }).catch(() => false)).toBeTruthy();
    console.log('Print button visible');
  });

  test.afterAll(async () => {
    if (electronApp) await electronApp.close().catch(() => {});
  });
});
