import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const APP_EXE = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked', 'InnSight Hotel Management.exe');
const APP_DIR = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-results', 'repro');
const DB_PATH = path.join(process.env.APPDATA || '', '@innsight', 'desktop', 'innsight.db');

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

async function folioState(reservationId: string) {
  return window.evaluate(async (resId) => {
    const token = localStorage.getItem('innsight_access_token');
    const resp = await fetch(`/api/v1/billing/reservations/${resId}/folio`, { headers: { 'Authorization': `Bearer ${token}` } });
    const json = await resp.json();
    if (!json.success) return { error: json.error || 'failed' };
    return {
      status: json.data.status,
      balance: Number(json.data.balance),
      totalPayments: Number(json.data.totalPayments),
      payments: json.data.payments.map((p: any) => ({
        id: p.id, amount: Number(p.amount), status: p.status,
        refundedAt: p.refundedAt, voidedAt: p.voidedAt, referenceNo: p.referenceNo,
      })),
    };
  }, reservationId);
}

async function addPaymentViaUi(amount: string, reference: string) {
  await clickButton('Payments');
  await sl(1200);
  await window.getByRole('button', { name: /Add Payment/ }).first().click();
  await sl(1200);
  await waitForText('Add Payment', 3000);
  await fillInput('Amount', amount);
  await selectByPartialText('Payment Method', 'Cash');
  await fillInput('Reference No.', reference);
  await window.locator('form button[type="submit"]').last().click();
  await sl(2500);
  await waitForLoadingDone();
}

