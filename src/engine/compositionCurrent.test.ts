import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, totalBeats, type MusicalComposition } from './composition.ts';
import { computeCurrentFrame, DEFAULT_CURRENT_CONFIG, type CurrentFrame } from './compositionCurrent.ts';
import { ribbonSegments } from './compositionMotion.ts';
import { RESTED, assertStrictAttribution } from './motionTestFixtures.ts';

const preset = (id: string): MusicalComposition => cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === id)!);
const track = (f: CurrentFrame, id: string) => f.tracks.find((t) => t.trackId === id)!;
const at = (f: CurrentFrame, id: string, beat: number) =>
  track(f, id).samples.reduce((best, s) => (Math.abs(s.beat - beat) < Math.abs(best.beat - beat) ? s : best));

/** Two voices that hold an octave (C4/C3) for 2 beats, then a tritone (C4/F♯3) for 2 beats. */
const OCTAVE_THEN_TRITONE: MusicalComposition = {
  id: 'oct-tri', title: 'Octave then tritone', bpm: 100, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
  tracks: [{ id: 'lead', label: 'Melody', voice: 'music-box' }, { id: 'low', label: 'Low', voice: 'celestial-chime' }],
  notes: [
    { id: 'l1', trackId: 'lead', midi: 60, startBeat: 0, durationBeats: 2, velocity: 0.7 },
    { id: 'l2', trackId: 'lead', midi: 60, startBeat: 2, durationBeats: 2, velocity: 0.7 },
    { id: 'b1', trackId: 'low', midi: 48, startBeat: 0, durationBeats: 2, velocity: 0.7 },
    { id: 'b2', trackId: 'low', midi: 54, startBeat: 2, durationBeats: 2, velocity: 0.7 },
  ],
};

test('Current: deterministic, cadence-independent, and earlier trail never rewritten', () => {
  for (const score of COMPOSITION_PRESETS) {
    const span = totalBeats(score);
    const a = computeCurrentFrame(score, span * 0.6);
    computeCurrentFrame(score, span);
    assert.deepEqual(computeCurrentFrame(score, span * 0.6), a, score.id);
    assert.ok(a.tracks.length > 0 && a.tracks.every((t) => t.samples.length > 1), `${score.id} produces samples`);
  }
  const gg = preset('glass-garden');
  const early = track(computeCurrentFrame(gg, 5), 'lead').samples.slice(0, -1);
  assert.deepEqual(track(computeCurrentFrame(gg, 12), 'lead').samples.slice(0, early.length), early, 'prefix stable as time advances');
});

test('Current: finite, inside the viewport, and continuous for every preset', () => {
  for (const score of [...COMPOSITION_PRESETS, RESTED, OCTAVE_THEN_TRITONE]) {
    const span = totalBeats(score);
    for (const b of [0, span * 0.3, span * 0.7, span]) {
      const f = computeCurrentFrame(score, b);
      for (const t of f.tracks) {
        for (const s of t.samples) {
          for (const v of [s.x, s.y, s.width]) assert.ok(Number.isFinite(v), `${score.id} non-finite`);
          assert.ok(s.x >= 8 && s.x <= 592 && s.y >= 8 && s.y <= 592, `${score.id} out of bounds (${s.x.toFixed(1)}, ${s.y.toFixed(1)})`);
        }
        for (let i = 1; i < t.samples.length; i++) {
          const p = t.samples[i - 1], q = t.samples[i];
          assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 12, `${score.id}/${t.trackId} jump at ${q.beat}`);
        }
      }
    }
  }
});

test('Current: the melody flows forward (no ring, no loop-back tangle)', () => {
  for (const score of COMPOSITION_PRESETS) {
    const s = computeCurrentFrame(score, totalBeats(score)).tracks[0].samples;
    for (let i = 1; i < s.length; i++) assert.ok(s[i].x > s[i - 1].x, `${score.id}: primary voice moves forward at beat ${s[i].beat}`);
    assert.ok(s.at(-1)!.x - s[0].x > 300, `${score.id}: spans most of the canvas`);
  }
});

test('Current: pitch steers direction — repeated pitch runs straight, rising pitch climbs', () => {
  const pulse = computeCurrentFrame(preset('pulse-study'), 8);
  const firstBeat = track(pulse, 'lead').samples.filter((s) => s.beat < 1); // C4, C4
  assert.ok(firstBeat.every((s) => Math.abs(s.y - firstBeat[0].y) < 1e-9), 'repeated C4 gives a straight, level line');
  const asc = preset('ascending-light');
  const f = computeCurrentFrame(asc, 8);
  const ys = asc.notes.map((n) => at(f, 'lead', n.startBeat + n.durationBeats - 0.05).y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1], `ascending note ${i} is higher on screen`);
  const gg = computeCurrentFrame(preset('glass-garden'), 16);
  const ggTrack = track(gg, 'lead').samples;
  const summit = ggTrack.reduce((m, s) => (s.y < m.y ? s : m));
  assert.ok(summit.beat > 2 && summit.beat < 14, `Glass Garden rises then returns (summit at beat ${summit.beat.toFixed(2)})`);
});

