/**
 * Headed-browser probe of the REAL Harmoglyph UI (Compose & Art tab).
 *
 * Launches its own headed Chrome for Testing via Playwright (already installed
 * in the Playwright cache; no new npm dependency), drives the production
 * CompositionJourneyView with real clicks, and records what the production
 * code actually hands to Web Audio by wrapping AudioContext and
 * OscillatorNode.prototype.start BEFORE the app loads.
 *
 * Measured: AudioContext state/currentTime, the `when` argument of each
 * oscillator start() call, console output, document.hidden transitions,
 * UI button state.
 * NOT measured: sound reaching speakers, perceived timing. This probe cannot
 * hear anything; a listening test remains a human gate.
 *
 * Run (dev server on :3000 first):
 *   node --import tsx src/engine/headedBrowserProbe.ts > out.json
 */
import { COMPOSITION_PRESETS } from './composition.ts';
import { planCompositionTimeline } from './compositionTimeline.ts';

const CHROMIUM =
  process.env.HG_CHROMIUM ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/` +
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = process.env.HG_URL ?? 'http://localhost:3000';

const INIT = `
(() => {
  const P = (window.__probe = { log: [] });
  const log = (e) => P.log.push({ t: performance.now(), ...e });
  const Orig = window.AudioContext;
  window.AudioContext = class extends Orig {
    constructor(...a) {
      super(...a);
      window.__ctx = this;
      log({ k: 'ctx-new', state: this.state, ct: this.currentTime });
      this.addEventListener('statechange', () => log({ k: 'ctx-state', state: this.state, ct: this.currentTime }));
    }
  };
  const os = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when) {
    log({ k: 'osc-start', when: when ?? null, ct: this.context.currentTime });
    return os.apply(this, arguments);
  };
  const ost = OscillatorNode.prototype.stop;
  OscillatorNode.prototype.stop = function (when) {
    log({ k: 'osc-stop', when: when ?? null, ct: this.context.currentTime });
    return ost.apply(this, arguments);
  };
  document.addEventListener('visibilitychange', () => log({ k: 'visibility', hidden: document.hidden }));
})();
`;

type Ev = { t: number; k: string; when?: number | null; ct?: number; state?: string; hidden?: boolean };

async function main() {
  const pw = await import('playwright');
  // Playwright disables tab backgrounding by default; remove those flags so
  // minimising the window can produce a real hidden/throttled page.
  const browser = await pw.chromium.launch({
    headless: false, executablePath: CHROMIUM,
    ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  });
  const ctx = await browser.newContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const consoleMsgs: string[] = [];
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`.slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) consoleMsgs.push(`[http ${r.status()}] ${r.url()}`); });
  page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${String(e).slice(0, 300)}`));

  const out: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    browserVersion: browser.version(),
    userAgent: null,
    scenarios: {},
    consoleMessages: consoleMsgs,
    limits: 'No audio output observed. when/currentTime are values passed to / read from Web Audio, not heard sound.',
  };
  const scen = out.scenarios as Record<string, unknown>;

  const events = async (): Promise<Ev[]> => page.evaluate(() => (window as any).__probe.log);
  const mark = async () => (await events()).length;
  const sinceMark = async (n: number) => (await events()).slice(n);
  const state = () => page.evaluate(() => ({ s: (window as any).__ctx?.state ?? null, ct: (window as any).__ctx?.currentTime ?? null, hidden: document.hidden }));
  const uniqueWhens = (evs: Ev[]) => [...new Set(evs.filter((e) => e.k === 'osc-start').map((e) => e.when as number))].sort((a, b) => a - b);

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    out.userAgent = await page.evaluate(() => navigator.userAgent);
    await page.waitForSelector('#composition-preset', { timeout: 15000 });

    const choose = async (id: string) => page.selectOption('#composition-preset', id);
    const compare = (presetId: string, whens: number[], fromBeat = 0) => {
      const score = COMPOSITION_PRESETS.find((p) => p.id === presetId)!;
      const expected = [...new Set(planCompositionTimeline(score, fromBeat).map((e) => +e.startOffsetSeconds.toFixed(6)))].sort((a, b) => a - b);
      const n = Math.min(expected.length, whens.length);
      const dev = [] as number[];
      for (let i = 0; i < n; i++) dev.push(+((whens[i] - whens[0]) - (expected[i] - expected[0])).toFixed(6));
      const abs = dev.map(Math.abs).sort((a, b) => a - b);
      const pct = (p: number) => abs[Math.min(abs.length - 1, Math.floor((p / 100) * (abs.length - 1)))] ?? null;
      return {
        expectedDistinctOnsets: expected.length, scheduledDistinctOnsets: whens.length,
        comparedSamples: n, medianAbsDevSec: pct(50), p95AbsDevSec: pct(95), maxAbsDevSec: abs[abs.length - 1] ?? null,
        note: 'deviation of scheduled `when` spacing from score spacing; first onset used as reference',
      };
    };

    // 1. First play / unlock — ascending-light
    await choose('ascending-light');
    const before = await state();
    const m1 = await mark();
    await page.getByRole('button', { name: /Play from start/ }).click();
    await page.waitForTimeout(6500);
    const ev1 = await sinceMark(m1);
    const after = await state();
    scen['1_first_play_unlock'] = {
      ctxBeforeClick: before, ctxAfter: after,
      ctxStateEvents: ev1.filter((e) => e.k === 'ctx-new' || e.k === 'ctx-state'),
      oscStartCount: ev1.filter((e) => e.k === 'osc-start').length,
      timing: compare('ascending-light', uniqueWhens(ev1)),
      audioClockAdvanced: before.ct === null ? null : after.ct! > before.ct,
    };
    await page.waitForTimeout(500);

    // 2. Rapid notes — pulse-study
    await choose('pulse-study');
    const m2 = await mark();
    await page.getByRole('button', { name: /Play from start/ }).click();
    await page.waitForTimeout(5000);
    const ev2 = await sinceMark(m2);
    scen['2_rapid_notes_pulse_study'] = { oscStartCount: ev2.filter((e) => e.k === 'osc-start').length, timing: compare('pulse-study', uniqueWhens(ev2)) };
    await page.getByRole('button', { name: /Pause/ }).click().catch(() => {});

    // 3. Polyphony — leap-dialogue
    await choose('leap-dialogue');
    const m3 = await mark();
    await page.getByRole('button', { name: /Play from start/ }).click();
    await page.waitForTimeout(6000);
    const ev3 = await sinceMark(m3);
    const starts3 = ev3.filter((e) => e.k === 'osc-start');
    const byWhen = new Map<number, number>();
    for (const e of starts3) byWhen.set(e.when as number, (byWhen.get(e.when as number) ?? 0) + 1);
    scen['3_polyphony_leap_dialogue'] = {
      oscStartCount: starts3.length,
      distinctOnsets: byWhen.size,
      onsetsWithMoreThan4Oscillators: [...byWhen.values()].filter((c) => c > 4).length,
      note: 'each note creates 4 oscillators; a count of 8 at one onset = two simultaneous notes',
      timing: compare('leap-dialogue', uniqueWhens(ev3)),
    };
    await page.getByRole('button', { name: /Pause/ }).click().catch(() => {});

    // 4. Pause / resume — ascending-light
    await choose('ascending-light');
    await page.getByRole('button', { name: /Play from start/ }).click();
    await page.waitForTimeout(1800);
    const mP = await mark();
    await page.evaluate(() => (window as any).__probe.log.push({ t: performance.now(), k: 'PAUSE-CLICK-ISSUED', ct: (window as any).__ctx.currentTime }));
    await page.getByRole('button', { name: /Pause/ }).click();
    await page.waitForTimeout(1500);
    const evPaused = await sinceMark(mP);
    const label1 = await page.locator('button:has-text("Resume"), button:has-text("Play from start")').first().innerText().catch(() => null);
    const mR = await mark();
    await page.getByRole('button', { name: /Resume|Play from start/ }).click();
    await page.waitForTimeout(2500);
    const evRes = await sinceMark(mR);
    scen['4_pause_resume'] = {
      oscStartsWhilePaused: evPaused.filter((e) => e.k === 'osc-start').length,
      oscStopCallsAtPause: evPaused.filter((e) => e.k === 'osc-stop').length,
      buttonLabelAfterPause: label1,
      oscStartsAfterResume: evRes.filter((e) => e.k === 'osc-start').length,
      firstResumeWhens: uniqueWhens(evRes).slice(0, 4),
      rawEventsAroundPause: evPaused.slice(0, 40),
    };
    await page.getByRole('button', { name: /Pause/ }).click().catch(() => {});

    // 5. Seek and replay — glass-garden, seek to beat 8 (of 16)
    await choose('glass-garden');
    await page.locator('input[aria-label="Scrub song position"]').fill('8');
    const m5 = await mark();
    await page.getByRole('button', { name: /Resume|Play from start/ }).click();
    await page.waitForTimeout(4500);
    const ev5 = await sinceMark(m5);
    const w5 = uniqueWhens(ev5);
    const expectedAfterSeek = planCompositionTimeline(COMPOSITION_PRESETS.find((p) => p.id === 'glass-garden')!, 8);
    scen['5_seek_to_beat_8_glass_garden'] = {
      expectedEventsFromBeat8: expectedAfterSeek.length,
      scheduledDistinctOnsets: w5.length,
      timing: compare('glass-garden', w5, 8),
      note: 'run for ~4.5s only; later notes not yet scheduled by design (look-ahead)',
    };
    await page.getByRole('button', { name: /Pause/ }).click().catch(() => {});

    // 6. Background tab and return (glass-garden ≈ 8.6 s so playback outlasts the test)
    await choose('glass-garden');
    await page.getByRole('button', { name: /Play from start/ }).click();
    await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget') as { windowId: number };
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
    await page.waitForTimeout(2500);
    const hiddenState = await state();
    const m6 = await mark();
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await page.waitForTimeout(1500);
    const evBack = await sinceMark(m6);
    const lbl = await page.locator('button:has-text("Resume"), button:has-text("Pause"), button:has-text("Play from start")').first().innerText().catch(() => null);
    scen['6_background_tab'] = {
      stateWhileBackgrounded: hiddenState,
      visibilityEvents: (await events()).filter((e) => e.k === 'visibility'),
      oscStartsAfterReturnWithoutUserAction: evBack.filter((e) => e.k === 'osc-start').length,
      playButtonLabelAfterReturn: lbl,
      method: 'real window minimise via CDP Browser.setWindowBounds',
      designExpectation: 'visibilitychange handler stops transport when hidden (CompositionJourneyView)',
    };
  } catch (e) {
    out.error = String(e).slice(0, 500);
  } finally {
    out.consoleMessages = consoleMsgs;
    await browser.close().catch(() => {});
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
