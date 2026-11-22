/**
 * W2 evidence capture against the REAL Compose & Art route (dev server on :3000).
 * Headed Chrome for Testing via the global Playwright install (no new dependency;
 * loaded through a string import so this file still type-checks without its types).
 *
 * For Ribbon (baseline) and Current (candidate), per preset:
 *  - in-progress frame (scrubbed to 55 %) and completed artwork screenshots
 *  - live-motion check: two observations 0.3 s apart, BOTH while the Pause
 *    button is showing (playback active), BOTH with head positions, and a
 *    measured displacement > 1 px. Disappearance at the end is NOT movement.
 * Plus keyboard focus treatment, inspector, Save SVG, Orbit preservation and
 * an rAF frame-interval profile during playback (orbit / ribbon / current).
 *
 * Run: node --import tsx scripts/w2-capture-ribbon.ts > docs/evidence/w2/w2b-ui-check.json
 */
import fs from 'node:fs';

const CHROMIUM = process.env.HG_CHROMIUM ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const URL = process.env.HG_URL ?? 'http://localhost:3000';
const OUT = process.env.HG_OUT ?? 'docs/evidence/w2/w2c-screenshots';
const PRESETS = (process.env.HG_PRESETS ?? 'first-mark,glass-garden,ascending-light,pulse-study,leap-dialogue').split(',');
const GRAMMARS = (process.env.HG_GRAMMARS ?? 'ribbon,current,luminous').split(',');
const LAYER: Record<string, string> = { ribbon: 'Melodic ribbon', current: 'Melodic current', luminous: 'Melodic current luminous' };
const INSPECTOR: Record<string, string> = { ribbon: 'Music → ribbon motion', current: 'Music → current motion', luminous: 'Music → current motion' };
const MIN_DISPLACEMENT_PX = 1;

type Head = [number, number];
interface Observation { playing: boolean; heads: Head[]; atMs: number }

