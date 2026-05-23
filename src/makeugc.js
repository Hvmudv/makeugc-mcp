// MakeUGC browser automation — all platform interactions
const path = require('path');
const { getPage, clickByText } = require('./browser');

// Open the mode dropdown (Radix UI — needs pointerdown) and select a mode by name
async function switchMode(page, modeName) {
  // Open the trigger
  await page.evaluate(() => {
    const trigger = document.querySelector('[data-radix-select-trigger]')
      || document.querySelector('button[role="combobox"]')
      || document.querySelector('[aria-haspopup="listbox"]');
    if (trigger) trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true }));
  });
  await page.waitForTimeout(800);

  // Get bounding rect of the target option and click at its center
  const clicked = await page.evaluate((name) => {
    const items = document.querySelectorAll('[role="option"]');
    for (const item of items) {
      if (item.textContent?.trim().toLowerCase().includes(name.toLowerCase())) {
        const r = item.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  }, modeName);

  if (!clicked) throw new Error(`Mode "${modeName}" not found in dropdown`);

  // CDP-level click at the exact coordinates (bypasses React synthetic events)
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clicked.x, y: clicked.y, button: 'left', clickCount: 1 });
  await cdpSession.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clicked.x, y: clicked.y, button: 'left', clickCount: 1 });
  await cdpSession.detach();

  await page.waitForTimeout(1000);
  return { mode: modeName };
}

async function listActors({ gender, style, age } = {}) {
  const page = await getPage();

  await page.evaluate(() => {
    const all = document.querySelectorAll('div');
    for (const el of all) {
      if (el.innerText?.trim() === 'Add Actors') { el.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  if (gender) {
    const label = gender.toUpperCase();
    await page.evaluate((l) => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.innerText?.trim().toUpperCase() === l) { b.click(); return; }
      }
    }, label);
    await page.waitForTimeout(800);
  }

  if (style) {
    const label = style.toUpperCase();
    await page.evaluate((l) => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.innerText?.trim().toUpperCase() === l) { b.click(); return; }
      }
    }, label);
    await page.waitForTimeout(800);
  }

  const actors = await page.evaluate(() => {
    const results = [];
    const nameEls = document.querySelectorAll('[class*="actor"] [class*="name"], img[alt]');
    nameEls.forEach(el => {
      const name = el.alt || el.innerText?.trim();
      if (name && name.length > 1 && name.length < 40) {
        results.push({ name, id: name.toLowerCase().replace(/\s+/g, '-') });
      }
    });
    if (results.length === 0) {
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length === 0 && el.innerText?.trim() === 'HD') {
          const nameEl = el.previousElementSibling || el.parentElement?.querySelector('p, span');
          if (nameEl) results.push({ name: nameEl.innerText?.trim(), id: nameEl.innerText?.trim().toLowerCase() });
        }
      });
    }
    return results;
  });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  return actors;
}

async function selectActor(actorName) {
  const page = await getPage();

  await page.evaluate(() => {
    const all = document.querySelectorAll('div');
    for (const el of all) {
      if (el.innerText?.trim() === 'Add Actors') { el.click(); return; }
    }
  });
  await page.waitForTimeout(1500);

  const searchInput = await page.$('input[placeholder*="Search actors"], input[placeholder*="actor"]');
  if (searchInput) {
    await searchInput.fill(actorName);
    await page.waitForTimeout(800);
  }

  const clicked = await page.evaluate((name) => {
    const nameEls = [...document.querySelectorAll('p, span, div')];
    for (const el of nameEls) {
      if (el.innerText?.trim().toLowerCase() === name.toLowerCase() && el.children.length === 0) {
        const card = el.closest('[class*="card"], [class*="actor"], article, li') || el.parentElement;
        if (card) { card.click(); return true; }
      }
    }
    return false;
  }, actorName);

  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.innerText?.trim() === 'OK') { b.click(); return; }
    }
  });
  await page.waitForTimeout(800);

  return { selected: clicked, actor: actorName };
}

