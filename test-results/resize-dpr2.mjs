import { chromium } from 'playwright';

const browser = await chromium.launch();

// DPR 2 = real retina Mac
const ctx = await browser.newContext({ 
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2
});
const page = await ctx.newPage();
await page.goto('http://localhost:4322/');
await page.waitForTimeout(2000);

await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(1000);

// Fresh at 375px with DPR 2
await page.setViewportSize({ width: 375, height: 900 });
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/dpr2-fresh-375.png', fullPage: false });

// Resize sequence: 375 → 1400 → 375 (rapid)
for (let w = 375; w <= 1400; w += 50) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(30);
}
for (let w = 1400; w >= 375; w -= 50) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(30);
}
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(50);
await page.screenshot({ path: 'test-results/dpr2-resize-375-50ms.png', fullPage: false });
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/dpr2-resize-375-settled.png', fullPage: false });

// Jump to 1200
await page.setViewportSize({ width: 1200, height: 900 });
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/dpr2-resize-1200-settled.png', fullPage: false });

await browser.close();
console.log('DPR 2 test done!');
