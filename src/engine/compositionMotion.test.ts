import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, deriveGeometry, sortedNotes, totalBeats, validateComposition as validateCompositionErrors, type MusicalComposition } from './composition.ts';
import { computeRibbonFrame, describeNoteMotion, ribbonSegments, DEFAULT_RIBBON_CONFIG, type RibbonFrame } from './compositionMotion.ts';
import { OVERLAP, RESTED, assertStrictAttribution } from './motionTestFixtures.ts';
import { computeCurrentFrame } from './compositionCurrent.ts';
import { deriveGeometry as geometryOf } from './composition.ts';

const preset = (id: string): MusicalComposition => cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === id)!);
const track = (frame: RibbonFrame, id: string) => frame.tracks.find((t) => t.trackId === id)!;
const sampleAt = (frame: RibbonFrame, trackId: string, beat: number) =>
  track(frame, trackId).samples.reduce((best, s) => (Math.abs(s.beat - beat) < Math.abs(best.beat - beat) ? s : best));

test('R4: the same score and beat give identical frames, independent of call history', () => {
  for (const score of COMPOSITION_PRESETS) {
    const span = totalBeats(score);
    const a = computeRibbonFrame(score, span * 0.61);
    computeRibbonFrame(score, span); // unrelated call in between must not leak state
    computeRibbonFrame(score, 0.25);
    const b = computeRibbonFrame(score, span * 0.61);
    assert.deepEqual(a, b, score.id);
    assert.ok(a.tracks.length > 0 && a.tracks.every((t) => t.samples.length > 1), `${score.id} produces ribbon samples`);
  }
});

test('R4: 30 fps, 60 fps and irregular frame cadences reach the same frame; earlier trail is never rewritten', () => {
  const score = preset('glass-garden');
  const bpm = score.bpm;
  const target = 9.37;
  const cadence = (fps: number) => { for (let t = 0; t * bpm / 60 < target; t += 1 / fps) computeRibbonFrame(score, t * bpm / 60); return computeRibbonFrame(score, target); };
  const irregular = [0, 0.3, 0.31, 2.9, 3.0, 7.77, 4.1, target].map((b) => computeRibbonFrame(score, b)).at(-1)!;
  assert.deepEqual(cadence(30), cadence(60));
  assert.deepEqual(cadence(60), irregular);
  const early = computeRibbonFrame(score, 5);
  const late = computeRibbonFrame(score, 12);
  const earlyFixed = track(early, 'lead').samples.slice(0, -1); // the last sample is the live head at beat 5
  assert.deepEqual(track(late, 'lead').samples.slice(0, earlyFixed.length), earlyFixed);
});

test('R2: motion is continuous across onsets and phrase boundaries (no teleport)', () => {
  for (const score of COMPOSITION_PRESETS) {
    const frame = computeRibbonFrame(score, totalBeats(score));
    for (const t of frame.tracks) {
      for (let i = 1; i < t.samples.length; i++) {
        const a = t.samples[i - 1], b = t.samples[i];
        const jump = Math.hypot(b.x - a.x, b.y - a.y);
        assert.ok(jump < 12, `${score.id}/${t.trackId}: ${jump.toFixed(2)} px jump at beat ${b.beat}`);
        assert.ok(Math.abs(b.width - a.width) < 1.5, `${score.id}: width jump ${(b.width - a.width).toFixed(2)} at beat ${b.beat}`);
      }
    }
  }
});

test('R2: the ribbon actually moves between note starts (damped response, not static marks)', () => {
  const score = preset('glass-garden'); // C4 → E4 at beat 1
  const frame = computeRibbonFrame(score, totalBeats(score));
  const rAt = (b: number) => sampleAt(frame, 'lead', b).r;
  const [c4, e4] = deriveGeometry(score).slice(0, 2).map((m) => m.radius);
  assert.ok(Math.abs(rAt(0.5) - c4) < 0.5, 'settled on the first pitch before the first interval');
  assert.ok(rAt(1.1) > c4 + 0.5 && rAt(1.1) < e4, 'mid-transition between pitches shortly after the onset');
  const peak = Math.max(...track(frame, 'lead').samples.filter((s) => s.beat >= 1 && s.beat < 1.5).map((s) => s.r));
  assert.ok(peak > e4, 'the spring overshoots the new pitch (oscillatory, damped)');
});

