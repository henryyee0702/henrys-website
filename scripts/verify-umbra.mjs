/* global process, document, window, fetch, getComputedStyle */
import { chromium, devices } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_URL = process.env.UMBRA_TEST_URL || 'http://localhost:4173';
const PASSWORD = process.env.UMBRA_PASSWORD;
const OUTPUT_DIR = path.join(ROOT, 'test-results', 'umbra-collapse-v2');
const selectedScenarios = new Set(process.argv.slice(2));
const validScenarios = new Set(['desktop', 'mobile', 'landscape', 'tablet']);
const unknownScenarios = [...selectedScenarios].filter((scenario) => !validScenarios.has(scenario));
if (unknownScenarios.length > 0) {
  throw new Error(`Unknown verification scenario(s): ${unknownScenarios.join(', ')}`);
}
const shouldRun = (name) => selectedScenarios.size === 0 || selectedScenarios.has(name);

if (!PASSWORD) throw new Error('UMBRA_PASSWORD is required for the archive verification');

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const attachDiagnostics = (page, label) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith(BASE_URL)) errors.push(`requestfailed: ${request.failure()?.errorText || 'unknown'} ${url}`);
  });
  return () => {
    const actionable = errors.filter((entry) => !entry.includes('favicon'));
    assert(actionable.length === 0, `${label} emitted browser errors:\n${actionable.join('\n')}`);
  };
};

const openSunArticle = async (page) => {
  await page.goto(`${BASE_URL}/#fulbright-galaxy`, { waitUntil: 'networkidle' });
  const section = page.locator('#fulbright-galaxy');
  await section.scrollIntoViewIfNeeded();
  const sun = page.locator('[data-planet-body="1"]');
  await sun.waitFor({ state: 'attached' });
  await sun.click({ force: true, position: { x: 8, y: 8 } });
  const probe = page.locator('[data-umbra-probe]');
  await probe.waitFor({ state: 'visible' });
  await page.waitForTimeout(950);
  return probe;
};

const triggerWithKeyboard = async (page, probe) => {
  await probe.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.down(' ');
  await page.waitForTimeout(160);
  await page.keyboard.up(' ');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(7300);
  if (await page.locator('.umbra-experience').count() === 0) {
    const debug = await page.evaluate(() => ({
      state: document.querySelector('[data-umbra-probe]')?.getAttribute('data-probe-state'),
      time: document.querySelector('.umbra-probe__telemetry span')?.textContent,
      probe: document.querySelector('[data-umbra-probe]')?.getBoundingClientRect().toJSON(),
      probeStyle: document.querySelector('[data-umbra-probe]')?.getAttribute('style'),
      target: document.querySelector('[data-planet-body="1"]')?.getBoundingClientRect().toJSON(),
      section: document.querySelector('#fulbright-galaxy')?.getBoundingClientRect().toJSON(),
      bodies: document.querySelectorAll('[data-planet-body]').length,
    }));
    throw new Error(`Short Space followed by Enter did not launch: ${JSON.stringify(debug)}`);
  }
  await page.locator('.umbra-experience').waitFor({ state: 'visible' });
};

const triggerWithDrag = async (page, probe) => {
  const probeBox = await probe.boundingBox();
  const targetBox = await page.locator('[data-umbra-target="sun"]').boundingBox();
  assert(probeBox && targetBox, 'Mobile probe or SUN target is missing');
  const start = { x: probeBox.x + probeBox.width / 2, y: probeBox.y + probeBox.height / 2 };
  const target = { x: targetBox.x + Math.max(1, targetBox.width * 0.06), y: targetBox.y + targetBox.height / 2 };
  assert(target.x < start.x, 'Mobile regression fixture must drag the probe left');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 24 });
  await page.waitForTimeout(7200);
  await page.mouse.up();
  await page.locator('.umbra-experience').waitFor({ state: 'visible' });
};

