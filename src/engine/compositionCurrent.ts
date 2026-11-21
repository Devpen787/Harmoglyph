/**
 * W2-B candidate grammar "Current": the melody steers a forward-flowing stream.
 *
 * Pure and deterministic, like the circular Ribbon (compositionMotion.ts), and it
 * reuses that file's spring step response, thickness and attribution helpers.
 *
 * Per voice, on a fixed global grid b_k = k·h:
 *   m(b)       = m₀ + Σ (mᵢ − mᵢ₋₁)·s(b − onsetᵢ)      spring-smoothed pitch (semitones)
 *   ref(b)     = same, over the first note of each phrase (bar) on this voice
 *   heading(b) = −H·tanh(κ·(m(b) − ref(b)) / H)      κ = degrees per semitone, |heading| < H < 90°
 *   speed(b)   = 1 + ½·Σ velocityᵢ·swell(b − onsetᵢ)   each onset pushes the stream forward
 *   P(b + h)   = P(b) + L·speed·(cos, sin)(heading)·h  midpoint rule, then scaled so the
 *                                                      longest voice spans 440 units
 * Pitch contour within each phrase sets DIRECTION: every phrase starts level,
 * a repeated pitch runs straight, notes above the phrase's first note climb,
 * notes below it descend. An arch-shaped phrase draws a hill. Because
 * |heading| < 90°, every voice flows left→right and cannot loop back on itself.
 *
 * Voice coupling (real, not decorative). While a note of the primary voice and
 * a note of another voice sound together, the other voice is drawn toward the
 * primary one:
 *   P′_B(b) = P_B(b) + λ(b)·(P_A(b) − P_B(b)),  λ(b) = λmax·Σ consonance·window(b) ∈ [0, λmax]
 * window is a smoothstep plateau over the overlap; consonance comes from the
 * interval class (unison/octave 1, fifth .85, fourth .7, thirds/sixths .55,
 * seconds/sevenths .3, semitone/major-seventh/tritone .15). One-directional:
 * the melody is never moved. This is a geometric rule, not a physical force.
 *
 * Framing (designed): voice k starts 70 units below voice 0; the whole drawing
 * is translated so its bounding box is centred. The scale depends only on
 * rhythm and velocity, so a pitch edit changes earlier geometry by at most a
 * uniform translation.
 */
import { totalBeats, type CompositionNote, type MusicalComposition } from './composition.ts';
import { attributionAt, prepare, stepResponse, smoothstep, swell, widthAt, type PreparedTrack, type RibbonSample, type RibbonTrackFrame } from './compositionMotion.ts';

export interface CurrentConfig {
  omegaPerBeat: number;
  damping: number;
  sampleStep: number;
  /** κ: how much one semitone above the opening pitch turns the stream. */
  degreesPerSemitone: number;
  /** H: steering limit, below 90° so the stream always flows forward. */
  maxHeadingDeg: number;
  /** λmax: strongest pull of a voice toward the melody (0 disables coupling). */
  couplingMax: number;
}

export const DEFAULT_CURRENT_CONFIG: CurrentConfig = { omegaPerBeat: 7.5, damping: 0.42, sampleStep: 1 / 32, degreesPerSemitone: 7.5, maxHeadingDeg: 80, couplingMax: 0.3 };

/** Declared mappings for the inspector. Keep in sync with the formulas above. */
export const CURRENT_MAPPINGS = {
  derived: [
    'Direction = pitch above or below the first note of the current phrase (bar); higher climbs',
    'Turn speed = interval size, smoothed by the same damped spring as Ribbon',
    'Forward surge and thickness swell = note velocity at each onset',
    'Plateau length = written duration',
    'Separate stream per voice',
    'Counterline pulled toward the melody while both sound; strength = consonance of the interval',
  ],
  designed: [
    'Steering scale κ, steering limit H, pull limit λmax, spring ω and ζ',
    'Total stream length, 70-unit voice spacing and centring',
    'Silence: thin bridge labelled as rest (owned by no note)',
    'Palette, glow and pull-thread drawing',
  ],
} as const;

export interface CurrentCoupling {
  /** [primary-voice note, other-voice note] */
  noteIds: [string, string];
  trackIds: [string, string];
  start: number;
  end: number;
  intervalSemitones: number;
  intervalClass: number;
  consonance: number;
  /** Peak λ reached during this overlap. */
  maxPull: number;
}

