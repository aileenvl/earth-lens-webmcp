#!/usr/bin/env node
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run check:performance -- <URL>");
  process.exit(2);
}

const options = new chrome.Options()
  .addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage")
  .windowSize({ width: 1440, height: 900 });
const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();

try {
  await driver.sendDevToolsCommand("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__earthLensVitals = { lcp: 0, cls: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__earthLensVitals.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__earthLensVitals.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    `,
  });
  await driver.get(url);
  await driver.sleep(3000);
  const metrics = await driver.executeScript("return window.__earthLensVitals");
  const lcp = Number(metrics?.lcp ?? 0);
  const cls = Number(metrics?.cls ?? 0);

  console.log(JSON.stringify({ url, lcpMs: Math.round(lcp), cls }, null, 2));
  if (lcp === 0 || lcp > 2500 || cls > 0.1) process.exitCode = 1;
} finally {
  await driver.quit();
}
