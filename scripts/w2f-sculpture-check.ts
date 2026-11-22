/**
 * W2-F: static Leap Dialogue sculpture in the REAL Compose & Art route (dev server on :3000),
 * headed Chrome for Testing via the global Playwright install (string import keeps this file
 * type-checkable without Playwright types).
 *
 * For 'relief' and 'separated': front / side / oblique screenshots with auto-rotate off,
 * the anchor labels and their note IDs, and rotation AFTER playback ends (auto-rotate and drag).
 *
 * Run: node --import tsx scripts/w2f-sculpture-check.ts > docs/evidence/w2/w2f-sculpture-check.json
 */
import fs from 'node:fs';

const CHROMIUM = process.env.HG_CHROMIUM ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const URL = process.env.HG_URL ?? 'http://localhost:3000';
const OUT = process.env.HG_OUT ?? 'docs/evidence/w2/w2f-screenshots';

async function main() {
  const moduleName = 'playwright';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pw: any = await import(moduleName);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch({ headless: false, executablePath: CHROMIUM });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: unknown) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report: Record<string, any> = { generatedAt: new Date().toISOString(), browser: browser.version(), viewport: '1500x1000', depths: {}, checks: {}, pageErrors: errors };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#composition-preset');
  await page.selectOption('#composition-preset', 'leap-dialogue');
  await page.getByRole('button', { name: '3D sculpture' }).click();
  const host = page.locator('[role="img"][aria-label^="3D sculpture"]');
  const frameBox = host.locator('xpath=..'); // host + labels + controls
  await host.waitFor();
  await page.waitForFunction(`document.querySelector('[aria-label^="3D sculpture"]')?.dataset.ready === '1'`);
  const angles = async () => ({ azimuth: Number(await host.getAttribute('data-azimuth')), polar: Number(await host.getAttribute('data-polar')) });
  const autoBtn = page.getByRole('button', { name: /Auto-rotate (on|off)/ });
  const setAuto = async (on: boolean) => { const label = await autoBtn.innerText(); if (/on/.test(label) !== on) await autoBtn.click(); };

  for (const depth of ['relief', 'separated'] as const) {
    await page.getByRole('button', { name: depth === 'relief' ? 'Relief' : 'Separated', exact: true }).click();
    await page.waitForFunction(`document.querySelector('[aria-label^="3D sculpture"]')?.dataset.depth === '${depth}'`);
    await page.waitForTimeout(300);
    await setAuto(false);
    const views: Record<string, unknown> = {};
    for (const v of ['front', 'side', 'oblique']) {
      await page.getByRole('button', { name: v, exact: true }).click();
      await page.waitForTimeout(900); // damping settles
      await frameBox.screenshot({ path: `${OUT}/leap-dialogue-${depth}-${v}.png` });
      views[v] = await angles();
    }
    const anchors = await page.locator('[data-anchor-beat]').evaluateAll((els: Element[]) => els.map((e) => ({ beat: Number(e.getAttribute('data-anchor-beat')), noteIds: e.getAttribute('data-note-ids'), label: (e.textContent ?? '').trim() })));
    report.depths[depth] = { views, anchors, ariaLabel: await host.getAttribute('aria-label') };
  }

  // Rotation after playback ends (separated is current).
  await setAuto(true);
  await page.getByRole('button', { name: /Play from start|Resume/ }).click();
  let sawPlaying = false;
  for (let i = 0; i < 60; i++) {
    const pausing = (await page.getByRole('button', { name: /^Pause$/ }).count()) > 0;
    if (pausing) sawPlaying = true;
    if (sawPlaying && !pausing) break;
    await page.waitForTimeout(200);
  }
  const ended = sawPlaying && (await page.getByRole('button', { name: /Play from start/ }).count()) > 0;
  const a1 = await angles(); await page.waitForTimeout(1500); const a2 = await angles();
  await setAuto(false); await page.waitForTimeout(500);
  const d1 = await angles();
  const box = await host.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.45, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(900);
  const d2 = await angles();
  const azDelta = (x: number, y: number) => { const d = Math.abs(y - x) % 360; return Math.min(d, 360 - d); };
  report.checks.rotationAfterPlayback = {
    playbackObservedThenEnded: ended,
    autoRotateAzimuthChangeDeg: +azDelta(a1.azimuth, a2.azimuth).toFixed(2), autoRotateWorks: azDelta(a1.azimuth, a2.azimuth) > 1,
    dragAzimuthChangeDeg: +azDelta(d1.azimuth, d2.azimuth).toFixed(2), dragRotateWorks: azDelta(d1.azimuth, d2.azimuth) > 5,
  };
  await frameBox.screenshot({ path: `${OUT}/leap-dialogue-separated-after-playback-dragged.png` });
  // Return to 2D: the SVG artwork is still there.
  await page.getByRole('button', { name: '2D artwork' }).click();
  report.checks.backTo2dSvgVisible = await page.locator('svg[role="img"]').first().isVisible();
  await browser.close();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