async function setScript(script) {
  const page = await getPage();
  const textarea = await page.$('textarea[placeholder*="Write your script"], textarea[placeholder*="script"]');
  if (!textarea) throw new Error('Script textarea not found — make sure you are on the video creation page');
  await textarea.click();
  await textarea.fill('');
  await textarea.type(script, { delay: 10 });
  return { chars: script.length, wordCount: script.split(/\s+/).length };
}

async function setVoice(mode = 'nova') {
  const page = await getPage();
  if (mode === 'nova') {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.innerText?.trim() === 'Text to Speech') { b.click(); return; }
      }
    });
  }
  await page.waitForTimeout(500);
  return { voice: mode };
}

async function createVideo({ script, actorName, voice = 'nova' } = {}) {
  const page = await getPage();
  if (!script) throw new Error('script is required');
  if (!actorName) throw new Error('actorName is required');

  const actorResult = await selectActor(actorName);
  const scriptResult = await setScript(script);
  await setVoice(voice);

  await page.screenshot({ path: '/tmp/makeugc_before_submit.png' });

  const submitted = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const svg = b.querySelector('svg');
      if (svg && b.closest('[class*="input"], [class*="form"], [class*="editor"]')) {
        b.click(); return true;
      }
    }
    const allBtns = [...document.querySelectorAll('button')];
    const submitBtn = allBtns.find(b => b.type === 'submit' || b.getAttribute('aria-label')?.includes('send'));
    if (submitBtn) { submitBtn.click(); return true; }
    return false;
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/makeugc_after_submit.png' });

  return {
    submitted,
    actor: actorResult,
    script: scriptResult,
    message: submitted
      ? 'Video generation started. Use makeugc_list_videos to check status.'
      : 'Submit button not found — check /tmp/makeugc_before_submit.png to debug'
  };
}

// Image Generator mode — text-to-image or image-to-image
async function createImage({ prompt, imageFile, model = 'Grok' } = {}) {
  const page = await getPage();
  if (!prompt) throw new Error('prompt is required');

  // Navigate to a project page first
  await page.goto('https://app.makeugc.ai/projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click into a project (first available)
  const projectClicked = await page.evaluate(() => {
    const cards = document.querySelectorAll('article, [class*="card"], [class*="project"]');
    if (cards[0]) { cards[0].click(); return true; }
    return false;
  });
  await page.waitForTimeout(1500);

  // Switch to Image Generator mode
  await switchMode(page, 'Image Generator');
  await page.waitForTimeout(1000);

  // If reference image provided, switch to "Image to Image" tab and upload
  if (imageFile) {
    await page.evaluate(() => {
      const tabs = document.querySelectorAll('button, [role="tab"]');
      for (const t of tabs) {
        if (t.textContent?.trim().toLowerCase().includes('image to image')) { t.click(); return; }
      }
    });
    await page.waitForTimeout(800);

    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(imageFile);
      await page.waitForTimeout(1500);
    }
  }

  // Fill the prompt
  const promptArea = await page.$('textarea[placeholder*="Describe"], textarea[placeholder*="image"], textarea');
  if (!promptArea) throw new Error('Prompt textarea not found in Image Generator');
  await promptArea.click();
  await promptArea.fill(prompt);
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/makeugc_image_before.png' });

  // Click Generate Image button
  const generated = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent?.trim().toLowerCase().includes('generate image')) { b.click(); return true; }
    }
    return false;
  });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/makeugc_image_after.png' });

  // Try to get generated image URL
  const imageUrl = await page.evaluate(() => {
    const imgs = document.querySelectorAll('[class*="generated"] img, [class*="result"] img, [class*="output"] img');
    return imgs[0]?.src || null;
  });

  return {
    generated,
    prompt,
    imageFile: imageFile || null,
    imageUrl,
    message: generated
      ? 'Image generation started. Check /tmp/makeugc_image_after.png to see result.'
      : 'Generate button not found — check /tmp/makeugc_image_before.png to debug'
  };
}

