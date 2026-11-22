import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, totalBeats, type MusicalComposition } from './composition.ts';
import { computeCurrentFrame, DEFAULT_CURRENT_CONFIG } from './compositionCurrent.ts';
import { buildScoreSculpture } from './scoreSculpture.ts';
import { RESTED } from './motionTestFixtures.ts';

const preset = (id: string): MusicalComposition => cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === id)!);
const LEAP_ANCHORS = [0, 2, 6];

test('Sculpture: static and deterministic — one model per score, independent of playback', () => {
  const ld = preset('leap-dialogue');
  const a = buildScoreSculpture(ld, 'separated', { anchorBeats: LEAP_ANCHORS });
  assert.deepEqual(buildScoreSculpture(ld, 'separated', { anchorBeats: LEAP_ANCHORS }), a);
  assert.ok(a.voices.length > 0 && a.voices.every((v) => v.points.length > 10), 'has geometry');
  assert.ok(a.voices.every((v) => v.points.every((p) => p.every(Number.isFinite)) && v.radii.every((r) => r > 0 && Number.isFinite(r))));
});

test('Sculpture: built from the existing musical paths (Current completed frame), both voices, all 12 notes', () => {
  const ld = preset('leap-dialogue');
  const frame = computeCurrentFrame(ld, totalBeats(ld));
  for (const depth of ['relief', 'separated'] as const) {
    const m = buildScoreSculpture(ld, depth);
    assert.deepEqual(m.voices.map((v) => v.trackId), ['lead', 'counter'], `${depth}: both voices kept`);
    const ids = new Set(m.voices.flatMap((v) => v.noteIds).filter(Boolean));
    assert.deepEqual([...ids].sort(), ld.notes.map((n) => n.id).sort(), `${depth}: all 12 notes`);
    for (const v of m.voices) {
      const src = frame.tracks.find((t) => t.trackId === v.trackId)!.samples;
      const byBeat = new Map(src.map((s) => [s.beat, s]));
      v.points.forEach(([x, y], i) => {
        const s = byBeat.get(v.beats[i])!;
        assert.ok(s, `${depth}: point at beat ${v.beats[i]} comes from a motion sample`);
        assert.ok(Math.abs(x - (s.x - 300)) < 1e-9 && Math.abs(y - (300 - s.y)) < 1e-9, `${depth}: x/y are the 2D path`);
        assert.equal(v.noteIds[i], s.noteId); assert.equal(v.kinds[i], s.kind);
      });
    }
  }
});

test('Sculpture: the three documented Leap Dialogue anchors resolve to the right note pairs', () => {
  const m = buildScoreSculpture(preset('leap-dialogue'), 'separated', { anchorBeats: LEAP_ANCHORS });
  assert.deepEqual(m.anchors.map((a) => [a.beat, a.notes.map((n) => `${n.noteId} ${n.name}`)]), [
    [0, ['lead-1 C4', 'counter-1 C3']],
    [2, ['lead-3 E5', 'counter-2 G3']],
    [6, ['lead-7 D5', 'counter-4 G3']],
  ]);
  for (const a of m.anchors) for (const n of a.notes) {
    const v = m.voices.find((x) => x.trackId === n.trackId)!;
    const i = v.beats.findIndex((b) => Math.abs(b - a.beat) < 1e-9);
    assert.ok(i >= 0, `anchor ${n.noteId} lies on its voice`);
    assert.deepEqual(n.position, v.points[i], `anchor ${n.noteId} sits on the path at its onset`);
    assert.equal(v.noteIds[i], n.noteId, `the path at beat ${a.beat} belongs to ${n.noteId}`);
  }
});

test('Sculpture: shallow relief vs depth-separated voices share the same X/Y, differ only in depth', () => {
  const ld = preset('leap-dialogue');
  const relief = buildScoreSculpture(ld, 'relief'), sep = buildScoreSculpture(ld, 'separated');
  relief.voices.forEach((v, k) => v.points.forEach((p, i) => {
    assert.deepEqual([p[0], p[1]], [sep.voices[k].points[i][0], sep.voices[k].points[i][1]], 'same musical X/Y');
  }));
  const zs = (m: typeof relief, id: string) => m.voices.find((v) => v.trackId === id)!.points.map((p) => p[2]);
  const allRelief = [...zs(relief, 'lead'), ...zs(relief, 'counter')];
  assert.ok(Math.max(...allRelief) - Math.min(...allRelief) <= 16, `relief is shallow (${(Math.max(...allRelief) - Math.min(...allRelief)).toFixed(1)})`);
  assert.ok(Math.min(...zs(sep, 'lead')) - Math.max(...zs(sep, 'counter')) >= 60, 'separated: voices on distinct depth planes');
  const leadNote = (m: typeof relief) => { const v = m.voices[0]; return v.points[v.kinds.indexOf('note') + 20][2]; };
  assert.ok(leadNote(relief) > 0, 'relief: note thickness raises the surface');
});

test('Sculpture: silence stays distinct — rests are thinner than sounding notes', () => {
  const m = buildScoreSculpture(RESTED, 'relief');
  const v = m.voices[0];
  const restR = v.radii.filter((_, i) => v.kinds[i] === 'rest'), noteR = v.radii.filter((_, i) => v.kinds[i] === 'note');
  assert.ok(restR.length > 0, 'rests present');
  assert.ok(Math.max(...restR) < Math.min(...noteR), 'every rest radius below every note radius');
});

test('Sculpture: bridges only where the real coupling pulls', () => {
  const ld = preset('leap-dialogue');
  const sep = buildScoreSculpture(ld, 'separated');
  assert.ok(sep.bridges.length > 0 && sep.bridges.every((b) => b.strength > 0 && b.strength <= 1), 'coupled bridges, bounded strength');
  const frame = computeCurrentFrame(ld, totalBeats(ld));
  const pull = new Map(frame.tracks[1].samples.map((s, i) => [s.beat, frame.pull.counter[i]]));
  assert.ok(sep.bridges.every((b) => (pull.get(b.beat) ?? 0) > 0), 'each bridge sits where λ > 0');
  assert.equal(buildScoreSculpture(ld, 'separated', { config: { ...DEFAULT_CURRENT_CONFIG, couplingMax: 0 } }).bridges.length, 0, 'zero coupling → no bridges');
  assert.equal(buildScoreSculpture(preset('glass-garden'), 'separated').bridges.length, 0, 'one voice → no bridges');
});
