/**
 * W2-C: why does AudioContext report 'running' while currentTime stays ≈ 0.006 s?
 *
 * Read-only diagnosis. For each browser configuration it runs, on about:blank:
 *   default      new AudioContext(): state, currentTime over 1 s, latencies
 *   noOutput     new AudioContext({ sinkId: { type: 'none' } }): renders without an output device
 *   offline      OfflineAudioContext 1 s sine render (no device, no real-time clock)
 *   transitions  suspend() → resume() with statechange log
 * and the real app's first Play (AudioContext wrapped before load).
 * If noOutput/offline advance while default does not, the output-device path is
 * stalled, not Web Audio itself or Harmoglyph.
 *
 * Run (dev server on :3000): node --import tsx scripts/w2-audio-clock-diagnosis.ts
 * Repetitions, minimal probe only: HG_REPS=5 HG_SKIP_APP=1 node --import tsx scripts/w2-audio-clock-diagnosis.ts
 */
import os from 'node:os';
import fs from 'node:fs';

const CFT = process.env.HG_CHROMIUM ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const STABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.HG_URL ?? 'http://localhost:3000';

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { at: new Date().toISOString(), ua: navigator.userAgent };
  try {
    const c = new AudioContext();
    const s0 = c.state; await c.resume();
    const t0 = c.currentTime; await sleep(1000);
    out.default = { stateAtCreate: s0, state: c.state, t0, t1: c.currentTime, advancedSec: c.currentTime - t0, sampleRate: c.sampleRate, baseLatency: c.baseLatency, outputLatency: c.outputLatency ?? null, sinkId: typeof c.sinkId === 'string' ? c.sinkId : JSON.stringify(c.sinkId) };
    const log = []; c.onstatechange = () => log.push([c.state, +c.currentTime.toFixed(4)]);
    await c.suspend(); const ts = c.currentTime; await sleep(300); const tsAfter = c.currentTime;
    await c.resume(); const tr = c.currentTime; await sleep(500);
    out.transitions = { log, suspendedHeld: tsAfter === ts, afterResumeAdvancedSec: c.currentTime - tr, state: c.state };
    await c.close();
  } catch (e) { out.default = { error: String(e) }; }
  try {
    const n = new AudioContext({ sinkId: { type: 'none' } });
    await n.resume(); const t0 = n.currentTime; await sleep(1000);
    out.noOutput = { state: n.state, advancedSec: n.currentTime - t0 };
    await n.close();
  } catch (e) { out.noOutput = { error: String(e) }; }
  try {
    const o = new OfflineAudioContext(1, 22050, 22050);
    const osc = o.createOscillator(); osc.connect(o.destination); osc.start();
    const t = performance.now(); const buf = await o.startRendering();
    const d = buf.getChannelData(0); let ss = 0; for (const v of d) ss += v * v;
    out.offline = { renderedSec: buf.duration, rms: Math.sqrt(ss / d.length), ms: performance.now() - t };
  } catch (e) { out.offline = { error: String(e) }; }
  return out;
})()`;

const APP_INIT = `(() => { const O = window.AudioContext; window.__log = []; window.AudioContext = class extends O {
  constructor(...a) { super(...a); window.__ctx = this; window.__log.push(['new', this.state, this.currentTime, performance.now()]);
    this.addEventListener('statechange', () => window.__log.push(['statechange', this.state, this.currentTime, performance.now()])); } }; })();`;

interface Config { name: string; executablePath: string; headless: boolean; ignoreDefaultArgs?: string[] }

async function main() {
  const name = 'playwright';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pw: any = await import(name);
  const configs: Config[] = [
    { name: 'cft-headed', executablePath: CFT, headless: false },
    { name: 'cft-headless', executablePath: CFT, headless: true },
    { name: 'cft-headed-unmuted', executablePath: CFT, headless: false, ignoreDefaultArgs: ['--mute-audio'] },
  ];
  if (fs.existsSync(STABLE)) configs.push({ name: 'chrome-stable-headed-temp-profile', executablePath: STABLE, headless: false, ignoreDefaultArgs: ['--mute-audio'] });

  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), host: { platform: os.platform(), release: os.release(), arch: os.arch() }, configs: {} };
  const reps = Number(process.env.HG_REPS ?? 1);
  const skipApp = process.env.HG_SKIP_APP === '1';
  for (const base of configs) for (let rep = 1; rep <= reps; rep++) {
    const cfg = { ...base, name: reps > 1 ? `${base.name}#${rep}` : base.name };
    const r: Record<string, unknown> = { launchArgsIgnored: cfg.ignoreDefaultArgs ?? [] };
    try {
      const browser = await pw.chromium.launch({ headless: cfg.headless, executablePath: cfg.executablePath, ignoreDefaultArgs: cfg.ignoreDefaultArgs });
      r.browserVersion = browser.version();
      const blank = await browser.newPage();
      await blank.goto('about:blank');
      r.minimal = await blank.evaluate(PROBE);
      await blank.close();
      if (skipApp) { await browser.close(); (report.configs as Record<string, unknown>)[cfg.name] = r; continue; }
      const ctx = await browser.newContext();
      await ctx.addInitScript(APP_INIT);
      const app = await ctx.newPage();
      await app.goto(URL, { waitUntil: 'domcontentloaded' });
      await app.waitForSelector('#composition-preset');
      await app.selectOption('#composition-preset', 'glass-garden');
      const clickAt = await app.evaluate('performance.now()');
      await app.getByRole('button', { name: /Play from start|Resume/ }).click();
      const samples: unknown[] = [];
      for (let i = 0; i < 5; i++) {
        await app.waitForTimeout(300);
        samples.push(await app.evaluate(`({ ms: performance.now(), state: window.__ctx && window.__ctx.state, t: window.__ctx && window.__ctx.currentTime, label: (document.querySelector('label:has(input[aria-label="Scrub song position"])') || {}).innerText })`));
      }
      r.appFirstPlay = { clickAtMs: clickAt, ctxLog: await app.evaluate('window.__log'), samples };
      await browser.close();
    } catch (e) { r.error = String(e).slice(0, 400); }
    (report.configs as Record<string, unknown>)[cfg.name] = r;
  }
  report.finishedAt = new Date().toISOString();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