const assertGateFits = async (page, label) => {
  const overlay = page.locator('.umbra-experience');
  await overlay.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.umbra-experience')?.getAttribute('data-phase') === 'gate');
  await page.waitForTimeout(1250);
  const gate = page.locator('[data-umbra-gate]');
  const box = await gate.boundingBox();
  const viewport = page.viewportSize();
  assert(box && viewport, `${label}: gate geometry is unavailable`);
  assert(box.x >= -1 && box.y >= -1, `${label}: gate begins outside the viewport`);
  assert(box.x + box.width <= viewport.width + 1, `${label}: gate overflows horizontally`);
  assert(box.y + box.height <= viewport.height + 1, `${label}: gate overflows vertically`);
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  assert(overflow.x <= 1, `${label}: document has ${overflow.x}px horizontal overflow`);
  return { box, viewport, layout: await overlay.getAttribute('data-layout') };
};

const runDesktopArchive = async () => {
  const context = await browser.newContext({ viewport: { width: 1676, height: 939 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const assertNoErrors = attachDiagnostics(page, 'desktop');
  const probe = await openSunArticle(page);
  await page.locator('#fulbright-galaxy').evaluate((section) => { section.style.top = '-120px'; });
  await page.waitForTimeout(120);
  const sectionTop = await page.locator('#fulbright-galaxy').evaluate((section) => section.getBoundingClientRect().top);
  const sourceSun = await page.locator('[data-planet-body="1"]').boundingBox();
  assert(sectionTop < -80, `Desktop fixed-overlay fixture did not offset the section (${sectionTop})`);
  assert(sourceSun, 'Desktop source Sun geometry is unavailable');
  await triggerWithKeyboard(page, probe);
  const triggerOrigin = await page.locator('.umbra-experience').evaluate((element) => ({
    x: Number.parseFloat(element.style.getPropertyValue('--umbra-x')),
    y: Number.parseFloat(element.style.getPropertyValue('--umbra-y')),
  }));
  const initialViewport = page.viewportSize();
  assert(initialViewport, 'Desktop viewport geometry is unavailable');
  const expectedTrigger = {
    x: ((sourceSun.x + sourceSun.width / 2) / initialViewport.width) * 100,
    y: ((sourceSun.y + sourceSun.height / 2) / initialViewport.height) * 100,
  };
  assert(
    Math.abs(triggerOrigin.x - expectedTrigger.x) < 0.5 && Math.abs(triggerOrigin.y - expectedTrigger.y) < 0.5,
    `Fixed overlay origin drifted from the source Sun: ${JSON.stringify({ triggerOrigin, expectedTrigger, sectionTop })}`,
  );
  await page.waitForTimeout(1450);
  const collapseText = await page.locator('.umbra-collapse-copy').textContent();
  assert(collapseText?.includes('ORBITAL DECAY'), 'Desktop collapse telemetry is missing');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-collapse-1676x939.png') });
  await page.waitForTimeout(1250);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-collapse-tidal-1676x939.png') });
  const gate = await assertGateFits(page, 'desktop');
  assert(gate.layout === 'split', `Desktop expected split layout, received ${gate.layout}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-gate-1676x939.png') });
  const visualDiagnostics = await page.evaluate(() => {
    const film = document.querySelector('.umbra-film-plate');
    return {
      gateCount: document.querySelectorAll('[data-umbra-gate]').length,
      filmBox: film?.getBoundingClientRect().toJSON(),
      filmOverflow: film ? getComputedStyle(film).overflow : null,
      filmWidth: film ? getComputedStyle(film).width : null,
    };
  });
  await page.locator('.umbra-film-plate').evaluate((film) => { film.style.display = 'none'; });
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-gate-no-film.png') });
  await page.locator('.umbra-film-plate').evaluate((film) => { film.style.display = ''; });
  await page.setViewportSize({ width: 2560, height: 1440 });
  const wideGate = await assertGateFits(page, 'desktop-wide-resize');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'desktop-gate-wide-2560x1440.png') });
  await page.setViewportSize({ width: 1676, height: 939 });
  await assertGateFits(page, 'desktop-restored');

  await page.locator('#umbra-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'STABILIZE' }).click();
  await page.waitForURL('**/api/umbra', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  const coverButton = page.locator('#coverBtn');
  if (await coverButton.isVisible()) await coverButton.click({ force: true });
  const envelope = page.locator('#envelope');
  await envelope.waitFor({ state: 'visible' });
  await envelope.click({ force: true });
  await page.locator('#cardScene').waitFor({ state: 'visible', timeout: 6000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), null, { timeout: 10000 });

  const images = await page.locator('img').evaluateAll((nodes) => nodes.map((image) => ({
    src: image.getAttribute('src'),
    complete: image.complete,
    naturalWidth: image.naturalWidth,
  })));
  assert(images.length >= 6, `Archive expected at least six images, received ${images.length}`);
  const broken = images.filter((image) => !image.complete || image.naturalWidth <= 0);
  assert(broken.length === 0, `Archive contains broken images: ${JSON.stringify(broken)}`);
  const signedSource = images.find((image) => image.src?.includes('asset='))?.src;
  assert(signedSource?.includes('&sig='), 'Archive assets are not using signed URLs');

  await context.clearCookies();
  const signedStatus = await page.evaluate(async (source) => (await fetch(source, { cache: 'no-store' })).status, signedSource);
  assert(signedStatus === 200, `Signed asset failed without the session cookie (${signedStatus})`);
  assertNoErrors();
  results.push({ name: 'desktop + archive', gate, wideGate, images: images.length, signedStatus, visualDiagnostics });
  await context.close();
};

const runMobile = async () => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const assertNoErrors = attachDiagnostics(page, 'mobile');
  const probe = await openSunArticle(page);
  await triggerWithDrag(page, probe);
  await page.waitForTimeout(1350);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-collapse-390x844.png') });
  await page.setViewportSize({ width: 430, height: 760 });
  const gate = await assertGateFits(page, 'mobile-resized');
  assert(gate.layout === 'stack', `Mobile expected stack layout, received ${gate.layout}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-gate-resized-430x760.png') });
  await page.setViewportSize({ width: 320, height: 568 });
  const narrowGate = await assertGateFits(page, 'mobile-narrow');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'mobile-gate-320x568.png') });
  assertNoErrors();
  results.push({ name: 'mobile drag + resize', gate, narrowGate });
  await context.close();
};

const runLandscapePhone = async () => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const assertNoErrors = attachDiagnostics(page, 'landscape phone');
  const probe = await openSunArticle(page);
  await triggerWithKeyboard(page, probe);
  const gate = await assertGateFits(page, 'landscape phone');
  assert(gate.layout === 'compact-landscape', `Landscape phone expected compact layout, received ${gate.layout}`);
  const tier = await page.locator('.umbra-experience').getAttribute('data-gpu-tier');
  assert(tier !== 'full', `Landscape phone should not run the full GPU tier (${tier})`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'landscape-gate-844x390.png') });
  assertNoErrors();
  results.push({ name: 'landscape phone', gate, tier });
  await context.close();
};

const runTabletRotation = async () => {
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const assertNoErrors = attachDiagnostics(page, 'tablet');
  const probe = await openSunArticle(page);
  await triggerWithKeyboard(page, probe);
  await page.waitForTimeout(1200);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'tablet-collapse-after-rotation.png') });
  const gate = await assertGateFits(page, 'tablet rotated');
  assert(gate.layout === 'split', `Rotated tablet expected split layout, received ${gate.layout}`);
  assertNoErrors();
  results.push({ name: 'tablet rotation during collapse', gate });
  await context.close();
};

try {
  if (shouldRun('desktop')) await runDesktopArchive();
  if (shouldRun('mobile')) await runMobile();
  if (shouldRun('landscape')) await runLandscapePhone();
  if (shouldRun('tablet')) await runTabletRotation();
  await fs.writeFile(path.join(OUTPUT_DIR, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
} finally {
  await browser.close();
}
