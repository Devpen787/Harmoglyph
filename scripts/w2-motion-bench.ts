/**
 * W2 motion cost and musical-feature summary (Node, no browser).
 * Times one full render-path call (frame + per-note SVG segments) per grammar
 * and preset, and prints what each Current silhouette is made of.
 *
 * Run: node --import tsx scripts/w2-motion-bench.ts
 */
import { performance } from 'node:perf_hooks';
import { COMPOSITION_PRESETS, totalBeats } from '../src/engine/composition.ts';
import { computeRibbonFrame, ribbonSegments } from '../src/engine/compositionMotion.ts';
import { computeCurrentFrame } from '../src/engine/compositionCurrent.ts';

const RUNS = 200;

function time(fn: () => unknown) {
  for (let i = 0; i < 20; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < RUNS; i++) { const a = performance.now(); fn(); t.push(performance.now() - a); }
  t.sort((x, y) => x - y);
  return { p50: +t[RUNS / 2].toFixed(3), p95: +t[Math.floor(RUNS * 0.95)].toFixed(3), max: +t[RUNS - 1].toFixed(3) };
}

const cost: Record<string, unknown> = {};
const features: Record<string, unknown> = {};
for (const score of COMPOSITION_PRESETS) {
  const span = totalBeats(score);
  // Vary the beat every call, as playback does, so per-beat work is not skipped.
  let k = 0;
  const beat = () => ((k++ % 97) / 97) * span;
  cost[score.id] = {
    ribbon: time(() => computeRibbonFrame(score, beat()).tracks.map(ribbonSegments)),
    current: time(() => computeCurrentFrame(score, beat()).tracks.map(ribbonSegments)),
    currentColdFirstCall: (() => { const s = structuredClone(score); s.title += ' cold'; s.notes[0].velocity = Math.min(1, s.notes[0].velocity + 1e-6); const a = performance.now(); computeCurrentFrame(s, span); return +(performance.now() - a).toFixed(3); })(),
  };
  const f = computeCurrentFrame(score, span);
  features[score.id] = f.tracks.map((t) => {
    const xs = t.samples.map((s) => s.x), ys = t.samples.map((s) => s.y);
    const headings = t.samples.map((s) => (-s.theta * 180) / Math.PI);
    const segs = ribbonSegments(t);
    return {
      track: t.trackId,
      xSpan: +(Math.max(...xs) - Math.min(...xs)).toFixed(1),
      ySpan: +(Math.max(...ys) - Math.min(...ys)).toFixed(1),
      maxClimbDeg: +Math.max(...headings).toFixed(1),
      maxDescentDeg: +Math.min(...headings).toFixed(1),
      noteSegments: segs.filter((s) => s.kind === 'note').length,
      restBridges: segs.filter((s) => s.kind === 'rest').length,
      peakPull: +Math.max(0, ...f.pull[t.trackId]).toFixed(3),
    };
  });
  (features[score.id] as unknown[]).push({ couplings: f.couplings.length });
}
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version, runsPerCase: RUNS, msPerRenderCall: cost, currentFeatures: features }, null, 2));
