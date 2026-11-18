import {
  sortedNotes,
  totalBeats,
  validateComposition,
  type MusicalComposition,
  type CompositionNote,
} from './composition.ts';

/** A score event with explicit musical and real-time units (no Web Audio dependency). */
export interface TimedCompositionNote {
  id: string;
  note: CompositionNote;
  startBeat: number;
  startOffsetSeconds: number;
  durationSeconds: number;
}

/**
 * Converts the validated, beat-domain composition into a stable event order.
 * A seek starts on future note onsets; it does not synthesize the remaining
 * tail of notes that started before the seek. That limitation is explicit.
 */
export function planCompositionTimeline(
  composition: MusicalComposition,
  fromBeat = 0,
): TimedCompositionNote[] {
  const errors = validateComposition(composition);
  if (errors.length) throw new Error('Invalid composition: ' + errors.join('; '));
  if (!Number.isFinite(fromBeat) || fromBeat < 0 || fromBeat > totalBeats(composition)) {
    throw new RangeError('Invalid timeline start beat.');
  }

  const secondsPerBeat = 60 / composition.bpm;
  return sortedNotes(composition)
    .filter((note) => note.startBeat >= fromBeat - 1e-9)
    .map((note) => ({
      id: note.id,
      note,
      startBeat: note.startBeat,
      startOffsetSeconds: (note.startBeat - fromBeat) * secondsPerBeat,
      durationSeconds: note.durationBeats * secondsPerBeat,
    }));
}

/**
 * Partitions a batch returned by CompositionLookaheadCursor.pull() into events
 * whose nominal onset has already passed (`late`) and those still ahead (`onTime`),
 * relative to the same `elapsedSeconds` value passed to pull().
 *
 * This does not change the scheduling policy — the engine plays late notes at
 * AudioContext.currentTime rather than skipping them, which is intentional
 * (documented in design.md). What it adds is observability: callers that want
 * to log, warn, or count coalesced onsets can do so without reimplementing the
 * comparison. Both arrays preserve the original ascending-offset order.
 *
 * Usage:
 *   const batch = cursor.pull(elapsed, 0.18);
 *   const { late, onTime } = classifyScheduledEvents(batch, elapsed);
 *   if (late.length) console.warn(`${late.length} overdue notes clamped to now`);
 */
export function classifyScheduledEvents(
  batch: readonly TimedCompositionNote[],
  elapsedSeconds: number,
): { late: TimedCompositionNote[]; onTime: TimedCompositionNote[] } {
  const late: TimedCompositionNote[] = [];
  const onTime: TimedCompositionNote[] = [];
  for (const event of batch) {
    if (event.startOffsetSeconds < elapsedSeconds - 1e-9) {
      late.push(event);
    } else {
      onTime.push(event);
    }
  }
  return { late, onTime };
}

/** Samples score position from an audio-clock time, not an animation frame count. */
export function beatAtAudioTime(
  bpm: number,
  fromBeat: number,
  originAudioSeconds: number,
  observedAudioSeconds: number,
  endBeat: number,
): number {
  if (![bpm, fromBeat, originAudioSeconds, observedAudioSeconds, endBeat].every(Number.isFinite) ||
      bpm <= 0 || fromBeat < 0 || endBeat < fromBeat) {
    throw new RangeError('Invalid timeline timebase.');
  }
  return Math.min(endBeat, Math.max(fromBeat,
    fromBeat + (observedAudioSeconds - originAudioSeconds) * bpm / 60));
}

/**
 * Schedules each event once when its onset falls inside a look-ahead horizon.
 * Polling cadence may vary without altering the target onset timestamps.
 *
 * Seek / pause-resume lifecycle:
 *   1. Call planCompositionTimeline(score, newBeat) to get a fresh event list.
 *   2. Call cursor.reset(newEvents) to point the cursor at that list from index 0.
 * Never reuse a cursor across a seek without calling reset(); nextIndex is not
 * automatically rewound and stale state would silently drop all new events.
 */
export class CompositionLookaheadCursor {
  private nextIndex = 0;
  private _events: readonly TimedCompositionNote[];

  constructor(events: readonly TimedCompositionNote[]) {
    this._events = events;
  }

  /** The event list currently tracked by this cursor. */
  public get events(): readonly TimedCompositionNote[] {
    return this._events;
  }

  /**
   * Reset the cursor to a new event list at index 0.
   * Call this after every seek or restart — do not construct a new instance.
   */
  public reset(newEvents: readonly TimedCompositionNote[]): void {
    this._events = newEvents;
    this.nextIndex = 0;
  }

  public pull(elapsedSeconds: number, horizonSeconds: number): TimedCompositionNote[] {
    if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(horizonSeconds) ||
        horizonSeconds < 0) {
      throw new RangeError('Invalid look-ahead clock or horizon.');
    }
    const ready: TimedCompositionNote[] = [];
    const limit = elapsedSeconds + horizonSeconds + 1e-9;
    while (this.nextIndex < this._events.length &&
           this._events[this.nextIndex].startOffsetSeconds <= limit) {
      ready.push(this._events[this.nextIndex++]);
    }
    return ready;
  }

  public get remaining(): number {
    return this._events.length - this.nextIndex;
  }
}