async function main() {
  const moduleName = 'playwright';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pw: any = await import(moduleName);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch({ headless: false, executablePath: CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e: unknown) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  const report: Record<string, any> = { generatedAt: new Date().toISOString(), browser: browser.version(), minDisplacementPx: MIN_DISPLACEMENT_PX, runs: {}, checks: {}, frameProfile: {}, pageErrors: errors };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#composition-preset');
  const svg = page.locator('svg[role="img"]').first();
  const layer = (g: string) => page.locator(`g[aria-label="${LAYER[g]}"]`);
  const pauseVisible = async () => (await page.getByRole('button', { name: /^Pause$/ }).count()) > 0;
  const observe = async (g: string): Promise<Observation> => ({
    playing: await pauseVisible(),
    heads: (await layer(g).locator(':scope > circle').evaluateAll((els: Element[]) => els.map((e) => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))]))) as Head[],
    atMs: Date.now(),
  });

  // Warm up audio once so the first measured Play is not the session's first audio start.
  await page.getByRole('button', { name: /Play from start|Resume/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Pause$/ }).click().catch(() => {});

  for (const g of GRAMMARS) {
    for (const id of PRESETS) {
      await page.selectOption('#composition-preset', id);
      await page.getByRole('button', { name: new RegExp(`^${g}$`, 'i') }).click();
      const scrub = page.locator('input[aria-label="Scrub song position"]');
      const span = Number(await scrub.getAttribute('max'));
      const mid = Math.round(span * 0.55 * 2) / 2;
      await scrub.fill(String(mid));
      await page.waitForTimeout(150);
      await svg.screenshot({ path: `${OUT}/${id}-${g}-progress-beat${mid}.png` });
      const progressParts = await layer(g).locator('path').count();
      await page.getByRole('button', { name: 'Complete art' }).click();
      await page.waitForTimeout(150);
      await svg.screenshot({ path: `${OUT}/${id}-${g}-complete.png` });
      const notePaths = await layer(g).locator('path[role="button"]').count();
      const restPaths = await layer(g).locator('path[aria-hidden="true"]').count();

      // Live motion: restart from beat 0, observe twice while playing.
      await page.getByRole('button', { name: 'Clear painting' }).click();
      await page.getByRole('button', { name: /Play from start|Resume/ }).click();
      await page.waitForTimeout(350);
      const a = await observe(g);
      await page.waitForTimeout(300);
      const b = await observe(g);
      await page.getByRole('button', { name: /^Pause$/ }).click().catch(() => {});
      const valid = a.playing && b.playing && a.heads.length > 0 && a.heads.length === b.heads.length;
      const displacement = valid ? Math.max(...a.heads.map((h, i) => Math.hypot(b.heads[i][0] - h[0], b.heads[i][1] - h[1]))) : null;
      report.runs[`${g}/${id}`] = {
        totalBeats: span, progressBeat: mid, pathsAtProgress: progressParts, notePathsComplete: notePaths, restBridgesComplete: restPaths,
        observationA: a, observationB: b, validObservationPair: valid, headDisplacementPx: displacement,
        headMovedDuringPlayback: valid && displacement !== null && displacement > MIN_DISPLACEMENT_PX,
      };
    }
  }

  // Keyboard focus treatment + inspector, Leap Dialogue, both grammars.
  await page.selectOption('#composition-preset', 'leap-dialogue');
  for (const g of GRAMMARS) {
    await page.getByRole('button', { name: new RegExp(`^${g}$`, 'i') }).click();
    await page.getByRole('button', { name: 'Complete art' }).click();
    const seg = layer(g).locator('path[role="button"]').nth(2);
    await page.keyboard.press('Tab'); // establish keyboard modality so :focus-visible applies
    await seg.focus();
    const focusStyle = await page.evaluate(() => { const el = document.activeElement as SVGElement; const cs = getComputedStyle(el); return { label: el.getAttribute('aria-label'), outlineStyle: cs.outlineStyle, stroke: cs.stroke, strokeDasharray: cs.strokeDasharray, strokeWidth: cs.strokeWidth, focusVisible: el.matches(':focus-visible') }; });
    await svg.screenshot({ path: `${OUT}/leap-dialogue-${g}-keyboard-focus.png` });
    await page.keyboard.press('Enter');
    const inspector = page.getByLabel('Mathematics and source inspector');
    const heading = INSPECTOR[g];
    report.checks[`${g}KeyboardFocus`] = focusStyle;
    report.checks[`${g}InspectorShown`] = await inspector.getByText(heading).isVisible().catch(() => false);
    report.checks[`${g}InspectorText`] = (await inspector.innerText()).split('\n').slice(0, 30).join(' | ');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save SVG/ }).click()]);
    const saved = fs.readFileSync(await download.path(), 'utf8');
    report.checks[`${g}SavedSvg`] = { file: download.suggestedFilename(), hasLayer: saved.includes(`aria-label="${LAYER[g]}"`), notePaths: (saved.match(/role="button"/g) ?? []).length, bytes: saved.length };
  }

  // Multi-voice coupling example: Luminous, counterline note selected, inspector shows its coupling.
  if (GRAMMARS.includes('luminous')) {
    await page.selectOption('#composition-preset', 'leap-dialogue');
    await page.getByRole('button', { name: /^luminous$/i }).click();
    await page.getByRole('button', { name: 'Complete art' }).click();
    // Select by keyboard (focus + Enter): a pointer click at a long segment's box centre can land on the other voice.
    await layer('luminous').locator('path[role="button"][aria-label*="counter"]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    await svg.screenshot({ path: `${OUT}/coupling-leap-dialogue-luminous-counter-selected.png` });
    await page.getByLabel('Mathematics and source inspector').screenshot({ path: `${OUT}/coupling-leap-dialogue-inspector.png` });
    report.checks.couplingInspectorText = (await page.getByLabel('Mathematics and source inspector').innerText()).split('\n').filter((l: string) => /semitones|consonance|pull|Coupling|Pitch vs|Steers/.test(l)).join(' | ');

    // Controlled pitch edit through the real score editor: Glass Garden lead-5 (B4, beat 5) → E5 (+5 semitones).
    await page.selectOption('#composition-preset', 'glass-garden');
    await page.getByRole('button', { name: 'Complete art' }).click();
    await svg.screenshot({ path: `${OUT}/edit-glass-garden-luminous-before.png` });
    const before = await layer('luminous').locator('path[role="button"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('d')));
    await page.getByRole('button', { name: 'Select and hear B4 at beat 5' }).click();
    await page.getByLabel('Selected note pitch').selectOption({ label: 'E5' });
    await page.getByRole('button', { name: 'Complete art' }).click();
    await page.waitForTimeout(150);
    await svg.screenshot({ path: `${OUT}/edit-glass-garden-luminous-after-B4-to-E5.png` });
    const after = await layer('luminous').locator('path[role="button"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('d')));
    report.checks.pitchEdit = { note: 'lead-5 B4→E5 (+5)', segmentsBefore: before.length, segmentsAfter: after.length, segmentsChanged: before.filter((d: string, i: number) => d !== after[i]).length };
    await page.selectOption('#composition-preset', 'glass-garden'); // restore preset
  }

  await page.getByRole('button', { name: /^orbit$/i }).click();
  await page.waitForTimeout(150);
  report.checks.orbitStillRenders = (await page.locator('svg[role="img"] path[stroke="transparent"]').count()) > 0;

  // rAF frame intervals during playback (Glass Garden ≈ 8.6 s), per grammar.
  await page.selectOption('#composition-preset', 'glass-garden');
  for (const g of ['orbit', ...GRAMMARS]) {
    await page.getByRole('button', { name: new RegExp(`^${g}$`, 'i') }).click();
    await page.getByRole('button', { name: 'Clear painting' }).click();
    await page.getByRole('button', { name: /Play from start|Resume/ }).click();
    await page.waitForTimeout(300);
    // Passed as a string: tsx-transformed closures reference a __name helper that does not exist in the page.
    const intervals: number[] = await page.evaluate(`new Promise((resolve) => {
      const out = []; let last = performance.now();
      function tick(now) { out.push(now - last); last = now; if (out.length < 240) requestAnimationFrame(tick); else resolve(out); }
      requestAnimationFrame(tick);
    })`);
    const playingAtEnd = await pauseVisible();
    await page.getByRole('button', { name: /^Pause$/ }).click().catch(() => {});
    const sorted = intervals.slice(1).sort((x, y) => x - y);
    const q = (p: number) => +sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)))].toFixed(2);
    report.frameProfile[g] = { frames: sorted.length, p50ms: q(50), p95ms: q(95), p99ms: q(99), maxMs: +sorted.at(-1)!.toFixed(2), over20ms: sorted.filter((x) => x > 20).length, playingThroughout: playingAtEnd };
  }

  await browser.close();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