test('R3: rising pitch and repeated pulse produce clearly different contours', () => {
  const rising = computeRibbonFrame(preset('ascending-light'), 8);
  const radiiAtNoteEnds = preset('ascending-light').notes.map((n) => sampleAt(rising, 'lead', n.startBeat + n.durationBeats - 0.05).r);
  for (let i = 1; i < radiiAtNoteEnds.length; i++) assert.ok(radiiAtNoteEnds[i] > radiiAtNoteEnds[i - 1], `ascending note ${i} sits higher`);
  assert.equal(radiiAtNoteEnds.length, 8);

  const pulse = preset('pulse-study');
  const pulseFrame = computeRibbonFrame(pulse, totalBeats(pulse));
  const firstTwo = [0.45, 0.95].map((b) => sampleAt(pulseFrame, 'lead', b).r); // C4, C4 repeated
  assert.ok(Math.abs(firstTwo[0] - firstTwo[1]) < 0.5, 'a repeated pitch does not move the radius');
  const swells = pulse.notes.map((n) => sampleAt(pulseFrame, 'lead', n.startBeat + 0.1).width - sampleAt(pulseFrame, 'lead', n.startBeat + 0.01).width);
  assert.ok(swells.every((d) => d > 0.3), 'each onset, even an unchanged pitch, produces a visible thickness swell');
});

test('R3/R6: Leap Dialogue keeps two independent voices and links simultaneous onsets', () => {
  const score = preset('leap-dialogue');
  const frame = computeRibbonFrame(score, totalBeats(score));
  assert.deepEqual(frame.tracks.map((t) => t.trackId).sort(), ['counter', 'lead']);
  const ids = new Set(frame.tracks.flatMap((t) => t.samples.map((s) => s.noteId)).filter(Boolean));
  assert.deepEqual([...ids].sort(), score.notes.map((n) => n.id).sort(), 'all 12 note IDs remain attributable');
  assert.ok(frame.tracks.every((t) => t.samples.every((s) => s.trackId === t.trackId)));
  const counter = frame.relationships.filter((r) => r.kind === 'counterpoint');
  assert.equal(counter.length, 4, 'beats 0, 2, 4, 6 each start one lead and one counter note');
  assert.deepEqual(counter.map((r) => r.beat), [0, 2, 4, 6]);
  assert.ok(counter.every((r) => r.trackIds.includes('lead') && r.trackIds.includes('counter') && Number.isInteger(r.semitones)));
  const meanR = (id: string) => track(frame, id).samples.reduce((s, x) => s + x.r, 0) / track(frame, id).samples.length;
  assert.ok(meanR('counter') < meanR('lead') - 20, 'the low counterline stays visibly inside the melody');
});

test('R6: First Mark stays deliberately simple', () => {
  const frame = computeRibbonFrame(preset('first-mark'), 4);
  assert.equal(frame.tracks.length, 1);
  assert.equal(frame.relationships.length, 0);
  const radii = frame.tracks[0].samples.map((s) => s.r);
  assert.ok(Math.max(...radii) - Math.min(...radii) < 1e-9, 'one note, no interval: no radial motion');
});

test('R5: editing one pitch changes only motion from that onset onward, without mutating the score', () => {
  const original = preset('glass-garden');
  const snapshot = JSON.stringify(original);
  const edited = cloneComposition(original);
  const target = edited.notes.find((n) => n.id === 'lead-5')!; // starts at beat 4
  target.midi += 5;
  const a = computeRibbonFrame(original, 16);
  const b = computeRibbonFrame(edited, 16);
  assert.equal(JSON.stringify(original), snapshot, 'the source score is not mutated');
  const before = (f: RibbonFrame) => track(f, 'lead').samples.filter((s) => s.beat < 4);
  assert.deepEqual(before(a), before(b), 'motion before the edited onset is identical');
  const delta = Math.abs(sampleAt(b, 'lead', 4.9).r - sampleAt(a, 'lead', 4.9).r);
  assert.ok(delta > 10, `the edited note visibly moves the ribbon (${delta.toFixed(1)} units)`);
  assert.equal(sampleAt(b, 'lead', 4.9).noteId, 'lead-5', 'the change is attributed to the edited note');
  assert.equal(b.tracks.length, a.tracks.length);
  assert.equal(describeNoteMotion(edited, 'lead-5').intervalSemitones! - describeNoteMotion(original, 'lead-5').intervalSemitones!, 5);
});

