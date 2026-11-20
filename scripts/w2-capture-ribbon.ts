/**
 * W2-A evidence capture against the REAL Compose & Art route (dev server on :3000).
 * Headed Chrome for Testing via the global Playwright install (no new dependency).
 *
 * Captures per preset: scrubbed mid-song frame, two live-playback frames 0.4 s
 * apart, and the completed artwork. Also checks click + keyboard selection,
 * the Ribbon inspector block, Orbit still rendering, and Save SVG content.
 *
 * Run: node --import tsx scripts/w2-capture-ribbon.ts > docs/evidence/w2/ui-check.json
 */
import fs from 'node:fs';

const CHROMIUM = process.env.HG_CHROMIUM ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const URL = process.env.HG_URL ?? 'http://localhost:3000';
const OUT = 'docs/evidence/w2/screenshots';
const PRESETS = (process.env.HG_PRESETS ?? 'first-mark,glass-garden,ascending-light,pulse-study,leap-dialogue').split(',');

async function main() {
  const pw = await import('playwright');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch({ headless: false, executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), browser: browser.version(), presets: {}, checks: {}, pageErrors: errors };
  const presets = report.presets as Record<string, unknown>;
  const checks = report.checks as Record<string, unknown>;

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#composition-preset');
  const svg = page.locator('svg[role="img"]').first();
  const ribbonBtn = page.getByRole('button', { name: /^ribbon$/i });
  const segCount = () => page.locator('g[aria-label="Melodic ribbon"] path[role="button"]').count();
  const segSignature = () => page.locator('g[aria-label="Melodic ribbon"] path[role="button"]').evaluateAll((els) => els.map((e) => e.getAttribute('d')).join('|').length);
  const headPos = () => page.locator('g[aria-label="Melodic ribbon"] circle').evaluateAll((els) => els.map((e) => [e.getAttribute('cx'), e.getAttribute('cy')]));

  for (const id of PRESETS) {
    await page.selectOption('#composition-preset', id);
    await ribbonBtn.click();
    const span = Number(await page.locator('input[aria-label="Scrub song position"]').getAttribute('max'));
    const mid = Math.round(span * 0.55 * 2) / 2;
    await page.locator('input[aria-label="Scrub song position"]').fill(String(mid));
    await page.waitForTimeout(150);
    await svg.screenshot({ path: `${OUT}/${id}-scrub-beat${mid}.png` });
    const midSegments = await segCount();

    await page.getByRole('button', { name: /Play from start|Resume/ }).click();
    await page.waitForTimeout(900);
    const h1 = await headPos();
    await svg.screenshot({ path: `${OUT}/${id}-live-a.png` });
    await page.waitForTimeout(400);
    const h2 = await headPos();
    await svg.screenshot({ path: `${OUT}/${id}-live-b.png` });
    await page.getByRole('button', { name: /Pause/ }).click().catch(() => {});

    await page.getByRole('button', { name: 'Complete art' }).click();
    await page.waitForTimeout(150);
    await svg.screenshot({ path: `${OUT}/${id}-complete.png` });
    presets[id] = {
      totalBeats: span, scrubBeat: mid, segmentsAtScrub: midSegments,
      segmentsComplete: await segCount(), completeGeometrySize: await segSignature(),
      liveHeadA: h1, liveHeadB: h2, headMovedDuringPlayback: JSON.stringify(h1) !== JSON.stringify(h2) && h1.length > 0,
    };
  }

  // Selection by click and keyboard updates the Ribbon inspector (Leap Dialogue is loaded).
  const firstSeg = page.locator('g[aria-label="Melodic ribbon"] path[role="button"]').first();
  await firstSeg.click({ force: true });
  const inspector = page.getByLabel('Mathematics and source inspector');
  checks.clickSelectShowsMotionBlock = await inspector.getByText('Music → ribbon motion').isVisible().catch(() => false);
  checks.clickSelectedText = (await inspector.innerText()).split('\n').slice(0, 14).join(' | ');
  const third = page.locator('g[aria-label="Melodic ribbon"] path[role="button"]').nth(2);
  const thirdLabel = await third.getAttribute('aria-label');
  await third.focus();
  await page.keyboard.press('Enter');
  checks.keyboardSelectLabel = thirdLabel;
  checks.keyboardSelectedText = (await inspector.innerText()).split('\n').slice(0, 6).join(' | ');
  await svg.screenshot({ path: `${OUT}/leap-dialogue-selected.png` });

  // Save SVG contains the ribbon geometry.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save SVG/ }).click()]);
  const saved = fs.readFileSync(await download.path(), 'utf8');
  checks.savedSvgFilename = download.suggestedFilename();
  checks.savedSvgHasRibbonGroup = saved.includes('Melodic ribbon');
  checks.savedSvgRibbonPaths = (saved.match(/role="button"/g) ?? []).length;

  // Orbit (existing grammar) still renders arc marks.
  await page.getByRole('button', { name: /^orbit$/i }).click();
  await page.waitForTimeout(150);
  checks.orbitStillRenders = (await page.locator('svg[role="img"] path[stroke="transparent"]').count()) > 0 && (await segCount()) === 0;
  await svg.screenshot({ path: `${OUT}/leap-dialogue-orbit-baseline.png` });

  await browser.close();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
