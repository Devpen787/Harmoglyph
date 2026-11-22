import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, totalBeats, type MusicalComposition } from './composition.ts';
import { computeCurrentFrame, DEFAULT_CURRENT_CONFIG } from './compositionCurrent.ts';
import { computeRibbonFrame } from './compositionMotion.ts';
import { buildFilamentLayer, FILAMENT_STRANDS, FILAMENT_VOLUME_STRANDS, type FilamentLayer } from './filamentMaterial.ts';
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

// ── W2-E: 'volume' variant (W2-D stays the default baseline) ─────────────────

const both = (score: MusicalComposition, beat: number, config = DEFAULT_CURRENT_CONFIG) => {
  const f = computeCurrentFrame(score, beat, config), c = computeCurrentFrame(score, totalBeats(score), config);
  return { frame: f, base: buildFilamentLayer(score, f, c), vol: buildFilamentLayer(score, f, c, { variant: 'volume' }) };
};
/** Extent of one voice's note strands at a beat (max distance between strand points at that beat). */
function spreadAt(l: FilamentLayer, track: string, beat: number): number {
  const pts = noteStrands(l, track).flatMap((st) => st.beats.map((b, i) => (Math.abs(b - beat) < 1e-9 ? st.points[i] : null)).filter(Boolean) as Array<[number, number]>);
  let m = 0;
  for (const a of pts) for (const b of pts) m = Math.max(m, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return m;
}
const ink = (l: FilamentLayer, kind: 'note' | 'rest' | 'all' = 'all') => l.strands.filter((st) => kind === 'all' || st.kind === kind).reduce((sum, st) => sum + st.points.reduce((len, p, i) => (i ? len + Math.hypot(p[0] - st.points[i - 1][0], p[1] - st.points[i - 1][1]) : 0), 0) * st.opacity * st.width, 0);

test('W2-E: the default is exactly W2-D; the volume variant is deterministic and distinct', () => {
  const gg = preset('glass-garden');
  const f = computeCurrentFrame(gg, 9), c = computeCurrentFrame(gg, 16);
  assert.deepEqual(buildFilamentLayer(gg, f, c, { variant: 'w2d' }), buildFilamentLayer(gg, f, c), 'explicit w2d = default');
  assert.deepEqual(buildFilamentLayer(gg, f, c, { variant: 'volume' }), buildFilamentLayer(gg, f, c, { variant: 'volume' }), 'variant deterministic');
  assert.notDeepEqual(buildFilamentLayer(gg, f, c, { variant: 'volume' }).strands, buildFilamentLayer(gg, f, c).strands, 'variant differs');
});

test('W2-E: identical framing to W2-D, and every variant point stays inside the canvas', () => {
  for (const score of [...COMPOSITION_PRESETS, RESTED]) {
    const { base, vol } = both(score, totalBeats(score));
    assert.deepEqual(vol.view, base.view, `${score.id}: same view`);
    for (const st of vol.strands) for (const [x, y] of st.points) {
      const X = x * vol.view.scale + vol.view.tx, Y = y * vol.view.scale + vol.view.ty;
      assert.ok(X >= 10 && X <= 590 && Y >= 10 && Y <= 590, `${score.id}: (${X.toFixed(1)}, ${Y.toFixed(1)})`);
    }
  }
});

test('W2-E: Glass Garden and Ascending Light gain volume from note thickness', () => {
  for (const id of ['glass-garden', 'ascending-light']) {
    const score = preset(id);
    const { base, vol } = both(score, totalBeats(score));
    assert.equal(new Set(noteStrands(vol, 'lead').map((s) => s.lane)).size, FILAMENT_VOLUME_STRANDS, `${id}: denser bundle`);
    const mids = score.notes.map((n) => Math.round((n.startBeat + n.durationBeats * 0.4) / (3 / 32)) * (3 / 32));
    const ratio = mids.reduce((sum, b) => sum + spreadAt(vol, 'lead', b) / Math.max(1e-9, spreadAt(base, 'lead', b)), 0) / mids.length;
    assert.ok(ratio >= 1.6, `${id}: mean bundle extent ×${ratio.toFixed(2)} vs W2-D`);
  }
  const quiet = preset('first-mark'); quiet.notes[0].velocity = 0.2;
  const loud = preset('first-mark'); loud.notes[0].velocity = 1;
  const at = 8 * (3 / 32); // 0.75 beat: inside First Mark's one-beat note (same point as the W2-D velocity test)
  assert.ok(spreadAt(both(loud, 4).vol, 'lead', at) > 1.3 * spreadAt(both(quiet, 4).vol, 'lead', at), 'volume still follows velocity');
});

test('W2-E: First Mark stays the sparse control; rests are unchanged from W2-D', () => {
  const fm = both(preset('first-mark'), 4);
  const gg = both(preset('glass-garden'), 16);
  // Sparse by structure: one note, then silence drawn exactly as in W2-D (checked below).
  // Note material is measured, not tuned: Current gives First Mark's single beat a quarter of the
  // canvas, so its note ink is ≈ 0.24 of Glass Garden's 16-note ink. Guard against it growing past 0.3.
  const fmNotes = fm.vol.strands.filter((x) => x.kind === 'note');
  // (each note strand ends on one shared join point where the silent thread begins)
  assert.ok(fmNotes.every((x) => Math.max(...x.beats.slice(0, -1)) < 1), 'note material only where the one note sounds (beats 0–1)');
  assert.ok(ink(fm.vol, 'note') < 0.3 * ink(gg.vol, 'note'), `First Mark note ink ${ink(fm.vol, 'note').toFixed(0)} vs Glass Garden ${ink(gg.vol, 'note').toFixed(0)}`);
  assert.ok(ink(fm.vol, 'rest') > 0 && ink(fm.vol, 'rest') === ink(fm.base, 'rest'), 'silence ink unchanged from W2-D');
  for (const [label, l] of [['first-mark', fm], ['rested', both(RESTED, 8)]] as const) {
    const rests = (x: FilamentLayer) => x.strands.filter((s) => s.kind === 'rest');
    assert.ok(rests(l.vol).length > 0, `${label}: has rest strands`);
    assert.deepEqual(rests(l.vol), rests(l.base), `${label}: rest strands identical to W2-D (still dim, dotted, inner lanes only)`);
  }
});

test('W2-E: coupling bends stay inside real coupling windows, ease at the edges, and vanish without coupling', () => {
  const ld = preset('leap-dialogue');
  const { frame, base, vol } = both(ld, 8);
  const pullAt = new Map(frame.tracks[1].samples.map((s, i) => [s.beat, frame.pull.counter[i]]));
  for (const st of vol.strands) st.bends.forEach((b, i) => {
    if (b > 0) assert.ok(st.trackId === 'counter' && (pullAt.get(st.beats[i]) ?? 0) > 0, `bend ${b.toFixed(3)} at beat ${st.beats[i]} outside a coupling window`);
  });
  const steep = (l: FilamentLayer) => Math.max(...noteStrands(l, 'counter').map((st) => Math.max(0, ...st.bends.map((b, i) => (i ? Math.abs(b - st.bends[i - 1]) : 0)))));
  assert.ok(steep(vol) < 0.6 * steep(base), `edge steepness ${steep(vol).toFixed(3)} vs W2-D ${steep(base).toFixed(3)}`);
  assert.ok(noteStrands(vol, 'counter').filter((s) => s.maxBend > 0.2).length >= 6, 'coupling still clearly visible');
  assert.ok(noteStrands(vol, 'lead').every((s) => s.maxBend === 0), 'melody never bends');
  const off = both(ld, 8, { ...DEFAULT_CURRENT_CONFIG, couplingMax: 0 }).vol;
  assert.ok(off.strands.every((s) => s.bends.every((b) => b === 0)), 'zero coupling → zero cross-voice bend');
  for (const id of ['first-mark', 'glass-garden', 'ascending-light', 'pulse-study']) {
    assert.ok(both(preset(id), totalBeats(preset(id))).vol.strands.every((s) => s.maxBend === 0), `${id}: one voice, no bend`);
  }
});