test('R4: every sample is finite and inside the 600×600 SVG viewport for all presets and beats', () => {
  for (const score of COMPOSITION_PRESETS) {
    const span = totalBeats(score);
    for (const b of [0, 0.01, span * 0.25, span * 0.5, span * 0.99, span, span + 3]) {
      const frame = computeRibbonFrame(score, b);
      for (const t of frame.tracks) for (const s of t.samples) {
        for (const v of [s.beat, s.theta, s.r, s.x, s.y, s.width]) assert.ok(Number.isFinite(v), `${score.id} non-finite at ${b}`);
        assert.ok(s.x >= 8 && s.x <= 592 && s.y >= 8 && s.y <= 592, `${score.id} out of bounds (${s.x}, ${s.y})`);
        assert.ok(s.width > 0 && s.width <= 14);
        assert.ok(s.beat <= Math.min(b, span) + 1e-9, 'no sample from the future');
      }
    }
  }
});

test('R5: the completed artwork is stable, covers every note, and later beats do not change it', () => {
  for (const score of COMPOSITION_PRESETS) {
    const span = totalBeats(score);
    const done = computeRibbonFrame(score, span);
    assert.deepEqual(computeRibbonFrame(score, span + 10), done, `${score.id} clamps after the end`);
    const ids = new Set(done.tracks.flatMap((t) => t.samples.map((s) => s.noteId)).filter(Boolean));
    assert.equal(ids.size, score.notes.length, `${score.id}: every note leaves ribbon geometry`);
  }
});

test('R6 negative controls fail closed', () => {
  const bad = preset('glass-garden');
  bad.notes[0].midi = Number.NaN;
  assert.throws(() => computeRibbonFrame(bad, 1), /Invalid composition/);
  assert.throws(() => computeRibbonFrame(preset('glass-garden'), Number.NaN), /beat/);
  assert.throws(() => computeRibbonFrame(preset('glass-garden'), Infinity), /beat/);
  assert.throws(() => computeRibbonFrame(preset('glass-garden'), 2, { ...DEFAULT_RIBBON_CONFIG, damping: Number.NaN }), /config/);
  assert.throws(() => computeRibbonFrame(preset('glass-garden'), 2, { ...DEFAULT_RIBBON_CONFIG, omegaPerBeat: 0 }), /config/);
  assert.throws(() => computeRibbonFrame(preset('glass-garden'), 2, { ...DEFAULT_RIBBON_CONFIG, sampleStep: 0 }), /config/);
  assert.throws(() => describeNoteMotion(preset('glass-garden'), 'missing-note'), /Unknown note/);
  assert.equal(computeRibbonFrame(preset('glass-garden'), -2).tracks[0].samples.length, 1, 'negative beats clamp to the start');
});

test('R3: the inspector description matches the score relationships', () => {
  const gg = preset('glass-garden');
  const d = describeNoteMotion(gg, 'lead-2');
  assert.equal(d.previousNoteId, 'lead-1');
  assert.equal(d.intervalSemitones, 4);
  assert.ok(d.radiusChange > 0 && d.peakOvershoot > 0 && d.peakOvershoot < d.radiusChange);
  assert.equal(describeNoteMotion(gg, 'lead-1').intervalSemitones, null);
  const ld = preset('leap-dialogue');
  assert.deepEqual(describeNoteMotion(ld, 'lead-1').counterpointNoteIds, ['counter-1']);
  assert.ok(sortedNotes(ld).every((n) => describeNoteMotion(ld, n.id).trackId === n.trackId));
});

test('R3/T3: renderer segments give every started note its own selectable, finite SVG shape', () => {
  for (const score of COMPOSITION_PRESETS) {
    const frame = computeRibbonFrame(score, totalBeats(score));
    const segments = frame.tracks.flatMap((t) => ribbonSegments(t)).filter((s) => s.kind === 'note');
    assert.deepEqual(segments.map((s) => s.noteId).sort(), score.notes.map((n) => n.id).sort(), `${score.id}: one segment per note`);
    for (const s of segments) {
      assert.match(s.d, /^M [0-9.]+ [0-9.]+( L [0-9.]+ [0-9.]+)+ Z$/, `${score.id}/${s.noteId} path is a closed finite polygon`);
      assert.equal(s.trackId, score.notes.find((n) => n.id === s.noteId)!.trackId);
    }
  }
});

// ── W2-B: rest attribution ───────────────────────────────────────────────────

