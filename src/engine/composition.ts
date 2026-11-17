import type { EvaluatedRowStep, SheetRawGrid, SynthVoiceId } from '../types/chimera.ts';

/** One canonical score feeds the sound, artwork, inspector and spreadsheet projection. */
export interface CompositionNote {
  id: string;
  trackId: string;
  midi: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

export interface CompositionTrack {
  id: string;
  label: string;
  voice: SynthVoiceId;
}

export interface MusicalComposition {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  tuning: '12tet';
  referenceMidi: number;
  tracks: CompositionTrack[];
  notes: CompositionNote[];
}

export interface GeometryMark {
  noteId: string;
  trackId: string;
  noteIndex: number;
  midi: number;
  hz: number;
  ratioToRoot: number;
  startAngle: number;
  sweepAngle: number;
  radius: number;
  strokeWidth: number;
  harmonicHz: number[];
}

export const PHRASE_COLORS = ['#f5a7ba', '#a99bff', '#74e5dc', '#ffc77d', '#9bc6ff', '#e2a4f5'];
export const MAX_COMPOSITION_BEATS = 24; // Maps to the existing A1:F48 eighth-note grid.
const SYNTH_VOICES: SynthVoiceId[] = ['music-box', 'celestial-chime', 'haunted-organ', 'analog-pluck'];

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const PITCH_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function noteName(midi: number): string {
  return `${PITCH_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function totalBeats(composition: MusicalComposition): number {
  return Math.max(
    composition.beatsPerBar,
    Math.ceil(Math.max(0, ...composition.notes.map((n) => n.startBeat + n.durationBeats)) / composition.beatsPerBar) * composition.beatsPerBar,
  );
}

export function sortedNotes(composition: MusicalComposition): CompositionNote[] {
  return [...composition.notes].sort((a, b) => a.startBeat - b.startBeat || a.trackId.localeCompare(b.trackId) || a.id.localeCompare(b.id));
}

export function validateComposition(composition: MusicalComposition): string[] {
  const errors: string[] = [];
  if (composition.tuning !== '12tet') errors.push('Only 12-tone equal temperament is supported in the song composer.');
  if (!Number.isFinite(composition.bpm) || composition.bpm < 40 || composition.bpm > 240) errors.push('Tempo must be 40–240 BPM.');
  if (!Number.isInteger(composition.beatsPerBar) || composition.beatsPerBar < 1 || composition.beatsPerBar > 12) errors.push('Invalid meter.');
  if (!composition.title.trim()) errors.push('Give the composition a title.');
  if (!composition.tracks.length || composition.tracks.length > 3) errors.push('A composition needs one to three tracks.');
  if (new Set(composition.tracks.map((track) => track.id)).size !== composition.tracks.length) errors.push('Track IDs must be unique.');
  if (composition.tracks.some((track) => !SYNTH_VOICES.includes(track.voice))) errors.push('Unknown synthesizer voice.');
  if (composition.notes.length === 0) errors.push('Add at least one note.');
  if (totalBeats(composition) > MAX_COMPOSITION_BEATS) errors.push(`The present composer supports up to ${MAX_COMPOSITION_BEATS} beats.`);
  const ids = new Set<string>();
  for (const note of composition.notes) {
    if (ids.has(note.id)) errors.push(`Duplicate note ID ${note.id}.`);
    ids.add(note.id);
    if (!composition.tracks.some((t) => t.id === note.trackId)) errors.push(`Unknown track ${note.trackId}.`);
    if (!Number.isInteger(note.midi) || note.midi < 36 || note.midi > 96) errors.push(`Invalid MIDI pitch for ${note.id}.`);
    if (!Number.isFinite(note.startBeat) || note.startBeat < 0 || note.startBeat * 2 !== Math.round(note.startBeat * 2)) errors.push(`Invalid onset for ${note.id}.`);
    if (!Number.isFinite(note.durationBeats) || note.durationBeats < 0.5 || note.durationBeats * 2 !== Math.round(note.durationBeats * 2)) errors.push(`Invalid duration for ${note.id}.`);
    if (!Number.isFinite(note.velocity) || note.velocity < 0 || note.velocity > 1) errors.push(`Invalid velocity for ${note.id}.`);
  }
  return errors;
}

/** Geometric invariants. Angles are radians; the top of the canvas is -π/2. */
export function deriveGeometry(composition: MusicalComposition): GeometryMark[] {
  const span = totalBeats(composition);
  return sortedNotes(composition).map((note, index) => {
    const trackIndex = Math.max(0, composition.tracks.findIndex((track) => track.id === note.trackId));
    const hz = midiToHz(note.midi);
    return {
      noteId: note.id,
      trackId: note.trackId,
      noteIndex: index,
      midi: note.midi,
      hz,
      ratioToRoot: hz / midiToHz(composition.referenceMidi),
      startAngle: -Math.PI / 2 + (Math.PI * 2 * note.startBeat) / span,
      sweepAngle: (Math.PI * 2 * note.durationBeats) / span,
      // The vertical scale and track separation are explicitly *designed* mappings.
      radius: clamp(105 + (note.midi - 48) * 3.8 + trackIndex * 10, 64, 268),
      strokeWidth: 3.5 + note.velocity * 5.5,
      harmonicHz: [1, 2, 3, 4, 5].map((k) => k * hz),
    };
  });
}

export function noteAsSynthStep(note: CompositionNote, bpm: number): EvaluatedRowStep {
  return {
    row: 1,
    freqHz: midiToHz(note.midi),
    gate: clamp(note.velocity, 0, 1),
    fmIndex: 2.2,
    orbitX: 48,
    decayMs: clamp((note.durationBeats * 60000) / bpm * 0.86, 90, 900),
    modRatio: 1.5,
    noteName: noteName(note.midi),
    hasError: false,
  };
}

/** The old spreadsheet has one timbre and one row per eighth beat. Never silently drop counterpoint or voices. */
export function canProjectToSpreadsheet(composition: MusicalComposition): boolean {
  if (validateComposition(composition).length) return false;
  const notes = sortedNotes(composition);
  if (new Set(notes.map((note) => note.trackId)).size > 1) return false;
  return notes.every((n, i) => i === 0 || n.startBeat >= notes[i - 1].startBeat + notes[i - 1].durationBeats);
}

export function projectToSpreadsheet(composition: MusicalComposition): { grid: SheetRawGrid; rowCount: number } {
  if (!canProjectToSpreadsheet(composition)) {
    throw new Error('Overlapping voices, multiple timbres, or invalid note values cannot be safely transferred to the monophonic A1:F48 step sequencer.');
  }
  const rowCount = Math.max(8, Math.min(48, Math.ceil(totalBeats(composition) * 2)));
  const grid: SheetRawGrid = {};
  for (let row = 1; row <= rowCount; row++) {
    grid[`A${row}`] = '261.626';
    grid[`B${row}`] = '0';
    grid[`C${row}`] = '2.2';
    grid[`D${row}`] = '48';
    grid[`E${row}`] = '300';
    grid[`F${row}`] = '1.5';
  }
  for (const note of composition.notes) {
    const row = Math.round(note.startBeat * 2) + 1;
    const step = noteAsSynthStep(note, composition.bpm);
    grid[`A${row}`] = step.freqHz.toFixed(5);
    grid[`B${row}`] = step.gate.toFixed(3);
    grid[`E${row}`] = String(Math.round(step.decayMs));
  }
  return { grid, rowCount };
}

function makeTrackNotes(trackId: string, pitches: number[], durations: number[], offset = 0): CompositionNote[] {
  let beat = offset;
  return pitches.map((midi, index) => {
    const durationBeats = durations[index];
    const note = { id: `${trackId}-${index + 1}`, trackId, midi, startBeat: beat, durationBeats, velocity: 0.62 + ((index * 3) % 5) * 0.065 };
    beat += durationBeats;
    return note;
  });
}

const melodyTrack: CompositionTrack = { id: 'lead', label: 'Melody', voice: 'music-box' };

export const COMPOSITION_PRESETS: MusicalComposition[] = [
  {
    id: 'first-mark', title: 'First Mark', bpm: 112, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
    tracks: [melodyTrack],
    notes: makeTrackNotes('lead', [60], [1]),
  },
  {
    id: 'glass-garden', title: 'Glass Garden', bpm: 112, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
    tracks: [melodyTrack],
    notes: makeTrackNotes('lead', [60, 64, 67, 72, 71, 67, 64, 62, 65, 69, 72, 76, 74, 69, 67, 60], [1, .5, .5, 2, 1, .5, .5, 2, 1, .5, .5, 2, 1, .5, .5, 2]),
  },
  {
    id: 'ascending-light', title: 'Ascending Light', bpm: 96, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
    tracks: [melodyTrack],
    notes: makeTrackNotes('lead', [60, 62, 64, 65, 67, 69, 71, 72], [1, 1, 1, 1, 1, 1, 1, 1]),
  },
  {
    id: 'pulse-study', title: 'Pulse Study', bpm: 132, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
    tracks: [melodyTrack],
    notes: makeTrackNotes('lead', [60, 60, 67, 60, 60, 64, 67, 60, 60, 60, 67, 60, 72, 67, 64, 60], Array(16).fill(.5)),
  },
  {
    id: 'leap-dialogue', title: 'Leap Dialogue', bpm: 104, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
    tracks: [melodyTrack, { id: 'counter', label: 'Counterline', voice: 'celestial-chime' }],
    notes: [
      ...makeTrackNotes('lead', [60, 67, 76, 64, 72, 67, 74, 60], Array(8).fill(1)),
      ...makeTrackNotes('counter', [48, 55, 53, 55], Array(4).fill(2)),
    ],
  },
];

export const cloneComposition = (composition: MusicalComposition): MusicalComposition => ({
  ...composition,
  tracks: composition.tracks.map((track) => ({ ...track })),
  notes: composition.notes.map((note) => ({ ...note })),
});
