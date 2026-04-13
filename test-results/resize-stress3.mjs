import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4322/');
await page.waitForTimeout(2000);

// Scroll to section
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(1000);

// Aggressive: rapid 1400→400 in 20px steps, 30ms intervals
for (let w = 1400; w >= 400; w -= 20) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(30);
}
// Capture DURING resize sequence at 400px
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(30);
await page.screenshot({ path: 'test-results/rs3-mid-400.png', fullPage: false });

// Continue shrinking to 375
for (let w = 400; w >= 375; w -= 5) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(20);
}
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(20);
await page.screenshot({ path: 'test-results/rs3-375-20ms.png', fullPage: false });

// Wait 500ms then capture fully settled
await page.waitForTimeout(500);
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.screenshot({ path: 'test-results/rs3-375-settled.png', fullPage: false });

// Instant jump back to 1200
await page.setViewportSize({ width: 1200, height: 900 });
await page.evaluate(() => {
  document.querySelector('#liquid-statement')?.scrollIntoView({ behavior: 'instant', block: 'start' });
});
await page.waitForTimeout(30);
await page.screenshot({ path: 'test-results/rs3-jump-1200-30ms.png', fullPage: false });
await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/rs3-jump-1200-settled.png', fullPage: false });

await browser.close();
console.log('Stress test v3 done!');
