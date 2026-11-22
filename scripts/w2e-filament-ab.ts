/**
 * W2-E A/B capture: Filament (W2-D baseline) vs Filament II (volume variant) in the REAL
 * Compose & Art route (dev server on :3000), headed Chrome for Testing via the global Playwright
 * install (string import keeps this file type-checkable without Playwright types).
 *
 * Same viewport, same beats, same framing (group transforms compared) for both styles.
 * Also: live motion, determinism (repeat SVG export byte-equality), mouse + keyboard selection,
 * SVG export, fixed-view Glass Garden B4 → E5 edit, and rAF frame intervals during playback.
 *
 * Run: node --import tsx scripts/w2e-filament-ab.ts > docs/evidence/w2/w2e-ab-check.json
 */
import fs from 'node:fs';

const CHROMIUM = process.env.HG_CHROMIUM ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const URL = process.env.HG_URL ?? 'http://localhost:3000';
const OUT = process.env.HG_OUT ?? 'docs/evidence/w2/w2e-screenshots';
const PRESETS = (process.env.HG_PRESETS ?? 'first-mark,glass-garden,ascending-light,pulse-study,leap-dialogue').split(',');
/** HG_PROFILE_ONLY=1: fresh browser, frame-interval profile only (separates render cost from session load). */
const PROFILE_ONLY = process.env.HG_PROFILE_ONLY === '1';
/** Sort each element's attributes: React may order an attribute differently after an update vs a fresh mount. */
const normaliseSvg = (svg: string) => svg.replace(/<([a-zA-Z]+)((?:\s+[^\s=>\/]+="[^"]*")*)\s*(\/?)>/g, (_m: string, tag: string, attrs: string, close: string) => `<${tag} ${(attrs.match(/[^\s=]+="[^"]*"/g) ?? []).sort().join(' ')}${close}>`);
type FirstPoint = { label: string | null; m: number[] };
const STYLES = [
  { id: 'filament', button: /^filament$/i, layer: 'Melodic current filament', short: 'w2d' },
  { id: 'filament2', button: /^filament ii$/i, layer: 'Melodic current filament volume', short: 'w2e' },
] as const;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report: Record<string, any> = { generatedAt: new Date().toISOString(), browser: browser.version(), viewport: '1500x1000', framing: {}, runs: {}, checks: {}, frameProfile: {}, pageErrors: errors };
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#composition-preset');
  const svg = page.locator('svg[role="img"]').first();
  const group = (layer: string) => page.locator(`g[aria-label="${layer}"]`);
  const transformOf = (layer: string) => group(layer).getAttribute('transform');
  const pause = () => page.getByRole('button', { name: /^Pause$/ }).click().catch(() => {});
  const inspectorText = async () => (await page.getByLabel('Mathematics and source inspector').innerText()).split('\n').slice(0, 6).join(' | ');

  await page.getByRole('button', { name: /Play from start|Resume/ }).click(); // warm up audio
  await page.waitForTimeout(800);
  await pause();

  if (!PROFILE_ONLY) for (const st of STYLES) {
    for (const id of PRESETS) {
      await page.selectOption('#composition-preset', id);
      await page.getByRole('button', { name: st.button }).click();
      const scrub = page.locator('input[aria-label="Scrub song position"]');
      const span = Number(await scrub.getAttribute('max'));
      const mid = Math.round(span * 0.55 * 2) / 2;
      await scrub.fill(String(mid));
      await page.waitForTimeout(150);
      await svg.screenshot({ path: `${OUT}/${id}-${st.short}-progress-beat${mid}.png` });
      const tProgress = await transformOf(st.layer);
      await page.getByRole('button', { name: 'Complete art' }).click();
      await page.waitForTimeout(150);
      await svg.screenshot({ path: `${OUT}/${id}-${st.short}-complete.png` });
      const tComplete = await transformOf(st.layer);
      (report.framing[id] ??= {})[st.short] = { progressBeat: mid, transformProgress: tProgress, transformComplete: tComplete };

      await page.getByRole('button', { name: 'Clear painting' }).click();
      await page.getByRole('button', { name: /Play from start|Resume/ }).click();
      await page.waitForTimeout(350);
      const heads = () => group(st.layer).locator(':scope > circle').evaluateAll((els: Element[]) => els.map((e) => [Number(e.getAttribute('cx')), Number(e.getAttribute('cy'))]));
      const a = { playing: (await page.getByRole('button', { name: /^Pause$/ }).count()) > 0, heads: await heads() };
      await page.waitForTimeout(300);
      const b = { playing: (await page.getByRole('button', { name: /^Pause$/ }).count()) > 0, heads: await heads() };
      await pause();
      const valid = a.playing && b.playing && a.heads.length > 0 && a.heads.length === b.heads.length;
      const disp = valid ? Math.max(...a.heads.map((h: number[], i: number) => Math.hypot(b.heads[i][0] - h[0], b.heads[i][1] - h[1]))) : null;
      report.runs[`${st.short}/${id}`] = { valid, headDisplacementPx: disp, moved: valid && disp !== null && disp > 1 };
    }
  }
  if (!PROFILE_ONLY) report.checks.framingIdentical = Object.fromEntries(Object.entries(report.framing).map(([id, v]: [string, any]) => [id, v.w2d.transformComplete === v.w2e.transformComplete && v.w2d.transformProgress === v.w2e.transformProgress]));

  // Selection (mouse + keyboard), determinism and export on Leap Dialogue.
  if (!PROFILE_ONLY) for (const st of STYLES) {
    await page.selectOption('#composition-preset', 'leap-dialogue');
    await page.getByRole('button', { name: st.button }).click();
    await page.getByRole('button', { name: 'Complete art' }).click();
    await page.waitForTimeout(150);
    const target = group(st.layer).locator('path[role="button"][aria-label^="Inspect G3, beat 3.0, counter"]');
    // Interior point of the thin note polygon: midpoint of its outline at 25 % and 75 % length.
    const pick = await target.evaluate((el: SVGPathElement) => {
      for (const [f1, f2] of [[0.25, 0.75], [0.2, 0.8], [0.3, 0.7], [0.15, 0.85]]) {
        const L = el.getTotalLength(); const p = el.getPointAtLength(L * f1), q = el.getPointAtLength(L * f2);
        const m = el.getScreenCTM()!; const pt = new DOMPoint((p.x + q.x) / 2, (p.y + q.y) / 2).matrixTransform(m);
        if (document.elementFromPoint(pt.x, pt.y) === el) return { x: pt.x, y: pt.y, hit: true };
      }
      return { x: 0, y: 0, hit: false };
    });
    if (pick.hit) await page.mouse.click(pick.x, pick.y);
    const mouseText = await inspectorText();
    await page.keyboard.press('Tab');
    await group(st.layer).locator('path[role="button"][aria-label^="Inspect E5, beat 3.0, lead"]').focus();
    await page.keyboard.press('Enter');
    const keyText = await inspectorText();
    const exports: string[] = [];
    for (let i = 0; i < 2; i++) {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save SVG/ }).click()]);
      exports.push(fs.readFileSync(await dl.path(), 'utf8'));
      if (i === 0) report.checks[`${st.short}SvgFile`] = dl.suggestedFilename();
    }
    await page.getByRole('button', { name: /^orbit$/i }).click(); // switch away and back: re-render from scratch
    await page.getByRole('button', { name: st.button }).click();
    const [dl3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save SVG/ }).click()]);
    const third = fs.readFileSync(await dl3.path(), 'utf8');
    report.checks[`${st.short}Selection`] = { mouseInteriorPointHit: pick.hit, mouseSelectedShowsG3: /SELECTED SOURCE · COUNTER \| G3/.test(mouseText), mouseText, keyboardSelectedShowsE5: /SELECTED SOURCE · LEAD \| E5/.test(keyText), keyText };
    report.checks[`${st.short}Export`] = { hasLayer: exports[0].includes(`aria-label="${st.layer}"`), notePaths: (exports[0].match(/role="button"/g) ?? []).length, bytes: exports[0].length, repeatIdentical: exports[0] === exports[1], identicalAfterRestyleRaw: exports[1] === third, identicalAfterRestyleAttributeOrderNormalised: normaliseSvg(exports[1]) === normaliseSvg(third) };
  }

  // Fixed-view edit: Glass Garden lead-5 B4 → E5 (+5). Earlier geometry is aligned on the first note.
  if (!PROFILE_ONLY) for (const st of STYLES) {
    await page.selectOption('#composition-preset', 'glass-garden');
    await page.getByRole('button', { name: st.button }).click();
    await page.getByRole('button', { name: 'Complete art' }).click();
    await page.waitForTimeout(150);
    const firstPoints = (): Promise<FirstPoint[]> => group(st.layer).locator('path[role="button"]').evaluateAll((els: Element[]) => els.map((e) => ({ label: e.getAttribute('aria-label'), m: (e.getAttribute('d') ?? '').match(/^M ([-\d.]+) ([-\d.]+)/)!.slice(1).map(Number) })));
    const t0 = (await transformOf(st.layer))!;
    const before = await firstPoints();
    await svg.screenshot({ path: `${OUT}/edit-${st.short}-before.png` });
    await page.getByRole('button', { name: 'Select and hear B4 at beat 5' }).click();
    await page.getByLabel('Selected note pitch').selectOption({ label: 'E5' });
    await page.getByRole('button', { name: 'Complete art' }).click();
    await page.waitForTimeout(150);
    await svg.screenshot({ path: `${OUT}/edit-${st.short}-after-refit.png` });
    const t1 = await transformOf(st.layer);
    const after = await firstPoints();
    const [tx0, ty0, s0] = (t0.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/) ?? []).slice(1).map(Number);
    const dx = before[0].m[0] - after[0].m[0], dy = before[0].m[1] - after[0].m[1]; // align on the first note's onset
    const fixed = `translate(${(tx0 + s0 * dx).toFixed(3)} ${(ty0 + s0 * dy).toFixed(3)}) scale(${s0})`;
    await group(st.layer).evaluate((el: Element, t: string) => el.setAttribute('transform', t), fixed);
    await svg.screenshot({ path: `${OUT}/edit-${st.short}-after-fixed-view.png` });
    const moved = before.map((b0: FirstPoint, i: number) => ({ label: b0.label, shift: Math.hypot(after[i].m[0] + dx - b0.m[0], after[i].m[1] + dy - b0.m[1]) }));
    report.checks[`${st.short}FixedViewEdit`] = {
      edit: 'Glass Garden lead-5 B4 → E5 (+5 semitones)', viewBefore: t0, viewAfterRefit: t1, fixedViewApplied: fixed,
      notesWhoseStartMoved: moved.filter((m) => m.shift > 0.5).map((m) => `${m.label} (${m.shift.toFixed(1)})`),
      notesUnchanged: moved.filter((m) => m.shift <= 0.5).length,
    };
  }

  // rAF intervals during real playback, both styles, the two heaviest pieces.
  for (const id of ['glass-garden', 'leap-dialogue']) for (const st of STYLES) {
    await page.selectOption('#composition-preset', id);
    await page.getByRole('button', { name: st.button }).click();
    await page.getByRole('button', { name: 'Clear painting' }).click();
    await page.getByRole('button', { name: /Play from start|Resume/ }).click();
    await page.waitForTimeout(300);
    const iv: number[] = await page.evaluate(`new Promise((resolve) => { const out = []; let last = performance.now();
      function tick(now) { out.push(now - last); last = now; if (out.length < 240) requestAnimationFrame(tick); else resolve(out); } requestAnimationFrame(tick); })`);
    const playing = (await page.getByRole('button', { name: /^Pause$/ }).count()) > 0;
    await pause();
    const sorted = iv.slice(1).sort((x, y) => x - y);
    const q = (p: number) => +sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1)))].toFixed(2);
    report.frameProfile[`${st.short}/${id}`] = { frames: sorted.length, p50ms: q(50), p95ms: q(95), maxMs: +sorted.at(-1)!.toFixed(2), over20ms: sorted.filter((x) => x > 20).length, playingThroughout: playing };
  }

  await browser.close();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