export interface CurrentFrame {
  beat: number;
  span: number;
  tracks: RibbonTrackFrame[];
  couplings: CurrentCoupling[];
  /** Coupling strength λ at each sample of each track (always 0 for the primary voice). */
  pull: Record<string, number[]>;
}

export interface CurrentNoteDescription {
  noteId: string;
  trackId: string;
  phraseStartNoteId: string;
  semitonesFromPhraseStart: number;
  targetHeadingDeg: number;
  couplings: CurrentCoupling[];
}

const TARGET_LENGTH = 440;
const VOICE_SPACING = 70;
const RAD = Math.PI / 180;

const CONSONANCE: Record<number, number> = { 0: 1, 7: 0.85, 5: 0.7, 3: 0.55, 4: 0.55, 8: 0.55, 9: 0.55, 2: 0.3, 10: 0.3, 1: 0.15, 11: 0.15, 6: 0.15 };

function validateCurrentConfig(c: CurrentConfig): void {
  const ok =
    Number.isFinite(c.omegaPerBeat) && c.omegaPerBeat > 0 && c.omegaPerBeat <= 60 &&
    Number.isFinite(c.damping) && c.damping > 0 && c.damping < 1 &&
    Number.isFinite(c.sampleStep) && c.sampleStep > 0 && c.sampleStep <= 0.5 &&
    Number.isFinite(c.degreesPerSemitone) && c.degreesPerSemitone > 0 && c.degreesPerSemitone <= 30 &&
    Number.isFinite(c.maxHeadingDeg) && c.maxHeadingDeg > 0 && c.maxHeadingDeg < 90 &&
    Number.isFinite(c.couplingMax) && c.couplingMax >= 0 && c.couplingMax <= 0.5;
  if (!ok) throw new RangeError('Invalid current config: need 0 < ω ≤ 60, 0 < ζ < 1, 0 < step ≤ 0.5, 0 < κ ≤ 30, 0 < H < 90, 0 ≤ λmax ≤ 0.5.');
}

/** First note of each phrase (bar) on one voice, in onset order. */
function phraseStarts(notes: CompositionNote[], beatsPerBar: number): CompositionNote[] {
  const seen = new Set<number>();
  return notes.filter((n) => { const p = Math.floor(n.startBeat / beatsPerBar + 1e-9); if (seen.has(p)) return false; seen.add(p); return true; });
}

function smoothedPitch(seq: CompositionNote[], beat: number, c: CurrentConfig): number {
  let m = seq[0].midi;
  for (let i = 1; i < seq.length; i++) {
    const tau = beat - seq[i].startBeat;
    if (tau < 0) break;
    m += (seq[i].midi - seq[i - 1].midi) * stepResponse(tau, c.omegaPerBeat, c.damping);
  }
  return m;
}

interface Voice { notes: CompositionNote[]; phrases: CompositionNote[] }

function headingAt(v: Voice, beat: number, c: CurrentConfig): number {
  const H = c.maxHeadingDeg * RAD;
  return -H * Math.tanh((c.degreesPerSemitone * RAD * (smoothedPitch(v.notes, beat, c) - smoothedPitch(v.phrases, beat, c))) / H);
}

function speedAt(notes: CompositionNote[], beat: number): number {
  let v = 1;
  for (const n of notes) {
    const tau = beat - n.startBeat;
    if (tau < 0) break;
    v += 0.5 * n.velocity * swell(tau);
  }
  return v;
}

interface Pair { a: CompositionNote; b: CompositionNote; start: number; end: number; consonance: number; ramp: number }

function overlapPairs(primary: PreparedTrack, other: PreparedTrack): Pair[] {
  const pairs: Pair[] = [];
  for (const a of primary.notes) for (const b of other.notes) {
    const start = Math.max(a.startBeat, b.startBeat);
    const end = Math.min(a.startBeat + a.durationBeats, b.startBeat + b.durationBeats);
    if (end - start <= 1e-9) continue;
    const consonance = CONSONANCE[Math.abs(a.midi - b.midi) % 12];
    pairs.push({ a, b, start, end, consonance, ramp: Math.min(0.25, (end - start) / 2) });
  }
  return pairs.sort((p, q) => p.start - q.start || p.a.id.localeCompare(q.a.id));
}