// Seedance 2.0 mode — animate image with motion prompt
async function animateSeedance({ imageFile, imageUrl, prompt, quality = 'best' } = {}) {
  const page = await getPage();
  if (!prompt) throw new Error('prompt is required');
  if (!imageFile && !imageUrl) throw new Error('imageFile (local path) or imageUrl is required');

  // Navigate to a project page
  await page.goto('https://app.makeugc.ai/projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click into a project
  await page.evaluate(() => {
    const cards = document.querySelectorAll('article, [class*="card"], [class*="project"]');
    if (cards[0]) { cards[0].click(); }
  });
  await page.waitForTimeout(1500);

  // Switch to Seedance 2.0 mode
  await switchMode(page, 'Seedance 2.0');
  await page.waitForTimeout(1000);

  // Upload image
  const fileInput = await page.$('input[type="file"]');
  if (fileInput && imageFile) {
    await fileInput.setInputFiles(imageFile);
    await page.waitForTimeout(1500);
  } else if (imageUrl) {
    // If URL provided, try to set it via the prompt using @Image1 syntax
    prompt = `@Image1 as reference image. ${prompt}`;
  }

  // Set quality mode
  if (quality === 'fast') {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.trim().toLowerCase() === 'fast') { b.click(); return; }
      }
    });
  } else {
    // Default: Pro / Best quality
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const b of btns) {
        if (b.textContent?.trim().toLowerCase() === 'pro' || b.textContent?.trim().toLowerCase() === 'best quality') {
          b.click(); return;
        }
      }
    });
  }
  await page.waitForTimeout(500);

  // Fill the prompt textarea
  const promptArea = await page.$('textarea[placeholder*="Describe"], textarea[placeholder*="video"], textarea');
  if (!promptArea) throw new Error('Prompt textarea not found in Seedance mode');
  await promptArea.click();
  await promptArea.fill(prompt);
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/makeugc_seedance_before.png' });

  // Click the submit/send button
  const submitted = await page.evaluate(() => {
    // Seedance uses a send icon button
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const svg = b.querySelector('svg');
      if (svg && (b.closest('form') || b.closest('[class*="input"]') || b.closest('[class*="editor"]'))) {
        b.click(); return true;
      }
    }
    // Fallback: submit type or aria-label
    const submit = [...document.querySelectorAll('button')].find(
      b => b.type === 'submit' || b.getAttribute('aria-label')?.match(/send|generate|submit/i)
    );
    if (submit) { submit.click(); return true; }
    return false;
  });

  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/makeugc_seedance_after.png' });

  return {
    submitted,
    prompt,
    imageFile: imageFile || null,
    quality,
    message: submitted
      ? 'Seedance animation started. Use makeugc_list_videos to check status.'
      : 'Submit button not found — check /tmp/makeugc_seedance_before.png to debug'
  };
}

async function listVideos() {
  const page = await getPage();
  await page.goto('https://app.makeugc.ai/projects', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const videos = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('[class*="video"], article, [class*="card"]').forEach(card => {
      const title = card.querySelector('p, h3, h4, span')?.innerText?.trim();
      const status = card.querySelector('[class*="status"], [class*="badge"]')?.innerText?.trim();
      const link = card.querySelector('a')?.href;
      const img = card.querySelector('img')?.src;
      if (title || img) {
        results.push({ title: title || 'Untitled', status: status || 'unknown', link, thumbnail: img });
      }
    });
    return results;
  });

  return { count: videos.length, videos };
}

async function getVideoUrl(videoIndex = 0) {
  const page = await getPage();
  const videos = await page.evaluate(() => {
    return [...document.querySelectorAll('[class*="video"], article')].map(el => ({
      title: el.querySelector('p, span')?.innerText?.trim(),
      buttons: [...el.querySelectorAll('button, a')].map(b => b.innerText?.trim())
    }));
  });
  return videos[videoIndex] || null;
}

module.exports = { listActors, selectActor, setScript, createVideo, createImage, animateSeedance, listVideos, getVideoUrl };
