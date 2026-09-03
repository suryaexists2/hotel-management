import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const APP_DIR = path.resolve(__dirname, '..', 'apps', 'desktop', 'release', 'win-unpacked');
const APP_EXE = path.join(APP_DIR, 'InnSight Hotel Management.exe');
const DB_PATH = path.join(process.env.APPDATA || '', '@innsight', 'desktop', 'innsight.db');

// Clean DB before run
for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) {
    try { fs.unlinkSync(f); } catch (e) { console.log('Could not delete:', f, e); }
  }
}

test.describe('Desktop App — Revenue Analytics E2E', () => {
  let electronApp: any;
  let appWindow: any;
  let origin: string;

  const nav = (p: string) => appWindow.goto(`${origin}${p}`, { waitUntil: 'networkidle' });

  // --- Resilient helpers ---

  async function fillInput(label: string, value: string) {
    try {
      const input = appWindow.getByLabel(label, { exact: false });
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.fill(value);
        return true;
      }
    } catch {}
    const byName = appWindow.locator(`input[name="${label}" i]`);
    if (await byName.isVisible({ timeout: 1000 }).catch(() => false)) {
      await byName.fill(value);
      return true;
    }
    return false;
  }

  async function selectByPartialText(label: string, optionContains: string) {
    try {
      const select = appWindow.getByLabel(label, { exact: false });
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        const optValue = await select.evaluate((el: HTMLSelectElement, text: string) => {
          for (const opt of el.options) {
            if (opt.text.includes(text)) return opt.value;
          }
          return '';
        }, optionContains);
        if (optValue) {
          await select.selectOption(optValue);
          return true;
        }
      }
    } catch {}
    return false;
  }

  async function waitForText(text: string, timeout = 15000) {
    try {
      await appWindow.waitForFunction((t: string) => document.body.innerText.includes(t), text, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  test.beforeAll(async () => {
    test.setTimeout(120000);

    console.log('Launching Electron app from:', APP_EXE);
    electronApp = await electron.launch({
      executablePath: APP_EXE,
      args: [],
      cwd: APP_DIR,
      timeout: 60000,
    });

    console.log('Waiting for first window...');
    appWindow = await electronApp.firstWindow({ timeout: 60000 });
    console.log('Window found! Title:', await appWindow.title());
    console.log('URL:', appWindow.url());

    await appWindow.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log('Page loaded, current URL:', appWindow.url());

    origin = new URL(appWindow.url()).origin;
  });

  test.afterAll(async () => {
    if (electronApp) await electronApp.close();
  });

  test('Login → Create data → Reservation → Check-in → Pay → Check-out → Revenue verify', async () => {
    test.setTimeout(240000);

    // ─── 1. First-Time Setup (clean DB) ─────────
    console.log('Step 1: Setup...');
    console.log('Origin:', origin);

    // Wait for page to settle
    await appWindow.waitForTimeout(3000);

    // Get page text to determine state
    const pageBody = await appWindow.evaluate(() => document.body.innerText.substring(0, 2000));
    console.log('Page text (first 1000):', pageBody.substring(0, 1000));

    // Detect setup by checking body text for various setup indicators
    const isSetupWizard = pageBody.includes('Set Up Your Hotel') || pageBody.includes('Step 1 of 4') || pageBody.includes('Hotel Profile');
    const isSimpleSetup = pageBody.includes('Welcome to InnSight') || pageBody.includes('Create My Hotel');
    const isLandingPage = pageBody.includes('Welcome back') || pageBody.includes('Sign In');
    const isDashboard = pageBody.includes('Dashboard') || pageBody.includes('Occupancy');

    if (isSimpleSetup) {
      console.log('Simple setup form detected');
      const hotelInput = appWindow.locator('input[placeholder*="Grand Palace"]');
      if (await hotelInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await hotelInput.fill('E2E Test Hotel');
      }
      const phoneInput = appWindow.locator('input[placeholder*="987654"]');
      if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await phoneInput.fill('+1-555-0100');
      }
      const addressInput = appWindow.locator('textarea');
      if (await addressInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addressInput.fill('100 Ocean Boulevard');
      }
      await appWindow.getByRole('button', { name: /Create My Hotel/i }).click();
      await appWindow.waitForTimeout(5000);
    } else if (isSetupWizard) {
      console.log('Multi-step setup wizard detected');
      // Step 1: Hotel Profile
      const nameInput = appWindow.getByRole('textbox', { name: /hotel name/i });
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('E2E Test Hotel');
      }
      const addressInput = appWindow.getByRole('textbox', { name: /address/i });
      if (await addressInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await addressInput.fill('100 Ocean Boulevard');
      }
      const cityInput = appWindow.getByRole('textbox', { name: /city/i });
      if (await cityInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cityInput.fill('Santa Monica');
      }
      const phoneInput = appWindow.getByRole('textbox', { name: /phone/i });
      if (await phoneInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await phoneInput.fill('+1-555-0100');
      }
      const emailInput = appWindow.getByRole('textbox', { name: /email/i });
      if (await emailInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await emailInput.fill('admin@innsight.io');
      }

      // Click Continue through all steps
      for (let step = 0; step < 6; step++) {
        const btn = appWindow.getByRole('button', { name: /continue|next|finish|complete|done|submit/i });
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await appWindow.waitForTimeout(2000);
        } else {
          break;
        }
      }
      await appWindow.waitForTimeout(3000);
    } else if (isLandingPage) {
      console.log('Landing page detected (DB exists, needs login)');
      // Try login
      const emailField = appWindow.getByRole('textbox', { name: /email/i });
      if (await emailField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailField.fill('admin@innsight.io');
        const passwordField = appWindow.getByLabel(/password/i);
        await passwordField.fill('Admin@12345');
        await appWindow.getByRole('button', { name: /sign in/i }).click();
        await appWindow.waitForTimeout(5000);
      }
    } else if (isDashboard) {
      console.log('Already on dashboard');
    } else {
      console.log('Unknown page state, trying nav to dashboard');
    }

    // Verify we can access dashboard
    if (!appWindow.url().includes('/dashboard')) {
      await nav('/dashboard');
      await appWindow.waitForTimeout(3000);
    }
    const onDashboard = await appWindow.getByText('Dashboard').isVisible({ timeout: 15000 }).catch(() => false)
      || await appWindow.getByText('Occupancy').isVisible({ timeout: 5000 }).catch(() => false);
    expect(onDashboard).toBeTruthy();
    console.log('Dashboard accessible, URL:', appWindow.url());
    await appWindow.screenshot({ path: 'test-results/1-login-success.png' });

    // ─── 2. Create Room Type ───────────────────
    console.log('Step 2: Creating room type...');
    await nav('/dashboard/room-types/new');
    await appWindow.waitForTimeout(2000);
    const rtFormLoaded = await waitForText('Add Room Type', 5000);
    expect(rtFormLoaded).toBeTruthy();

    await fillInput('Name', 'E2E Standard Room');
    await fillInput('Base Rate', '250');
    await fillInput('Max Occupancy', '2');
    await appWindow.getByRole('button', { name: /create room/i }).click();
    await appWindow.waitForTimeout(2000);
    const rtOk = await waitForText('E2E Standard Room', 8000);
    expect(rtOk).toBeTruthy();
    await appWindow.screenshot({ path: 'test-results/2-roomtype-created.png' });
    console.log('Room type created');

    // ─── 3. Create Room ────────────────────────
    console.log('Step 3: Creating room...');
    await nav('/dashboard/rooms/new');
    await appWindow.waitForTimeout(1000);

    await fillInput('Room Number', 'E2E-101');
    await fillInput('Floor', '1');
    await selectByPartialText('Room Type', 'Standard');
    await appWindow.getByRole('button', { name: /create room/i }).click();
    await appWindow.waitForTimeout(2000);
    const rmOk = await waitForText('E2E-101', 8000) || await waitForText('Room E2E-101', 5000);
    expect(rmOk).toBeTruthy();
    await appWindow.screenshot({ path: 'test-results/3-room-created.png' });
    console.log('Room created');

    // ─── 4. Create Guest ───────────────────────
    console.log('Step 4: Creating guest...');
    await nav('/dashboard/guests/new');
    await appWindow.waitForTimeout(1000);

    await fillInput('First Name', 'E2E John');
    await fillInput('Last Name', 'Doe');
    await fillInput('Email', 'e2e.john@test.com');
    await appWindow.getByRole('button', { name: /create guest/i }).click();
    await appWindow.waitForTimeout(2000);
    const guestOk = await waitForText('E2E John', 8000);
    expect(guestOk).toBeTruthy();
    await appWindow.screenshot({ path: 'test-results/4-guest-created.png' });
    console.log('Guest created');

    // ─── 5. Create Reservation ─────────────────
    console.log('Step 5: Creating reservation...');
    await nav('/dashboard/reservations/new');
    await appWindow.waitForTimeout(1500);

    const today = new Date();
    const d1 = new Date(today); d1.setDate(d1.getDate() + 1);
    const d2 = new Date(today); d2.setDate(d2.getDate() + 3);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    await selectByPartialText('Guest', 'John');
    await selectByPartialText('Room Type', 'Standard');
    await fillInput('Check-in Date', fmt(d1));
    await fillInput('Check-out Date', fmt(d2));
    await appWindow.getByRole('button', { name: /create reservation/i }).click();
    await appWindow.waitForTimeout(3000);
    const resOk = await waitForText('CONFIRMED', 10000);
    expect(resOk).toBeTruthy();
    await appWindow.screenshot({ path: 'test-results/5-reservation-created.png' });

    const pageText = await appWindow.textContent('body');
    expect(pageText).toContain('CONFIRMED');
    console.log('Reservation confirmed');

    // ─── 6. Check In ───────────────────────────
    console.log('Step 6: Checking in...');

    // Get reservation ID from API
    const resInfo = await appWindow.evaluate(async () => {
      try {
        const token = localStorage.getItem('innsight_access_token');
        if (!token) return { error: 'no token' };
        const resp = await fetch('/api/v1/reservations?page=1&limit=10', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) return { error: `API ${resp.status}` };
        const json = await resp.json();
        const list = json.success && json.data ? json.data : null;
        if (!list || list.length === 0) return { error: 'no reservations' };
        return { success: true, id: list[0].id, status: list[0].status };
      } catch (e) {
        return { error: String(e) };
      }
    });
    console.log('Reservation info:', JSON.stringify(resInfo));
    expect(resInfo.success).toBeTruthy();

    // Navigate to reservation detail
    await nav(`/dashboard/reservations/${resInfo.id}`);
    await appWindow.waitForTimeout(3000);

    // Find and click Check In button
    const checkInBtn = appWindow.getByRole('button', { name: /check in/i });
    if (await checkInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkInBtn.click();
      await appWindow.waitForTimeout(2000);

      // Select room in modal
      const roomSelect = appWindow.getByLabel('Room', { exact: false });
      if (await roomSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        const roomValue = await roomSelect.evaluate((el: HTMLSelectElement) => {
          for (const opt of el.options) {
            if (opt.text.includes('E2E-101')) return opt.value;
          }
          return '';
        });
        if (roomValue) {
          await roomSelect.selectOption(roomValue);
        }
      }

      const confirmBtn = appWindow.getByRole('button', { name: /confirm check.in/i });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await appWindow.waitForTimeout(4000);
      }
    }

    await appWindow.screenshot({ path: 'test-results/6-checked-in.png' });
    const textAfterCI = await appWindow.textContent('body');
    const ciDisplayed = textAfterCI.includes('CHECKED_IN') || textAfterCI.includes('CHECKED IN');
    expect(ciDisplayed).toBeTruthy();
    console.log('Checked in successfully');

    // ─── 7. Billing → Payment ──────────────────
    console.log('Step 7: Processing payment...');

    // Navigate to billing/folio for this reservation
    await nav(`/dashboard/billing/${resInfo.id}`);
    await appWindow.waitForLoadState('networkidle');
    await appWindow.waitForTimeout(3000);

    const folioLoaded = await waitForText('Total Charges', 8000) || await waitForText('Charges', 5000);
    expect(folioLoaded).toBeTruthy();

    // Switch to Payments tab
    const paymentsTab = appWindow.getByRole('button', { name: 'Payments' });
    if (await paymentsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await paymentsTab.click();
      await appWindow.waitForTimeout(1000);
    }

    // Add payment for the balance
    const addPaymentBtn = appWindow.getByRole('button', { name: /add payment/i });
    if (await addPaymentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addPaymentBtn.click();
      await appWindow.waitForTimeout(1500);
    }

    // Get balance from the UI
    const folioBody = await appWindow.textContent('body');
    const balanceMatch = folioBody?.match(/Balance[^0-9]*([\d.]+)/);
    const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;
    console.log(`Balance to pay: ${balance}`);

    if (balance > 0) {
      await fillInput('Amount', balance.toFixed(2));
      // Select payment method
      const payMethod = appWindow.getByLabel('Payment Method');
      if (await payMethod.isVisible({ timeout: 2000 }).catch(() => false)) {
        const cashValue = await payMethod.evaluate((el: HTMLSelectElement) => {
          for (const opt of el.options) {
            if (opt.text.includes('Cash')) return opt.value;
          }
          return '';
        });
        if (cashValue) await payMethod.selectOption(cashValue);
      }
      await appWindow.locator('form button[type="submit"]').last().click();
      await appWindow.waitForTimeout(3000);
      console.log('Payment submitted');
    }

    await appWindow.screenshot({ path: 'test-results/7-payment-done.png' });
    console.log('Payment processed');

    // ─── 8. Check Out ──────────────────────────
    console.log('Step 8: Checking out...');

    await nav(`/dashboard/reservations/${resInfo.id}`);
    await appWindow.waitForLoadState('networkidle');
    await appWindow.waitForTimeout(2000);

    const checkOutBtn = appWindow.getByRole('button', { name: /check out/i });
    if (await checkOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkOutBtn.click();
      await appWindow.waitForTimeout(3000);
    }

    await appWindow.screenshot({ path: 'test-results/8-checked-out.png' });
    const textAfterCO = await appWindow.textContent('body');
    const isCheckedOut = (textAfterCO || '').includes('CHECKED_OUT') || (textAfterCO || '').includes('CHECKED OUT');
    expect(isCheckedOut).toBeTruthy();
    console.log('Checked out successfully');

    // ─── 9. Dashboard → Revenue Verify ─────────
    console.log('Step 9: Verifying dashboard revenue...');
    await nav('/dashboard');
    await appWindow.waitForLoadState('networkidle');
    await appWindow.waitForTimeout(3000);

    await appWindow.screenshot({ path: 'test-results/9-dashboard-revenue.png' });

    const revenueSection = appWindow.locator('text=Revenue Breakdown').locator('..');
    const revenueValues = revenueSection.locator('p.text-xl');
    const count = await revenueValues.count();

    console.log(`Found ${count} revenue values`);
    let hasNonZero = false;
    for (let i = 0; i < count; i++) {
      const text = await revenueValues.nth(i).textContent();
      console.log(`Revenue ${i}: "${text}"`);
      if (text && !text.includes('$0')) hasNonZero = true;
    }

    expect(hasNonZero).toBe(true);
    await appWindow.screenshot({ path: 'test-results/10-all-passed.png' });
    console.log('All assertions passed!');
  });
});
