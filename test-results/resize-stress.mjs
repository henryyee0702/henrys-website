import { chromium } from 'playwright-core';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:4322/#liquid-statement');
await page.waitForTimeout(2000);

// Simulate rapid resize: 1400 → 600 in 100px steps with 80ms intervals
const sizes = [];
for (let w = 1400; w >= 600; w -= 100) sizes.push(w);
for (let w = 600; w <= 1400; w += 100) sizes.push(w);

for (const w of sizes) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(80);
}

// Capture right after rapid resize sequence
await page.screenshot({ path: 'test-results/resize-stress-after.png', fullPage: false });
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/resize-stress-settled.png', fullPage: false });

// Extreme jump: 1400 → 375 instantly
await page.setViewportSize({ width: 375, height: 900 });
await page.waitForTimeout(50);
await page.screenshot({ path: 'test-results/resize-stress-extreme-50ms.png', fullPage: false });
await page.waitForTimeout(250);
await page.screenshot({ path: 'test-results/resize-stress-extreme-settled.png', fullPage: false });

await browser.close();
console.log('Resize stress test complete!');
