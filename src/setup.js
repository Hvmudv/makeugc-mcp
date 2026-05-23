#!/usr/bin/env node
// Interactive setup: saves MakeUGC session cookies for future use
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '..', '.makeugc-session.json');
const PROFILE_DIR = path.join(__dirname, '..', '.profile');

async function setup() {
  console.log('\n makeugc-mcp setup\n');
  console.log('Opening browser — log into MakeUGC.ai, then press Enter here...\n');

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
  });

  const page = await browser.newPage();
  await page.goto('https://app.makeugc.ai', { waitUntil: 'domcontentloaded' });

  // Wait for user to log in
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
    console.log('Press Enter after you are logged in...');
  });

  // Save cookies
  const cookies = await browser.cookies('https://app.makeugc.ai');
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log(`\nSession saved to ${SESSION_FILE}`);
  console.log('Profile saved to', PROFILE_DIR);
  console.log('\nSetup complete. Register the MCP:\n');
  console.log(`  claude mcp add makeugc node ${path.join(__dirname, 'index.js')}\n`);

  await browser.close();
}

setup().catch(err => { console.error(err); process.exit(1); });
