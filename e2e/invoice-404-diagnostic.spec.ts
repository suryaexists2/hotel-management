import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const API_BASE = 'http://127.0.0.1:4567';
const APP_URL = 'http://127.0.0.1:4567';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'test-results', 'invoice-404-diag');
const DB_PATH = path.join(__dirname, '..', 'apps', 'desktop', 'tests', 'innsight.db');

let page: Page;

function sl(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function ss(name: string) {
  try {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
  } catch {}
}

async function bodyText(): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

async function waitForText(text: string, timeout = 15000) {
  try {
    await page.waitForFunction((t: string) => document.body.innerText.includes(t), text, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function navigate(pathname: string) {
  await page.goto(`${APP_URL}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sl(3000);
}

test.describe('Invoice 404 Diagnostic', () => {
  let invoiceId = '';

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    page = await browser.newPage({ ignoreHTTPSErrors: true });

    page.on('pageerror', (err) => console.log('PAGE_ERROR:', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text());
    });

    // Navigate to app
    await navigate('/');
    await ss('00-app-root');
    console.log('Page URL:', page.url());

    // Check if we're on setup or already logged in
    const welcome = await waitForText('Welcome', 5000);
    console.log('Welcome visible:', welcome);

    // If already set up, try login
    if (!welcome) {
      const hasLogin = await waitForText('Sign In', 3000) || await waitForText('Login', 3000) || await waitForText('Email', 3000);
      if (hasLogin) {
        console.log('Login page detected, logging in...');
        // Try to login with seeded credentials
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await emailInput.fill('admin@innsight.com');
          const passInput = page.locator('input[type="password"], input[name="password"]').first();
          if (await passInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await passInput.fill('password123');
            const submitBtn = page.locator('button[type="submit"]').first();
            await submitBtn.click();
            await sl(3000);
          }
        }
      }
    }

    await ss('01-after-auth');
    console.log('Page URL after auth:', page.url());

    // Try API-based approach to get an invoice
    console.log('Fetching invoice list via API...');
    try {
      const resp = await page.evaluate(async () => {
        const r = await fetch('/api/v1/billing/invoices?page=1&limit=1');
        const text = await r.text();
        return { status: r.status, body: text.substring(0, 2000) };
      });
      console.log('Invoice list API:', JSON.stringify(resp));
    } catch (e) {
      console.log('Invoice list API error:', e);
    }

    // Get token and try to ensure we have an invoice
    try {
      const invoiceData = await page.evaluate(async () => {
        const token = localStorage.getItem('innsight_access_token');
        if (!token) return { error: 'no token' };

        // Try reservations
        const resResp = await fetch('/api/v1/reservations?page=1&limit=1', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const resJson = await resResp.json();
        if (!resJson.success) return { error: 'reservations API failed: ' + JSON.stringify(resJson) };

        const reservations = resJson.data;
        if (!reservations || reservations.length === 0) return { error: 'no reservations' };

        const resId = reservations[0].id;

        // Get or create folio
        const folioResp = await fetch(`/api/v1/billing/reservations/${resId}/folio`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const folioJson = await folioResp.json();
        if (!folioJson.success) return { error: 'folio API failed' };

        const folio = folioJson.data;

        // Generate invoice
        const invResp = await fetch(`/api/v1/billing/folios/${folio.id}/invoice`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        const invJson = await invResp.json();
        if (!invJson.success) return { error: 'invoice gen failed: ' + JSON.stringify(invJson) };

        return { invoiceId: invJson.data.id, invoiceNumber: invJson.data.invoiceNumber };
      });
      console.log('Invoice data:', JSON.stringify(invoiceData));

      if (invoiceData.invoiceId) {
        invoiceId = invoiceData.invoiceId;
        console.log('Got invoice ID:', invoiceId);
      }
    } catch (e) {
      console.log('Invoice data fetch error:', e);
    }
  });

  test('Diagnose invoice 404', async () => {
    test.setTimeout(60000);

    if (!invoiceId) {
      console.log('No invoice ID available, trying to check what pages exist');
    }

    // TEST 1: Navigate to /invoice/{id} (WRONG route)
    console.log('\n═══ TEST 1: WRONG route — /invoice/{id} ═══');
    const wrongUrl = invoiceId ? `/invoice/${invoiceId}` : '/invoice/nonexistent';
    await navigate(wrongUrl);
    await ss('02-wrong-route');

    const wrongBody = await bodyText();
    console.log('Wrong route body (first 800):', wrongBody.substring(0, 800));

    // Check if it shows 404 or similar error
    const has404 = wrongBody.includes('404') || wrongBody.includes('Not Found') || wrongBody.includes('not found');
    const isBlank = wrongBody.trim().length < 50;
    const isLogin = wrongBody.includes('Sign In') || wrongBody.includes('Login');
    const isSetup = wrongBody.includes('Welcome') || wrongBody.includes('Setup');

    console.log('Wrong route analysis:', {
      has404, isBlank, isLogin, isSetup, bodyLength: wrongBody.length
    });

    // Capture DOM state
    const domState = await page.evaluate(() => {
      const root = document.getElementById('__next');
      const title = document.title;
      const mainContent = document.querySelector('main')?.textContent?.substring(0, 500);
      return { title, hasNextRoot: !!root, mainContent };
    });
    console.log('DOM state:', JSON.stringify(domState));

    // TEST 2: Navigate to /dashboard/invoice/{id} (CORRECT route)
    console.log('\n═══ TEST 2: CORRECT route — /dashboard/invoice/{id} ═══');
    if (invoiceId) {
      await navigate(`/dashboard/invoice/${invoiceId}`);
      await ss('03-correct-route');

      await sl(3000);
      const correctBody = await bodyText();
      console.log('Correct route body (first 800):', correctBody.substring(0, 800));

      const hasInvoice = correctBody.includes('INVOICE') || correctBody.includes('INV-');
      const hasInvoiceNotFound = correctBody.includes('Invoice not found');
      const hasBillTo = correctBody.includes('BILL TO');
      const hasGrandTotal = correctBody.includes('Grand Total');

      console.log('Correct route analysis:', {
        hasInvoice, hasInvoiceNotFound, hasBillTo, hasGrandTotal, bodyLength: correctBody.length
      });

      // DOM analysis for correct route
      const correctDom = await page.evaluate(() => {
        const invoiceContent = document.querySelector('#invoice-content');
        const invoiceRoot = document.querySelector('#invoice-root');
        const printBtn = document.querySelector('button')?.textContent;
        return {
          hasInvoiceContent: !!invoiceContent,
          hasInvoiceRoot: !!invoiceRoot,
          firstBtnText: printBtn,
        };
      });
      console.log('Correct route DOM:', JSON.stringify(correctDom));

      await ss('04-correct-invoice');
    }

    // TEST 3: Analyze Network response for wrong route
    console.log('\n═══ TEST 3: Network analysis ═══');
    try {
      const networkInfo = await page.evaluate(async (wrongUrl) => {
        const resp = await fetch(wrongUrl, { method: 'GET' });
        const text = await resp.text();
        return {
          status: resp.status,
          contentType: resp.headers.get('content-type'),
          bodyLength: text.length,
          bodyStart: text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500),
        };
      }, wrongUrl);
      console.log('Network analysis:', JSON.stringify(networkInfo));
    } catch (e) {
      console.log('Network analysis error:', e);
    }
  });
});
