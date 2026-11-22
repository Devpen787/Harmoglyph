/**
 * W2-A score → continuous motion: the melodic Ribbon grammar.
 *
 * Pure and deterministic. No DOM, React, Web Audio, Date.now(), Math.random()
 * or state carried between calls. A frame is a function of
 * (validated composition, score beat, config) only, so frame cadence, pause,
 * seek and replay cannot change what is drawn for a given beat.
 *
 * Model (per track):
 *   θ(b) = −π/2 + 2π·b / totalBeats            same onset→angle mapping as deriveGeometry
 *   r(b) = r₀ + Σ_{onsetᵢ ≤ b} (rᵢ − rᵢ₋₁) · s(b − onsetᵢ)
 * where rᵢ is the existing deriveGeometry radius of note i (pitch + voice) and
 * s(τ) is the unit step response of an under-damped second-order system
 * (natural frequency ω per beat, damping ratio ζ). Because s(0) = 0 and s′(0) = 0,
 * r(b) is continuous with a continuous first derivative across every onset:
 * the ribbon glides to each new pitch, overshoots by e^(−ζπ/√(1−ζ²)) of the
 * interval, and settles. Repeated pitches add no radial motion.
 *
 *   width(b) = BASE + Σ velocityᵢ · (HOLD·hold(τ, durationᵢ) + SWELL·α(τ)), τ = b − onsetᵢ
 * α is a smooth onset swell (zero at the onset, peak after ATTACK beats);
 * hold is a smoothstep plateau for the written duration. Every onset is
 * visible as thickness even when the pitch is unchanged.
 *
 * Overlap (W2-C): several notes may sound at once on one voice. Every sample
 * lists all of them (activeNoteIds, onset order). The NEWEST sounding note owns
 * the position (noteId) and sets the pitch target; when it ends while an older
 * note still sounds, the target returns to that older note. Thickness sums every
 * sounding note, so both contributions stay visible. Without overlap this is
 * identical to targeting each note at its onset.
 *
 * Attribution (W2-B): a sample names a note only while that note sounds
 * (onset ≤ b < onset + duration). Samples in silence are kind 'rest', name no
 * note, and record only which note preceded them. They are a designed visual
 * bridge that keeps the line continuous, not score data.
 *
 * Derived from the score: onset, duration, pitch → radius target, interval → size
 * of the move and overshoot, velocity → thickness, track → separate ribbon.
 * Counterpoint lines are ANNOTATIONS only: voices are computed independently here.
 * Designed (aesthetic): ω, ζ, the radius scale (inherited from deriveGeometry),
 * swell/hold sizes, sampling step, palette and glow.
 */
import { deriveGeometry, sortedNotes, totalBeats, validateComposition, type CompositionNote, type MusicalComposition } from './composition.ts';

export interface RibbonConfig {
  /** Natural angular frequency of the radial spring, radians per beat. */
  omegaPerBeat: number;
  /** Damping ratio ζ, 0 < ζ < 1 (under-damped). */
  damping: number;
  /** Trail sampling interval in beats. */
  sampleStep: number;
}

export const DEFAULT_RIBBON_CONFIG: RibbonConfig = { omegaPerBeat: 7.5, damping: 0.42, sampleStep: 1 / 32 };

const CENTER = 300;
const R_MIN = 40;
const R_MAX = 285;
const BASE_WIDTH = 2.2;
const HOLD_WIDTH = 1.8;
const SWELL_WIDTH = 2.6;
const ATTACK_BEATS = 0.18;
const HOLD_RAMP_BEATS = 0.25;

/** Declared mappings, for the inspector. Keep in sync with the formulas above. */
export const RIBBON_MAPPINGS = {
  derived: [
    'Angle = 2π × beat / total beats (same as the arc grammars)',
    'Target radius = pitch + voice radius from the arc grammars',
    'Size of each move = pitch interval from the previous note on the same voice',
    'Thickness swell = note velocity, starting at the onset',
    'Plateau length = written duration',
    'Separate ribbon per voice',
    'Silence: thin bridge labelled as rest (designed, owned by no note)',
  ],
  designed: [
    'Spring stiffness ω and damping ζ (how far and how long it overshoots)',
    'Radius scale, swell and plateau sizes',
    'Palette, glow and trail sampling',
    'Dashed lines between notes that start together: annotation only, no interaction between voices',
  ],
} as const;

