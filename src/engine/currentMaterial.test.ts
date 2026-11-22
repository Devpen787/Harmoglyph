import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, totalBeats, type MusicalComposition } from './composition.ts';
import { computeCurrentFrame, DEFAULT_CURRENT_CONFIG } from './compositionCurrent.ts';
import { buildLuminousLayer, type LuminousLayer } from './currentMaterial.ts';
import { RESTED } from './motionTestFixtures.ts';

const preset = (id: string): MusicalComposition => cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === id)!);
const layerFor = (score: MusicalComposition, beat: number, config = DEFAULT_CURRENT_CONFIG) =>
  buildLuminousLayer(score, computeCurrentFrame(score, beat, config), computeCurrentFrame(score, totalBeats(score), config));
const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const allPaths = (l: LuminousLayer) => [...l.sheets, ...l.echoes, ...l.cores, ...l.restThreads, ...l.membranes].map((p) => p.d);

test('Luminous: material only reads the motion frame (no mutation, same frame before/after)', () => {
  const score = preset('leap-dialogue');
  const frame = deepFreeze(computeCurrentFrame(score, 5));
  const complete = deepFreeze(computeCurrentFrame(score, totalBeats(score)));
  const snapshot = JSON.stringify(frame);
  assert.doesNotThrow(() => buildLuminousLayer(score, frame, complete), 'works on frozen inputs');
  assert.equal(JSON.stringify(frame), snapshot);
  assert.deepEqual(buildLuminousLayer(score, frame, complete), buildLuminousLayer(score, frame, complete), 'deterministic');
});

test('Luminous: the view fills the canvas, is fixed during playback, and keeps the art inside 600×600', () => {
  for (const score of [...COMPOSITION_PRESETS, RESTED]) {
    const span = totalBeats(score);
    const views = [0.3, span / 2, span].map((b) => layerFor(score, b).view);
    assert.deepEqual(views[0], views[2], `${score.id}: view does not move while playing`);
    const done = layerFor(score, span);
    assert.ok(done.view.scale >= 1 && done.view.scale <= 2, `${score.id}: scale ${done.view.scale}`);
    const pts = done.cores.flatMap((c) => numbers(c.d));
    const xs = pts.filter((_, i) => i % 2 === 0).map((x) => x * done.view.scale + done.view.tx);
    const ys = pts.filter((_, i) => i % 2 === 1).map((y) => y * done.view.scale + done.view.ty);
    assert.ok(Math.min(...xs) >= 20 && Math.max(...xs) <= 580 && Math.min(...ys) >= 20 && Math.max(...ys) <= 580, `${score.id}: inside canvas`);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 380, `${score.id}: uses most of the width (${(Math.max(...xs) - Math.min(...xs)).toFixed(0)})`);
  }
});

test('Luminous: every layer is finite; each started note has one onset node sized by its velocity', () => {
  for (const score of COMPOSITION_PRESETS) {
    const l = layerFor(score, totalBeats(score));
    for (const d of allPaths(l)) assert.ok(numbers(d).every(Number.isFinite) && /^M /.test(d), `${score.id}: finite path`);
    assert.deepEqual(l.onsets.map((o) => o.noteId).sort(), score.notes.map((n) => n.id).sort(), `${score.id}: one node per note`);
    const byId = new Map(score.notes.map((n) => [n.id, n.velocity]));
    const sorted = [...l.onsets].sort((a, b) => byId.get(a.noteId)! - byId.get(b.noteId)!);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].r >= sorted[i - 1].r, `${score.id}: louder notes have larger nodes`);
  }
});

test('Luminous: rests are dotted threads, never note material', () => {
  assert.equal(layerFor(preset('glass-garden'), 16).restThreads.length, 0, 'no rests, no threads');
  const fm = layerFor(preset('first-mark'), 4);
  assert.equal(fm.restThreads.length, 1, 'First Mark: one rest thread after its note');
  assert.equal(layerFor(RESTED, 8).restThreads.length, 2, 'explicit-rest score: two threads');
});

test('Luminous: coupling membranes exist only where voices really couple, with opacity from the real pull', () => {
  for (const id of ['first-mark', 'glass-garden', 'ascending-light', 'pulse-study']) {
    assert.equal(layerFor(preset(id), totalBeats(preset(id))).membranes.length, 0, `${id}: one voice, no membrane`);
  }
  const ld = layerFor(preset('leap-dialogue'), 8);
  assert.ok(ld.membranes.length >= 1, 'Leap Dialogue shows coupling');
  assert.ok(ld.membranes.every((m) => m.meanPull > 0 && m.meanPull <= DEFAULT_CURRENT_CONFIG.couplingMax), 'pull bounded');
  const off = layerFor(preset('leap-dialogue'), 8, { ...DEFAULT_CURRENT_CONFIG, couplingMax: 0 });
  assert.equal(off.membranes.length, 0, 'no coupling, no membrane (control)');
});

test('Luminous: one sheet, echo and core per voice; phrase bands follow the bars', () => {
  const ld = layerFor(preset('leap-dialogue'), 8);
  assert.deepEqual([ld.sheets, ld.echoes, ld.cores].map((xs) => xs.map((x) => x.trackId).sort()), [['counter', 'lead'], ['counter', 'lead'], ['counter', 'lead']]);
  const gg = layerFor(preset('glass-garden'), 16);
  assert.equal(gg.phraseBands.length, 4, 'Glass Garden has 4 bars');
  for (let i = 1; i < gg.phraseBands.length; i++) assert.ok(gg.phraseBands[i].x0 >= gg.phraseBands[i - 1].x1 - 1e-6, 'bands ordered left→right');
});
