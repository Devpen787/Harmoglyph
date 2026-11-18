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
 */
export class CompositionLookaheadCursor {
  private nextIndex = 0;

  constructor(readonly events: readonly TimedCompositionNote[]) {}

  public pull(elapsedSeconds: number, horizonSeconds: number): TimedCompositionNote[] {
    if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(horizonSeconds) ||
        horizonSeconds < 0) {
      throw new RangeError('Invalid look-ahead clock or horizon.');
    }
    const ready: TimedCompositionNote[] = [];
    const limit = elapsedSeconds + horizonSeconds + 1e-9;
    while (this.nextIndex < this.events.length &&
           this.events[this.nextIndex].startOffsetSeconds <= limit) {
      ready.push(this.events[this.nextIndex++]);
    }
    return ready;
  }

  public get remaining(): number {
    return this.events.length - this.nextIndex;
  }
}