test('Current: silence is never attributed to a note', () => {
  for (const score of [...COMPOSITION_PRESETS, RESTED]) assertStrictAttribution(score, computeCurrentFrame(score, totalBeats(score)), score.id);
  const segs = ribbonSegments(computeCurrentFrame(RESTED, 8).tracks[0]);
  assert.deepEqual(segs.map((g) => g.kind), ['note', 'note', 'rest', 'note', 'note', 'rest']);
});

test('Current coupling: only simultaneous voices couple, bounded, and only the counterline moves', () => {
  for (const id of ['first-mark', 'glass-garden', 'ascending-light', 'pulse-study']) {
    const f = computeCurrentFrame(preset(id), totalBeats(preset(id)));
    assert.equal(f.couplings.length, 0, `${id} has one voice: no coupling`);
  }
  const ld = preset('leap-dialogue');
  const coupled = computeCurrentFrame(ld, 8);
  const free = computeCurrentFrame(ld, 8, { ...DEFAULT_CURRENT_CONFIG, couplingMax: 0 });
  assert.ok(coupled.couplings.length >= 8, 'every lead/counter overlap is a coupling');
  assert.ok(coupled.couplings.every((c) => c.trackIds[0] === 'lead' && c.trackIds[1] === 'counter' && c.consonance > 0 && c.consonance <= 1));
  assert.deepEqual(track(coupled, 'lead').samples, track(free, 'lead').samples, 'the melody is not moved by the counterline');
  const moved = Math.max(...track(coupled, 'counter').samples.map((s, i) => Math.hypot(s.x - track(free, 'counter').samples[i].x, s.y - track(free, 'counter').samples[i].y)));
  assert.ok(moved > 5, `counterline is drawn toward the melody (${moved.toFixed(1)} px)`);
  assert.ok(coupled.pull.counter.every((l) => l >= 0 && l <= DEFAULT_CURRENT_CONFIG.couplingMax + 1e-12), 'pull bounded by couplingMax');
  assert.ok(coupled.pull.lead.every((l) => l === 0), 'primary voice has zero pull');
  const first = coupled.couplings.find((c) => c.noteIds[0] === 'lead-1')!;
  assert.deepEqual([first.noteIds[1], first.intervalSemitones, first.intervalClass, first.consonance], ['counter-1', 12, 0, 1]);
});

test('Current coupling: consonance sets strength (octave pulls harder than tritone)', () => {
  const f = computeCurrentFrame(OCTAVE_THEN_TRITONE, 4);
  const [oct, tri] = f.couplings;
  assert.deepEqual([oct.intervalClass, tri.intervalClass], [0, 6]);
  assert.ok(oct.consonance > tri.consonance && oct.maxPull > tri.maxPull, 'octave > tritone');
  const pullAt = (b: number) => { const t = track(f, 'low').samples; const i = t.findIndex((s) => s.beat >= b); return f.pull.low[i]; };
  assert.ok(pullAt(1) > pullAt(3) * 2, `mid-octave pull ${pullAt(1).toFixed(3)} vs mid-tritone ${pullAt(3).toFixed(3)}`);
});

test('Current: a pitch edit changes the path only from its onset (earlier shape identical up to the framing shift)', () => {
  const a = computeCurrentFrame(preset('glass-garden'), 16);
  const edited = preset('glass-garden');
  edited.notes.find((n) => n.id === 'lead-5')!.midi += 5;
  const b = computeCurrentFrame(edited, 16);
  const A = track(a, 'lead').samples, B = track(b, 'lead').samples;
  const dx = B[0].x - A[0].x, dy = B[0].y - A[0].y;
  for (let i = 0; i < A.length && A[i].beat < 4; i++) {
    assert.ok(Math.abs(B[i].x - A[i].x - dx) < 1e-6 && Math.abs(B[i].y - A[i].y - dy) < 1e-6, `pre-edit shape unchanged at ${A[i].beat}`);
  }
  const after = Math.max(...A.map((s, i) => Math.hypot(B[i].x - s.x - dx, B[i].y - s.y - dy)));
  assert.ok(after > 10, `shape changes after the edit (${after.toFixed(1)} px)`);
});

test('Current: First Mark is one straight stroke plus a rest thread', () => {
  const f = computeCurrentFrame(preset('first-mark'), 4);
  const s = f.tracks[0].samples;
  assert.ok(s.every((x) => Math.abs(x.y - s[0].y) < 1e-9), 'single note: no steering');
  assert.deepEqual(ribbonSegments(f.tracks[0]).map((g) => g.kind), ['note', 'rest']);
});

test('Current negative controls fail closed', () => {
  const bad = preset('glass-garden');
  bad.notes[0].durationBeats = 0;
  assert.throws(() => computeCurrentFrame(bad, 1), /Invalid composition/);
  assert.throws(() => computeCurrentFrame(preset('glass-garden'), Number.NaN), /beat/);
  for (const patch of [{ couplingMax: 0.9 }, { couplingMax: -0.1 }, { degreesPerSemitone: 0 }, { maxHeadingDeg: 90 }, { damping: 1 }]) {
    assert.throws(() => computeCurrentFrame(preset('glass-garden'), 2, { ...DEFAULT_CURRENT_CONFIG, ...patch }), /config/, JSON.stringify(patch));
  }
});