export interface RibbonSample {
  beat: number;
  theta: number;
  r: number;
  x: number;
  y: number;
  width: number;
  /** 'note' while a note sounds; 'rest' during silence (decorative bridge). */
  kind: 'note' | 'rest';
  /** The newest sounding note (owner of the position), or null during silence. */
  noteId: string | null;
  /** Every note sounding on this voice at this beat, onset order. Empty during silence. */
  activeNoteIds: string[];
  /** During silence: the note that preceded it. Null while a note sounds. */
  restAfterNoteId: string | null;
  trackId: string;
}

export interface RibbonTrackFrame {
  trackId: string;
  trackIndex: number;
  samples: RibbonSample[];
  head: RibbonSample | null;
}

/** Visual annotation only: two notes on different voices start together. No coupling is implied. */
export interface RibbonRelationship {
  kind: 'counterpoint';
  visualOnly: true;
  beat: number;
  noteIds: [string, string];
  trackIds: [string, string];
  /** Pitch of the first-listed voice minus the second, in semitones. */
  semitones: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface RibbonFrame {
  beat: number;
  span: number;
  tracks: RibbonTrackFrame[];
  relationships: RibbonRelationship[];
}

export interface NoteMotionDescription {
  noteId: string;
  trackId: string;
  previousNoteId: string | null;
  intervalSemitones: number | null;
  targetRadius: number;
  radiusChange: number;
  peakOvershoot: number;
  peakWidth: number;
  counterpointNoteIds: string[];
}

export interface RibbonSegment {
  kind: 'note' | 'rest';
  /** Sounding note for 'note' segments; null for rest bridges. */
  noteId: string | null;
  /** For rest bridges: the note before the silence. */
  restAfterNoteId: string | null;
  trackId: string;
  d: string;
}

export function validateConfig(config: RibbonConfig): void {
  const ok =
    Number.isFinite(config.omegaPerBeat) && config.omegaPerBeat > 0 && config.omegaPerBeat <= 60 &&
    Number.isFinite(config.damping) && config.damping > 0 && config.damping < 1 &&
    Number.isFinite(config.sampleStep) && config.sampleStep > 0 && config.sampleStep <= 0.5;
  if (!ok) throw new RangeError('Invalid ribbon config: need 0 < ω ≤ 60, 0 < ζ < 1, 0 < sampleStep ≤ 0.5.');
}

/** Unit step response of an under-damped 2nd-order system. s(τ≤0) = 0, s′(0) = 0, s(∞) = 1. */
export function stepResponse(tau: number, omega: number, zeta: number): number {
  if (tau <= 0) return 0;
  const root = Math.sqrt(1 - zeta * zeta);
  const wd = omega * root;
  return 1 - Math.exp(-zeta * omega * tau) * (Math.cos(wd * tau) + (zeta / root) * Math.sin(wd * tau));
}

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Smooth onset swell: 0 at τ = 0, peak 1 at τ = ATTACK_BEATS, then decays. */
export const swell = (tau: number) => (tau <= 0 ? 0 : (tau / ATTACK_BEATS) * Math.exp(1 - tau / ATTACK_BEATS));

function hold(tau: number, duration: number): number {
  if (tau <= 0 || tau >= duration) return 0;
  const ramp = Math.min(HOLD_RAMP_BEATS, duration / 2);
  return smoothstep(0, ramp, tau) * (1 - smoothstep(duration - ramp, duration, tau));
}

/** Thickness at beat b from every started note of one voice (shared by all motion grammars). */
export function widthAt(notes: CompositionNote[], beat: number): number {
  let width = BASE_WIDTH;
  for (const note of notes) {
    const tau = beat - note.startBeat;
    if (tau < 0) break;
    width += note.velocity * (HOLD_WIDTH * hold(tau, note.durationBeats) + SWELL_WIDTH * swell(tau));
  }
  return width;
}

const sounds = (n: CompositionNote, beat: number) => beat >= n.startBeat - 1e-9 && beat < n.startBeat + n.durationBeats - 1e-9;

/** All notes sounding at beat b (onset order); the newest owns the sample. Notes sorted by onset. */
export function attributionAt(notes: CompositionNote[], beat: number): Pick<RibbonSample, 'kind' | 'noteId' | 'restAfterNoteId' | 'activeNoteIds'> {
  let last: CompositionNote | null = null;
  const active: string[] = [];
  for (const note of notes) {
    if (note.startBeat > beat + 1e-9) break;
    last = note;
    if (sounds(note, beat)) active.push(note.id);
  }
  if (active.length) return { kind: 'note', noteId: active[active.length - 1], restAfterNoteId: null, activeNoteIds: active };
  return { kind: 'rest', noteId: null, restAfterNoteId: last?.id ?? null, activeNoteIds: [] };
}

/** A change of motion owner: from beat t, the pitch target is `note`. */
export interface OwnerEvent { t: number; note: CompositionNote }

/**
 * When the motion owner changes on one voice: at every onset, and at any note end
 * that reveals an older still-sounding note. Silence keeps the last owner.
 */
export function ownerEvents(notes: CompositionNote[]): OwnerEvent[] {
  if (!notes.length) return [];
  const times = [...new Set(notes.flatMap((n) => [n.startBeat, n.startBeat + n.durationBeats]))].sort((a, b) => a - b);
  const events: OwnerEvent[] = [];
  for (const t of times) {
    let owner: CompositionNote | null = null;
    for (const n of notes) if (sounds(n, t)) owner = n; // notes in onset order → last sounding is newest
    if (owner && events.at(-1)?.note.id !== owner.id) events.push({ t, note: owner });
  }
  return events;
}

/** Σ-of-step-responses target follower: value₀ + Σ (valueₖ − valueₖ₋₁)·s(b − tₖ). */
export function springFollow(events: Array<{ t: number; value: number }>, beat: number, omega: number, zeta: number): number {
  let v = events[0].value;
  for (let k = 1; k < events.length; k++) {
    const tau = beat - events[k].t;
    if (tau < 0) break;
    v += (events[k].value - events[k - 1].value) * stepResponse(tau, omega, zeta);
  }
  return v;
}

/** Other notes on the same voice that sound at the same time as noteId. */
export function overlappingNoteIds(composition: MusicalComposition, noteId: string): string[] {
  const note = composition.notes.find((n) => n.id === noteId);
  if (!note) return [];
  return sortedNotes(composition)
    .filter((n) => n.id !== noteId && n.trackId === note.trackId && n.startBeat < note.startBeat + note.durationBeats - 1e-9 && note.startBeat < n.startBeat + n.durationBeats - 1e-9)
    .map((n) => n.id);
}

export interface PreparedTrack {
  trackId: string;
  trackIndex: number;
  notes: CompositionNote[];
  radii: number[];
  /** Radius target per owner change (see ownerEvents). */
  radiusEvents: Array<{ t: number; value: number }>;
}

export function prepare(composition: MusicalComposition): { span: number; tracks: PreparedTrack[] } {
  const errors = validateComposition(composition);
  if (errors.length) throw new Error('Invalid composition: ' + errors.join('; '));
  const radiusById = new Map(deriveGeometry(composition).map((m) => [m.noteId, m.radius]));
  const notes = sortedNotes(composition);
  return {
    span: totalBeats(composition),
    tracks: composition.tracks.map((track, trackIndex) => {
      const trackNotes = notes.filter((n) => n.trackId === track.id);
      return {
        trackId: track.id, trackIndex, notes: trackNotes, radii: trackNotes.map((n) => radiusById.get(n.id)!),
        radiusEvents: ownerEvents(trackNotes).map((e) => ({ t: e.t, value: radiusById.get(e.note.id)! })),
      };
    }),
  };
}

function sampleTrack(track: PreparedTrack, beat: number, span: number, config: RibbonConfig): RibbonSample {
  const { notes } = track;
  let r = springFollow(track.radiusEvents, beat, config.omegaPerBeat, config.damping);
  r = Math.min(R_MAX, Math.max(R_MIN, r));
  const theta = -Math.PI / 2 + (2 * Math.PI * beat) / span;
  return {
    beat,
    theta,
    r,
    x: CENTER + Math.cos(theta) * r,
    y: CENTER + Math.sin(theta) * r,
    width: widthAt(notes, beat),
    ...attributionAt(notes, beat),
    trackId: track.trackId,
  };
}

/**
 * Ribbon state at a score beat. Beats outside [0, totalBeats] are clamped;
 * non-finite beats, invalid scores and invalid configs throw.
 */
export function computeRibbonFrame(composition: MusicalComposition, beat: number, config: RibbonConfig = DEFAULT_RIBBON_CONFIG): RibbonFrame {
  if (!Number.isFinite(beat)) throw new RangeError('Ribbon beat must be finite.');
  validateConfig(config);
  const { span, tracks } = prepare(composition);
  const at = Math.min(span, Math.max(0, beat));

  const frames: RibbonTrackFrame[] = tracks.map((track) => {
    const samples: RibbonSample[] = [];
    if (track.notes.length && track.notes[0].startBeat <= at) {
      const t0 = track.notes[0].startBeat;
      // Fixed grid t0 + k·step: identical sample beats on every call → earlier trail never changes.
      const lastK = Math.floor((at - t0) / config.sampleStep + 1e-9);
      for (let k = 0; k <= lastK; k++) samples.push(sampleTrack(track, t0 + k * config.sampleStep, span, config));
      const gridEnd = t0 + lastK * config.sampleStep;
      if (at - gridEnd > 1e-9) samples.push(sampleTrack(track, at, span, config)); // live head
    }
    return { trackId: track.trackId, trackIndex: track.trackIndex, samples, head: samples.at(-1) ?? null };
  });

  const relationships: RibbonRelationship[] = [];
  for (let a = 0; a < tracks.length; a++) {
    for (let b = a + 1; b < tracks.length; b++) {
      for (const na of tracks[a].notes) {
        if (na.startBeat > at) continue;
        const nb = tracks[b].notes.find((n) => n.startBeat === na.startBeat);
        if (!nb) continue;
        const pa = sampleTrack(tracks[a], na.startBeat, span, config);
        const pb = sampleTrack(tracks[b], nb.startBeat, span, config);
        relationships.push({
          kind: 'counterpoint',
          visualOnly: true,
          beat: na.startBeat,
          noteIds: [na.id, nb.id],
          trackIds: [tracks[a].trackId, tracks[b].trackId],
          semitones: na.midi - nb.midi,
          from: { x: pa.x, y: pa.y },
          to: { x: pb.x, y: pb.y },
        });
      }
    }
  }
  relationships.sort((p, q) => p.beat - q.beat || p.noteIds[0].localeCompare(q.noteIds[0]));

  return { beat: at, span, tracks: frames, relationships };
}

/** What the inspector shows for one note: its relationships and how they move the ribbon. */
export function describeNoteMotion(composition: MusicalComposition, noteId: string, config: RibbonConfig = DEFAULT_RIBBON_CONFIG): NoteMotionDescription {
  validateConfig(config);
  const { tracks } = prepare(composition);
  const track = tracks.find((t) => t.notes.some((n) => n.id === noteId));
  if (!track) throw new Error(`Unknown note ${noteId}.`);
  const i = track.notes.findIndex((n) => n.id === noteId);
  const note = track.notes[i];
  const prev = i > 0 ? track.notes[i - 1] : null;
  const radiusChange = prev ? track.radii[i] - track.radii[i - 1] : 0;
  const z = config.damping;
  return {
    noteId,
    trackId: track.trackId,
    previousNoteId: prev?.id ?? null,
    intervalSemitones: prev ? note.midi - prev.midi : null,
    targetRadius: track.radii[i],
    radiusChange,
    peakOvershoot: Math.abs(radiusChange) * Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z)),
    peakWidth: BASE_WIDTH + note.velocity * (HOLD_WIDTH + SWELL_WIDTH),
    counterpointNoteIds: tracks
      .filter((t) => t.trackId !== track.trackId)
      .flatMap((t) => t.notes.filter((n) => n.startBeat === note.startBeat).map((n) => n.id)),
  };
}