function pullAt(pairs: Pair[], beat: number, c: CurrentConfig): number {
  let sum = 0;
  for (const p of pairs) {
    if (beat <= p.start || beat >= p.end) continue;
    sum += p.consonance * smoothstep(p.start, p.start + p.ramp, beat) * (1 - smoothstep(p.end - p.ramp, p.end, beat));
  }
  return c.couplingMax * Math.min(1, sum);
}

interface FullTrack {
  prepared: PreparedTrack;
  voice: Voice;
  /** grid index of the first sample (first onset) */
  k0: number;
  /** raw (unscaled, uncoupled) positions on the global grid from k0 */
  raw: Array<[number, number]>;
}

interface FullComposition {
  span: number;
  h: number;
  scale: number;
  offset: [number, number];
  tracks: FullTrack[];
  pairs: Pair[][];
  config: CurrentConfig;
}

function stepRaw(voice: Voice, from: [number, number], b: number, dt: number, c: CurrentConfig): [number, number] {
  const mid = b + dt / 2;
  const th = headingAt(voice, mid, c);
  const v = speedAt(voice.notes, mid);
  return [from[0] + v * Math.cos(th) * dt, from[1] + v * Math.sin(th) * dt];
}

const cache = new Map<string, FullComposition>();

function buildFull(composition: MusicalComposition, c: CurrentConfig): FullComposition {
  const key = JSON.stringify([composition.bpm, composition.beatsPerBar, composition.tracks, composition.notes, c]);
  const hit = cache.get(key);
  if (hit) return hit;
  const { span, tracks } = prepare(composition);
  const h = c.sampleStep;
  const lastK = Math.floor(span / h + 1e-9);
  const full: FullTrack[] = tracks.map((t) => {
    const voice: Voice = { notes: t.notes, phrases: phraseStarts(t.notes, composition.beatsPerBar) };
    if (!t.notes.length) return { prepared: t, voice, k0: lastK + 1, raw: [] };
    const k0 = Math.ceil(t.notes[0].startBeat / h - 1e-9);
    const raw: Array<[number, number]> = [[0, 0]];
    for (let k = k0; k < lastK; k++) raw.push(stepRaw(voice, raw[raw.length - 1], k * h, h, c));
    return { prepared: t, voice, k0, raw };
  });
  const length = (t: FullTrack) => t.raw.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - t.raw[i - 1][0], p[1] - t.raw[i - 1][1]) : 0), 0);
  const longest = Math.max(1e-9, ...full.map(length));
  const scale = TARGET_LENGTH / longest;
  const pairs = full.map((t, i) => (i === 0 ? [] : overlapPairs(full[0].prepared, t.prepared)));
  const base: FullComposition = { span, h, scale, offset: [0, 0], tracks: full, pairs, config: c };
  // Centre the completed drawing on the UNCOUPLED paths (with half-width margins).
  // A coupled point is a convex combination of two uncoupled points, so it stays
  // inside this box, and the melody's placement does not depend on the coupling.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  full.forEach((t, i) => t.raw.forEach((_, j) => {
    const b = (t.k0 + j) * h;
    const [x, y] = uncoupled(base, i, j);
    const w = widthAt(t.prepared.notes, b) / 2;
    minX = Math.min(minX, x - w); maxX = Math.max(maxX, x + w); minY = Math.min(minY, y - w); maxY = Math.max(maxY, y + w);
  }));
  base.offset = [300 - (minX + maxX) / 2, 300 - (minY + maxY) / 2];
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  cache.set(key, base);
  return base;
}

/** Uncoupled, scaled position of voice i at grid index j (or at a partial head beat). */
function uncoupled(f: FullComposition, i: number, j: number, headBeat?: number): [number, number] {
  const t = f.tracks[i];
  let p = t.raw[Math.min(j, t.raw.length - 1)];
  if (headBeat !== undefined) {
    const gridBeat = (t.k0 + j) * f.h;
    if (headBeat - gridBeat > 1e-9) p = stepRaw(t.voice, p, gridBeat, headBeat - gridBeat, f.config);
  }
  return [p[0] * f.scale + f.offset[0], p[1] * f.scale + i * VOICE_SPACING + f.offset[1]];
}

