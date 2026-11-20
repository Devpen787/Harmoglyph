import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPOSITION_PRESETS, cloneComposition, sortedNotes, totalBeats } from './composition.ts';
import { beatAtAudioTime, classifyScheduledEvents, CompositionLookaheadCursor, planCompositionTimeline } from './compositionTimeline.ts';

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

test('cursor reset() after seek replays all events from new timeline without constructing a new instance', () => {
  // R4 — seek must not silently drop notes when the same cursor is reused.
  // Before this fix, CompositionLookaheadCursor had no reset(); callers were
  // forced to allocate a new instance and any accidental reuse would emit zero
  // notes from the new timeline because nextIndex was stuck at the old end.
  const score = preset('ascending-light');
  const events0 = planCompositionTimeline(score);

  // Play the full timeline through the cursor.
  const cursor = new CompositionLookaheadCursor(events0);
  const full = cursor.pull(999, 0.18);
  assert.equal(full.length, events0.length);
  assert.equal(cursor.remaining, 0);

  // User seeks back to beat 0. Re-plan produces a fresh identical event list.
  const seekEvents = planCompositionTimeline(score, 0);
  assert.equal(seekEvents.length, events0.length);

  // reset() must reset the internal pointer and accept the new event list.
  cursor.reset(seekEvents);
  assert.equal(cursor.remaining, seekEvents.length);

  // Pulling from elapsed=0 must re-emit all events that fall within the horizon.
  const replayed = cursor.pull(999, 0.18);
  assert.equal(replayed.length, seekEvents.length);
  assert.deepEqual(replayed.map((e) => e.id), seekEvents.map((e) => e.id));
});

test('cursor reset() mid-play discards unscheduled old events and replays new timeline', () => {
  // Partial-play seek: only half the notes consumed, then seek to a later beat.
  const score = preset('pulse-study');
  const events0 = planCompositionTimeline(score);
  const cursor = new CompositionLookaheadCursor(events0);

  // Consume the first half.
  const midOffset = events0[Math.floor(events0.length / 2)].startOffsetSeconds;
  const firstHalf = cursor.pull(midOffset, 0.18);
  assert.ok(firstHalf.length > 0);
  const unconsumedBefore = cursor.remaining;
  assert.ok(unconsumedBefore > 0);

  // Seek to beat 3 — only later notes remain in the new plan.
  const seekEvents = planCompositionTimeline(score, 3);
  cursor.reset(seekEvents);

  // After reset, remaining must reflect the new plan, not the stale position.
  assert.equal(cursor.remaining, seekEvents.length);

  // Draining must yield exactly the new plan's events in order.
  const after = cursor.pull(999, 0.18);
  assert.equal(after.length, seekEvents.length);
  assert.deepEqual(after.map((e) => e.id), seekEvents.map((e) => e.id));
});

test('delayed callback coalesces overdue notes but preserves distinct offsets for consumer classification', () => {
  // Models the actual CompositionJourneyView.scheduleUpcoming() path under a
  // main-thread delay. When scheduleUpcoming() fires 400 ms late, pull() returns
  // all notes whose nominal onset has already passed alongside on-time notes in
  // one batch. scheduleStepAt() clamps each past onset to AudioContext.currentTime,
  // so overdue notes sound simultaneously even though their score positions differ.
  //
  // This is the documented intentional policy (play late rather than skip). The
  // gap: the caller has no way to identify which returned events are overdue.
  // Fix: export classifyScheduledEvents(batch, elapsedSeconds) that separates
  // the batch into { late, onTime } so consumers can log, warn, or skip.

  const score = COMPOSITION_PRESETS.find((p) => p.id === 'pulse-study')!;
  const events = planCompositionTimeline(score);
  const cursor = new CompositionLookaheadCursor(events);

  // Simulate: main thread blocked for 400 ms. First poll arrives at elapsed=0.40 s.
  const delayedElapsed = 0.40;
  const horizon = 0.18;
  const batch = cursor.pull(delayedElapsed, horizon);

  // The batch must still return distinct, in-order offsets.
  assert.ok(batch.length >= 2, 'delayed poll should return multiple events');
  for (let i = 1; i < batch.length; i++) {
    assert.ok(
      batch[i].startOffsetSeconds >= batch[i - 1].startOffsetSeconds,
      'events must remain in ascending offset order within a delayed batch',
    );
    assert.notEqual(batch[i].startOffsetSeconds, batch[i - 1].startOffsetSeconds,
      'distinct score notes must retain distinct startOffsetSeconds even when batched late');
  }

  // classifyScheduledEvents must partition the batch correctly.
  const { late, onTime } = classifyScheduledEvents(batch, delayedElapsed);
  assert.ok(late.length >= 1, 'at least one event is overdue (offset < elapsed)');
  assert.ok(onTime.length >= 1, 'at least one event is still ahead (offset >= elapsed)');
  assert.equal(late.length + onTime.length, batch.length, 'partition is exhaustive');
  assert.ok(late.every((e) => e.startOffsetSeconds < delayedElapsed - 1e-9),
    'every late event has offset strictly before elapsed');
  assert.ok(onTime.every((e) => e.startOffsetSeconds >= delayedElapsed - 1e-9),
    'every on-time event has offset at or after elapsed');

  // Ordering within each group is preserved.
  for (let i = 1; i < late.length; i++) {
    assert.ok(late[i].startOffsetSeconds >= late[i - 1].startOffsetSeconds);
  }
  for (let i = 1; i < onTime.length; i++) {
    assert.ok(onTime[i].startOffsetSeconds >= onTime[i - 1].startOffsetSeconds);
  }
});

test('classifyScheduledEvents handles zero-delay poll (all events on-time)', () => {
  const score = COMPOSITION_PRESETS.find((p) => p.id === 'ascending-light')!;
  const events = planCompositionTimeline(score);
  const cursor = new CompositionLookaheadCursor(events);

  // First poll at elapsed=0, horizon=0.18: all emitted notes have offset >= 0.
  const batch = cursor.pull(0, 0.18);
  const { late, onTime } = classifyScheduledEvents(batch, 0);
  assert.equal(late.length, 0, 'no events are late when elapsed is 0');
  assert.equal(onTime.length, batch.length);
});

test('classifyScheduledEvents with an empty batch returns empty partitions', () => {
  const { late, onTime } = classifyScheduledEvents([], 1.0);
  assert.equal(late.length, 0);
  assert.equal(onTime.length, 0);
});

test('invalid tempo, timeline position and nonfinite timing fail closed', () => {
  const score = preset('glass-garden');
  score.bpm = 0;
  assert.throws(() => planCompositionTimeline(score), /Invalid composition/);
  assert.throws(() => planCompositionTimeline(preset('glass-garden'), -1), /Invalid timeline/);
  assert.throws(() => beatAtAudioTime(120, 0, Number.NaN, 1, 4), /Invalid timeline/);
  assert.throws(() => new CompositionLookaheadCursor([]).pull(0, -1), /Invalid look-ahead/);
});
