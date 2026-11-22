import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, totalBeats, type MusicalComposition } from './composition.ts';
import { computeCurrentFrame, DEFAULT_CURRENT_CONFIG } from './compositionCurrent.ts';
import { computeRibbonFrame } from './compositionMotion.ts';
import { buildFilamentLayer, FILAMENT_STRANDS, type FilamentLayer } from './filamentMaterial.ts';
import { RESTED } from './motionTestFixtures.ts';

const preset = (id: string): MusicalComposition => cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === id)!);
const layer = (score: MusicalComposition, beat: number, config = DEFAULT_CURRENT_CONFIG): FilamentLayer =>
  buildFilamentLayer(score, computeCurrentFrame(score, beat, config), computeCurrentFrame(score, totalBeats(score), config));
const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const noteStrands = (l: FilamentLayer, track: string) => l.strands.filter((s) => s.trackId === track && s.kind === 'note');

test('Filament: read-only, deterministic, no randomness (frozen inputs, identical output)', () => {
  const score = preset('leap-dialogue');
  const f = deepFreeze(computeCurrentFrame(score, 5));
  const c = deepFreeze(computeCurrentFrame(score, 8));
  const snap = JSON.stringify(f);
  const a = buildFilamentLayer(score, f, c);
  assert.equal(JSON.stringify(f), snap, 'frame not mutated');
  assert.deepEqual(buildFilamentLayer(score, f, c), a, 'same input, same strands');
  assert.ok(a.strands.length > 0, 'produces strands');
});

test('Filament: each voice is a bundle of strands; every point finite and inside the canvas', () => {
  for (const score of [...COMPOSITION_PRESETS, RESTED]) {
    const l = layer(score, totalBeats(score));
    for (const t of score.tracks) {
      const lanes = new Set(noteStrands(l, t.id).map((s) => s.lane));
      assert.equal(lanes.size, FILAMENT_STRANDS, `${score.id}/${t.id}: ${FILAMENT_STRANDS} strands`);
    }
    for (const s of l.strands) for (const [x, y] of s.points) {
      const X = x * l.view.scale + l.view.tx, Y = y * l.view.scale + l.view.ty;
      assert.ok(Number.isFinite(X) && Number.isFinite(Y) && X >= 10 && X <= 590 && Y >= 10 && Y <= 590, `${score.id}: (${X.toFixed(1)}, ${Y.toFixed(1)})`);
    }
    assert.ok(l.strands.every((s) => /^M [-\d.]+ [-\d.]+( C [-\d. ]+)+$/.test(s.d)), `${score.id}: smooth (cubic) strand paths`);
  }
});

test('Filament: earlier strand geometry never changes as playback advances', () => {
  const score = preset('glass-garden');
  const early = layer(score, 5), late = layer(score, 12);
  for (const s of noteStrands(early, 'lead').filter((x) => x.points.length > 4)) {
    const match = late.strands.find((x) => x.key === s.key)!;
    assert.ok(match, `strand ${s.key} persists`);
    assert.deepEqual(match.points.slice(0, s.points.length - 2), s.points.slice(0, -2), `${s.key}: fixed prefix`);
  }
});

test('Filament: the bundle opens with note thickness (velocity/duration) and narrows in silence', () => {
  const l = layer(RESTED, 8);
  const centreSpread = (beatPred: (i: number) => boolean) => {
    const strands = l.strands.filter((s) => s.trackId === 'lead');
    const ys = strands.flatMap((s) => s.points.filter((_, i) => beatPred(i)).map((p) => p[1]));
    return ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  };
  const rests = l.strands.filter((s) => s.kind === 'rest');
  const notes = l.strands.filter((s) => s.kind === 'note');
  assert.ok(rests.length > 0, 'explicit rests produce rest strands');
  assert.ok(new Set(rests.map((s) => s.lane)).size < new Set(notes.map((s) => s.lane)).size / 2, 'silence keeps only a few inner strands');
  assert.ok(rests.every((s) => s.opacity < Math.max(...notes.map((n) => n.opacity))), 'rest strands are dimmer than note strands');
  assert.equal(layer(preset('glass-garden'), 16).strands.filter((s) => s.kind === 'rest').length, 0, 'no silence, no rest strands');
  assert.ok(centreSpread(() => true) > 0, 'bundle has width');
});

test('Filament: louder notes spread the bundle wider (velocity → width)', () => {
  const quiet = preset('first-mark'); quiet.notes[0].velocity = 0.2;
  const loud = preset('first-mark'); loud.notes[0].velocity = 1;
  const spreadAt = (score: MusicalComposition) => {
    const l = layer(score, 4);
    const ys = noteStrands(l, 'lead').map((s) => s.points[Math.min(8, s.points.length - 1)][1]); // ~0.75 beat into the note
    return Math.max(...ys) - Math.min(...ys);
  };
  assert.ok(spreadAt(loud) > spreadAt(quiet) * 1.3, `loud ${spreadAt(loud).toFixed(1)} vs quiet ${spreadAt(quiet).toFixed(1)}`);
});

test('Filament: strands cross between voices only where the real coupling pulls', () => {
  for (const id of ['first-mark', 'glass-garden', 'ascending-light', 'pulse-study']) {
    assert.ok(layer(preset(id), totalBeats(preset(id))).strands.every((s) => s.maxBend === 0), `${id}: one voice, no crossing`);
  }
  const coupled = layer(preset('leap-dialogue'), 8);
  const free = layer(preset('leap-dialogue'), 8, { ...DEFAULT_CURRENT_CONFIG, couplingMax: 0 });
  const bent = noteStrands(coupled, 'counter').filter((s) => s.maxBend > 0);
  assert.ok(bent.length >= FILAMENT_STRANDS / 4, `some counterline strands reach toward the melody (${bent.length})`);
  assert.ok(bent.every((s) => s.maxBend <= 1 + 1e-9), 'bend bounded');
  assert.ok(noteStrands(coupled, 'lead').every((s) => s.maxBend === 0), 'melody strands never bend');
  assert.ok(free.strands.every((s) => s.maxBend === 0), 'coupling off → no crossing (control)');
});

test('Filament: material is independent of the motion engine (works on Ribbon frames too)', () => {
  const score = preset('glass-garden');
  const l = buildFilamentLayer(score, computeRibbonFrame(score, 9), computeRibbonFrame(score, 16));
  assert.equal(new Set(noteStrands(l, 'lead').map((s) => s.lane)).size, FILAMENT_STRANDS);
  assert.ok(l.strands.every((s) => s.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))));
  assert.ok(l.strands.every((s) => s.maxBend === 0), 'Ribbon has no coupling data, so nothing bends');
});