/** Final position of voice i, including coupling toward voice 0. */
function placed(f: FullComposition, i: number, j: number, beat: number, head = false): [number, number] {
  const p = uncoupled(f, i, j, head ? beat : undefined);
  if (i === 0) return p;
  const lambda = pullAt(f.pairs[i], beat, f.config);
  if (lambda === 0) return p;
  const t0 = f.tracks[0];
  const j0 = Math.floor((beat - t0.k0 * f.h) / f.h + 1e-9);
  if (j0 < 0) return p;
  const a = uncoupled(f, 0, j0, head ? beat : undefined);
  return [p[0] + lambda * (a[0] - p[0]), p[1] + lambda * (a[1] - p[1])];
}

/**
 * Current state at a score beat. Beats outside [0, totalBeats] are clamped;
 * non-finite beats, invalid scores and invalid configs throw.
 */
export function computeCurrentFrame(composition: MusicalComposition, beat: number, config: CurrentConfig = DEFAULT_CURRENT_CONFIG): CurrentFrame {
  if (!Number.isFinite(beat)) throw new RangeError('Current beat must be finite.');
  validateCurrentConfig(config);
  const f = buildFull(composition, config);
  const at = Math.min(f.span, Math.max(0, beat));
  const pull: Record<string, number[]> = {};
  const tracks: RibbonTrackFrame[] = f.tracks.map((t, i) => {
    const notes = t.prepared.notes;
    const samples: RibbonSample[] = [];
    const lambdas: number[] = [];
    const push = (b: number, j: number, head: boolean) => {
      const [x, y] = placed(f, i, j, b, head);
      samples.push({
        beat: b, theta: headingAt(t.voice, b, config), r: Math.hypot(x - 300, y - 300), x, y,
        width: widthAt(notes, b), ...attributionAt(notes, b), trackId: t.prepared.trackId,
      });
      lambdas.push(i === 0 ? 0 : pullAt(f.pairs[i], b, config));
    };
    if (t.raw.length && t.k0 * f.h <= at + 1e-9) {
      const lastJ = Math.min(t.raw.length - 1, Math.floor(at / f.h + 1e-9) - t.k0);
      for (let j = 0; j <= lastJ; j++) push((t.k0 + j) * f.h, j, false);
      const gridEnd = (t.k0 + lastJ) * f.h;
      if (at - gridEnd > 1e-9) push(at, lastJ, true);
    }
    pull[t.prepared.trackId] = lambdas;
    return { trackId: t.prepared.trackId, trackIndex: t.prepared.trackIndex, samples, head: samples.at(-1) ?? null };
  });
  const couplings: CurrentCoupling[] = f.pairs.flatMap((pairs, i) => pairs.filter((p) => p.start <= at).map((p) => ({
    noteIds: [p.a.id, p.b.id] as [string, string],
    trackIds: [f.tracks[0].prepared.trackId, f.tracks[i].prepared.trackId] as [string, string],
    start: p.start, end: p.end,
    intervalSemitones: p.a.midi - p.b.midi,
    intervalClass: Math.abs(p.a.midi - p.b.midi) % 12,
    consonance: p.consonance,
    maxPull: config.couplingMax * p.consonance,
  })));
  return { beat: at, span: f.span, tracks, couplings, pull };
}

/** Inspector data for one note in the Current grammar. */
export function describeCurrentNote(composition: MusicalComposition, noteId: string, config: CurrentConfig = DEFAULT_CURRENT_CONFIG): CurrentNoteDescription {
  validateCurrentConfig(config);
  const { tracks } = prepare(composition);
  const track = tracks.find((t) => t.notes.some((n) => n.id === noteId));
  if (!track) throw new Error(`Unknown note ${noteId}.`);
  const note = track.notes.find((n) => n.id === noteId)!;
  const phrase = Math.floor(note.startBeat / composition.beatsPerBar + 1e-9);
  const start = phraseStarts(track.notes, composition.beatsPerBar).find((n) => Math.floor(n.startBeat / composition.beatsPerBar + 1e-9) === phrase)!;
  const semis = note.midi - start.midi;
  const H = config.maxHeadingDeg;
  return {
    noteId, trackId: track.trackId, phraseStartNoteId: start.id, semitonesFromPhraseStart: semis,
    targetHeadingDeg: H * Math.tanh((config.degreesPerSemitone * semis) / H),
    couplings: computeCurrentFrame(composition, totalBeats(composition), config).couplings.filter((c) => c.noteIds.includes(noteId)),
  };
}