test('W2-B: no Ribbon sample attributes silence to a note (all presets + explicit rests)', () => {
  for (const score of [...COMPOSITION_PRESETS, RESTED]) {
    assertStrictAttribution(score, computeRibbonFrame(score, totalBeats(score)), score.id);
  }
});

test('W2-B: First Mark draws one beat of note and three beats of labelled rest bridge', () => {
  const frame = computeRibbonFrame(preset('first-mark'), 4);
  const s = frame.tracks[0].samples;
  assert.ok(s.filter((x) => x.beat < 1).every((x) => x.kind === 'note' && x.noteId === 'lead-1'), 'beats 0–1 belong to lead-1');
  assert.ok(s.filter((x) => x.beat >= 1).every((x) => x.kind === 'rest' && x.restAfterNoteId === 'lead-1'), 'beats 1–4 are a rest bridge after lead-1');
  const segs = ribbonSegments(frame.tracks[0]);
  assert.deepEqual(segs.map((g) => g.kind), ['note', 'rest']);
  assert.equal(segs[1].noteId, null, 'the rest bridge claims no note');
});

test('W2-B: explicit rests become separate bridges while the line stays continuous', () => {
  const frame = computeRibbonFrame(RESTED, 8);
  const segs = ribbonSegments(frame.tracks[0]);
  assert.deepEqual(segs.map((g) => g.kind + ':' + (g.noteId ?? g.restAfterNoteId)), ['note:n1', 'note:n2', 'rest:n2', 'note:n3', 'note:n4', 'rest:n4']);
  const t = frame.tracks[0].samples;
  for (let i = 1; i < t.length; i++) assert.ok(Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y) < 12, `jump at ${t[i].beat}`);
  assert.deepEqual(computeRibbonFrame(RESTED, 99), frame, 'completed artwork (with bridges) is stable');
});

// ── W2-C: same-track overlap ─────────────────────────────────────────────────

test('W2-C: overlapping notes on one voice are a valid score (precondition)', () => {
  assert.deepEqual(validateCompositionErrors(OVERLAP), []);
});

test('W2-C: Ribbon lists every sounding note and the newest owns the motion', () => {
  const f = computeRibbonFrame(OVERLAP, 4);
  assertStrictAttribution(OVERLAP, f, 'ribbon/overlap');
  const at = (b: number) => sampleAt(f, 'lead', b);
  assert.deepEqual([at(0.5).activeNoteIds, at(0.5).noteId], [['A'], 'A']);
  assert.deepEqual([at(1.5).activeNoteIds, at(1.5).noteId], [['A', 'B'], 'B'], 'both notes sound at beat 1.5');
  assert.deepEqual([at(3).activeNoteIds, at(3).noteId], [['A'], 'A'], 'A still sounds after B ends');
  assert.deepEqual(ribbonSegments(f.tracks[0]).map((g) => `${g.kind}:${g.noteId}`), ['note:A', 'note:B', 'note:A']);
});

test('W2-C: after the inner note ends, Ribbon motion returns to the still-sounding note', () => {
  const f = computeRibbonFrame(OVERLAP, 4);
  const [rA, rB] = geometryOf(OVERLAP).sort((a, b) => a.midi - b.midi).map((m) => m.radius);
  const r = (b: number) => sampleAt(f, 'lead', b).r;
  assert.ok(r(1.9) > rA + 0.8 * (rB - rA), 'moves to B while B is the newest sounding note');
  assert.ok(Math.abs(r(3.95) - rA) < 0.05 * (rB - rA), `returns to A's pitch once only A sounds (r=${r(3.95).toFixed(2)}, A=${rA.toFixed(2)})`);
  const width = (b: number) => sampleAt(f, 'lead', b).width;
  assert.ok(width(1.5) > width(3.5), 'two sounding notes are thicker than one (both contribute)');
});

test('W2-C: Current lists every sounding note and steering follows the newest sounding pitch', () => {
  const f = computeCurrentFrame(OVERLAP, 4);
  assertStrictAttribution(OVERLAP, f, 'current/overlap');
  const s = f.tracks[0].samples;
  const heading = (b: number) => s.reduce((best, x) => (Math.abs(x.beat - b) < Math.abs(best.beat - b) ? x : best)).theta;
  assert.ok(heading(1.9) < -0.5, 'climbs while B (7 semitones above A) is newest');
  assert.ok(Math.abs(heading(3.95)) < 0.05, 'levels off again once only A sounds');
});
