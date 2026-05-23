#!/usr/bin/env node
// Browser session management for MakeUGC automation
// Connects to running Chrome via CDP (if CHROME_WS_ENDPOINT set)
// OR launches a fresh browser with saved session cookies

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '..', '.makeugc-session.json');
const MAKEUGC_URL = 'https://app.makeugc.ai';

let _browser = null;
let _page = null;

async function getBrowser() {
  if (_browser) return _browser;

  const wsEndpoint = process.env.CHROME_WS_ENDPOINT;

  if (wsEndpoint) {
    // Connect to user's running Chrome (CDP mode — already logged in)
    _browser = await chromium.connectOverCDP(wsEndpoint);
  } else {
    // Launch fresh browser with persistent context
    const userDataDir = process.env.MAKEUGC_PROFILE || path.join(__dirname, '..', '.profile');
    _browser = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.HEADLESS === '1',
      viewport: { width: 1280, height: 720 },
    });
  }
  return _browser;
}

async function getPage() {
  if (_page && !_page.isClosed()) return _page;

  const browser = await getBrowser();

  // Get existing MakeUGC tab or open new one
  const contexts = browser.contexts ? browser.contexts() : [browser];
  for (const ctx of contexts) {
    const pages = ctx.pages();
    for (const p of pages) {
      if (p.url().includes('makeugc.ai')) {
        _page = p;
        return _page;
      }
    }
  }

  // No existing tab — open one
  const ctx = browser.contexts ? browser.contexts()[0] : browser;
  _page = await ctx.newPage();
  await _page.goto(MAKEUGC_URL, { waitUntil: 'domcontentloaded' });
  await _page.waitForTimeout(2000);

  // Load saved session if exists
  if (fs.existsSync(SESSION_FILE) && process.env.CHROME_WS_ENDPOINT) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    await ctx.addCookies(cookies);
    await _page.reload({ waitUntil: 'domcontentloaded' });
  }

  return _page;
}

async function saveSession() {
  const browser = await getBrowser();
  const contexts = browser.contexts ? browser.contexts() : [browser];
  const ctx = contexts[0];
  const cookies = await ctx.cookies('https://app.makeugc.ai');
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
}

async function isLoggedIn() {
  const page = await getPage();
  return page.url().includes('makeugc.ai') && !page.url().includes('login') && !page.url().includes('signin');
}

async function clickByText(page, text, tag = 'button,div') {
  await page.evaluate((t) => {
    const all = document.querySelectorAll('button, div, span, a');
    for (const el of all) {
      if (el.innerText?.trim() === t) { el.click(); return true; }
    }
    return false;
  }, text);
}

async function cleanup() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
    _page = null;
  }
}

module.exports = { getBrowser, getPage, saveSession, isLoggedIn, clickByText, cleanup, MAKEUGC_URL };