const fmt = (n: number) => n.toFixed(2);

/**
 * Variable-width outline split per note so each note's stretch of ribbon is
 * its own selectable shape. Normals are computed on the whole track, and each
 * segment includes the next segment's first sample, so neighbours meet without gaps.
 */
export function ribbonSegments(track: RibbonTrackFrame): RibbonSegment[] {
  const s = track.samples;
  if (s.length < 2) return [];
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const h = s[i].width / 2;
    left.push([s[i].x + nx * h, s[i].y + ny * h]);
    right.push([s[i].x - nx * h, s[i].y - ny * h]);
  }
  const key = (x: RibbonSample) => `${x.kind}:${x.noteId ?? x.restAfterNoteId}`;
  const segments: RibbonSegment[] = [];
  let start = 0;
  for (let i = 1; i <= s.length; i++) {
    if (i === s.length || key(s[i]) !== key(s[start])) {
      const end = Math.min(i, s.length - 1); // include the boundary sample
      if (end > start) {
        const pts = [...left.slice(start, end + 1), ...right.slice(start, end + 1).reverse()];
        segments.push({
          kind: s[start].kind,
          noteId: s[start].noteId,
          restAfterNoteId: s[start].restAfterNoteId,
          trackId: track.trackId,
          d: 'M ' + pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L ') + ' Z',
        });
      }
      start = i;
    }
  }
  return segments;
}
