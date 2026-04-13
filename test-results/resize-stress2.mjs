import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4322/');
await page.waitForTimeout(2000);

// Scroll to liquid-statement section
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(1000);

// Capture baseline
await page.screenshot({ path: 'test-results/rs-baseline-1400.png', fullPage: false });

// Rapid resize: 1400 → 500 in 50px steps, 60ms intervals (aggressive)
for (let w = 1400; w >= 500; w -= 50) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(60);
}

// Scroll back to section (may have shifted)
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(100);
await page.screenshot({ path: 'test-results/rs-shrink-500.png', fullPage: false });

// Rapid expand back: 500 → 1400
for (let w = 500; w <= 1400; w += 50) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(60);
}
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(100);
await page.screenshot({ path: 'test-results/rs-expand-1400.png', fullPage: false });

// Extreme instant jump: 1400 → 375
await page.setViewportSize({ width: 375, height: 900 });
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(50);
await page.screenshot({ path: 'test-results/rs-jump-375-50ms.png', fullPage: false });
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/rs-jump-375-settled.png', fullPage: false });

// Jump back: 375 → 1400
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(50);
await page.screenshot({ path: 'test-results/rs-jump-1400-50ms.png', fullPage: false });
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/rs-jump-1400-settled.png', fullPage: false });

await browser.close();
console.log('Resize stress test v2 complete!');