test.describe('Payment correction: edit/delete/refund', () => {
  test.beforeAll(async () => {
    test.setTimeout(300000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    try { require('child_process').execSync('taskkill /f /im "InnSight Hotel Management.exe" 2>nul', { stdio: 'ignore' }); } catch {}
    await new Promise(r => setTimeout(r, 2000));
    for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
      if (fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
    }

    electronApp = await electron.launch({ executablePath: APP_EXE, args: [], cwd: APP_DIR, timeout: 60000 });
    electronApp.process().stdout?.on('data', (d: Buffer) => console.log('APP_OUT:', d.toString().slice(0, 400)));
    electronApp.process().stderr?.on('data', (d: Buffer) => console.log('APP_ERR:', d.toString().slice(0, 400)));
    window = await electronApp.firstWindow({ timeout: 60000 });
    await window.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    window.on('pageerror', (err) => console.log('PAGE_ERROR:', err.message));
    window.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text());
    });
    window.on('response', async (resp) => {
      if (resp.status() >= 400) {
        let body = '';
        try { body = (await resp.text()).substring(0, 300); } catch {}
        console.log(`HTTP ${resp.status()}: ${resp.url()} BODY: ${body}`);
      }
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

  test('Overpaid folio: edit + delete + refund payment after check-out', async () => {
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

    console.log('--- CHECK-IN ---');
    await nav(`/dashboard/reservations/${reservationId}`);
    await waitForLoadingDone();
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

    console.log('--- OVERPAY ---');
    await nav(`/dashboard/billing/${reservationId}`);
    await waitForLoadingDone();
    expect(await waitForText('Total Charges', 10000)).toBeTruthy();
    await addPaymentViaUi('545.50', 'PAY-CORRECT');
    await addPaymentViaUi('100.00', 'PAY-MISTAKE');
    let state = await folioState(reservationId);
    console.log('After overpay:', JSON.stringify(state));
    expect(state.balance).toBeLessThan(0); // overpaid -> negative balance
    await ss('o1-overpaid');

    console.log('--- CHECK-OUT (overpaid) ---');
    await nav(`/dashboard/reservations/${reservationId}`);
    await waitForLoadingDone();
    const coBtn = window.getByRole('button', { name: 'Check Out' });
    expect(await coBtn.isVisible({ timeout: 10000 }).catch(() => false)).toBeTruthy();
    await coBtn.click();
    await sl(4000);
    await waitForLoadingDone();
    expect(await waitForText('CHECKED OUT', 10000)).toBeTruthy();
    state = await folioState(reservationId);
    console.log('After checkout:', JSON.stringify(state));
    expect(state.status).toBe('SETTLED');
    expect(state.balance).toBeLessThan(0);

    console.log('--- EDIT PAYMENT (100 -> 50) ---');
    await nav(`/dashboard/billing/${reservationId}`);
    await waitForLoadingDone();
    await clickButton('Payments');
    await sl(1500);
    const editBtns = window.locator('button[title="Edit payment"]');
    expect(await editBtns.count()).toBe(2);
    await editBtns.nth(1).click();
    await sl(1200);
    expect(await waitForText('Edit Payment', 3000)).toBeTruthy();
    await ss('d1-edit-modal');
    await fillInput('Amount', '50.00');
    await clickButton('Save Changes');
    await sl(2500);
    await waitForLoadingDone();
    expect(await waitForText('Edit Payment', 2000)).toBeFalsy();
    state = await folioState(reservationId);
    console.log('After edit:', JSON.stringify(state));
    const edited = state.payments.find((p: any) => p.referenceNo === 'PAY-MISTAKE');
    expect(edited.amount).toBe(50);
    expect(state.totalPayments).toBe(595.5);

    console.log('--- DELETE (VOID) PAYMENT ---');
    const deleteBtns = window.locator('button[title="Delete payment"]');
    expect(await deleteBtns.count()).toBe(2);
    await deleteBtns.nth(1).click();
    await sl(1200);
    expect(await waitForText('Delete Payment', 3000)).toBeTruthy();
    await ss('d2-void-modal');
    await fillInput('Reason', 'Entered by mistake');
    await window.locator('form button[type="submit"]').last().click();
    await sl(2500);
    await waitForLoadingDone();
    state = await folioState(reservationId);
    console.log('After void:', JSON.stringify(state));
    const voided = state.payments.find((p: any) => p.referenceNo === 'PAY-MISTAKE');
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidedAt).toBeTruthy();
    expect(state.totalPayments).toBe(545.5);
    expect(state.balance).toBe(-45.5);
    expect(await waitForText('Voided', 5000)).toBeTruthy();
    await ss('o2-payment-voided');

    console.log('--- INVOICE after void (unpaid, overpaid) ---');
    await nav('/dashboard/billing/invoices');
    await waitForLoadingDone();
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
    const flat = invDetail.replace(/\s+/g, ' ');
    expect(flat).toContain('Grand Total');
    expect(flat).toContain('INR 500.00');
    expect(flat).toContain('Balance INR 0.00');
    expect(flat).toContain('UNPAID');
    await ss('o3-invoice-after-void');

    console.log('--- REFUND (with reason, was broken before) ---');
    await nav(`/dashboard/billing/${reservationId}`);
    await waitForLoadingDone();
    await clickButton('Payments');
    await sl(1500);
    const refundBtns = window.locator('button[title="Refund payment"]');
    expect(await refundBtns.count()).toBe(1);
    await refundBtns.first().click();
    await sl(1200);
    expect(await waitForText('Refund Payment', 3000)).toBeTruthy();
    await ss('d3-refund-modal');
    await fillInput('Amount', '45.50');
    await fillInput('Reason', 'Refunded at desk');
    await window.locator('form button[type="submit"]').last().click();
    await sl(2500);
    await waitForLoadingDone();
    state = await folioState(reservationId);
    console.log('After refund:', JSON.stringify(state));
    const refunded = state.payments.find((p: any) => p.referenceNo === 'PAY-CORRECT');
    expect(refunded.status).toBe('PARTIALLY_REFUNDED');
    expect(refunded.refundedAt).toBeTruthy();
    expect(state.totalPayments).toBe(500);
    expect(state.balance).toBe(0);
    expect(state.status).toBe('SETTLED');
    expect(await waitForText('Refunded', 5000)).toBeTruthy();
    await ss('o4-payment-refunded');

    console.log('--- INVOICE re-marked PAID after refund settles ---');
    await nav(`/dashboard/invoice/${invoiceId}`);
    await waitForLoadingDone();
    const invAfter = await window.evaluate(() => document.body.innerText);
    const flatAfter = invAfter.replace(/\s+/g, ' ');
    expect(flatAfter).toContain('Balance INR 0.00');
    expect(flatAfter).toContain('PAID');
    await ss('o5-invoice-after-refund');
  });

  test.afterAll(async () => {
    if (electronApp) await electronApp.close().catch(() => {});
  });
});
