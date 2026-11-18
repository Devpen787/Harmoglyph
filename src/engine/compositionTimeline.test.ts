import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, sortedNotes, totalBeats } from './composition.ts';
import { beatAtAudioTime, CompositionLookaheadCursor, planCompositionTimeline } from './compositionTimeline.ts';

const preset = (id: string) => cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === id)!);

test('all five existing compositions produce stable, one-to-one scheduled IDs', () => {
  for (const score of COMPOSITION_PRESETS) {
    const events = planCompositionTimeline(score);
    assert.deepEqual(events.map((e) => e.id), sortedNotes(score).map((n) => n.id));
    assert.equal(events.length, score.notes.length);
    assert.ok(events.every((e) => e.startOffsetSeconds >= 0 && e.durationSeconds > 0));
    assert.deepEqual(planCompositionTimeline(score), events);
  }
});

test('tempo controls real seconds while source beat positions remain unchanged', () => {
  const score = preset('ascending-light');
  const original = planCompositionTimeline(score);
  score.bpm *= 2;
  const faster = planCompositionTimeline(score);
  for (let i = 0; i < original.length; i++) {
    assert.equal(faster[i].startBeat, original[i].startBeat);
    assert.ok(Math.abs(faster[i].startOffsetSeconds * 2 - original[i].startOffsetSeconds) < 1e-10);
    assert.ok(Math.abs(faster[i].durationSeconds * 2 - original[i].durationSeconds) < 1e-10);
  }
});

test('simultaneous voices remain simultaneous and distinct', () => {
  const score = preset('leap-dialogue');
  const events = planCompositionTimeline(score);
  const chord = events.filter((e) => e.startBeat === 0);
  assert.equal(chord.length, 2);
  assert.notEqual(chord[0].id, chord[1].id);
  assert.equal(chord[0].startOffsetSeconds, chord[1].startOffsetSeconds);
});

test('look-ahead polling can vary without duplicating or reordering events', () => {
  const events = planCompositionTimeline(preset('pulse-study'));
  const cursor = new CompositionLookaheadCursor(events);
  const emitted = [
    ...cursor.pull(-0.08, 0.12),
    ...cursor.pull(0.02, 0.12),
    ...cursor.pull(0.12, 0.12),
    ...cursor.pull(0.6, 0.2),
    ...cursor.pull(100, 0.12),
  ];
  assert.deepEqual(emitted.map((e) => e.id), events.map((e) => e.id));
  assert.equal(cursor.remaining, 0);
  assert.deepEqual(cursor.pull(200, 0.12), []);
});

test('audio-clock playhead is bounded, independent of display frame duration', () => {
  const bpm = 120, start = 1.5, origin = 12, end = 8;
  assert.equal(beatAtAudioTime(bpm, start, origin, 11.9, end), start);
  assert.equal(beatAtAudioTime(bpm, start, origin, 12.5, end), 2.5);
  assert.equal(beatAtAudioTime(bpm, start, origin, 99, end), end);
});

test('seeking excludes earlier onsets and keeps exact remaining time offsets', () => {
  const score = preset('glass-garden');
  const events = planCompositionTimeline(score, 3);
  assert.ok(events.length < score.notes.length);
  assert.ok(events.every((e) => e.startBeat >= 3));
  assert.ok(Math.abs(events[0].startOffsetSeconds -
    (events[0].startBeat - 3) * 60 / score.bpm) < 1e-10);
  assert.deepEqual(planCompositionTimeline(score, totalBeats(score)), []);
});

test('invalid tempo, timeline position and nonfinite timing fail closed', () => {
  const score = preset('glass-garden');
  score.bpm = 0;
  assert.throws(() => planCompositionTimeline(score), /Invalid composition/);
  assert.throws(() => planCompositionTimeline(preset('glass-garden'), -1), /Invalid timeline/);
  assert.throws(() => beatAtAudioTime(120, 0, Number.NaN, 1, 4), /Invalid timeline/);
  assert.throws(() => new CompositionLookaheadCursor([]).pull(0, -1), /Invalid look-ahead/);
});
