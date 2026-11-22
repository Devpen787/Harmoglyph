/**
 * W2-D "Filament" — a visual MATERIAL: each voice drawn as a bundle of fine
 * luminous strands instead of one line.
 *
 * Pure and read-only. It accepts any motion frame made of RibbonTrackFrame
 * tracks (Current or Ribbon) and returns SVG geometry. It never changes motion
 * coordinates, the score or audio. No Math.random: every strand's lane, jitter,
 * weight and undulation come from a hash of (trackId, strand index), so strands
 * are stable across frames, edits and replays.
 *
 *   spread      half-width of the bundle = note thickness × SPREAD. Thickness is the
 *               motion engine's velocity swell + duration plateau, so loud or held
 *               notes open the bundle and quiet notes close it.       (derived)
 *   undulation  each strand sways ± UNDULATE × thickness, sin(φₖ + 2π·fₖ·beat).
 *               Continuous in beat; amplitude follows the music.     (designed form)
 *   silence     rest samples keep only the inner strands, dimmer and dotted. (derived)
 *   coupling    where the motion frame reports a real pull λ (Current only), part of
 *               the pulled voice's strands bend toward the melody by λ/λmax. (derived)
 *   view        same canvas fit as Luminous (from the completed drawing). (designed)
 *
 * W2-E 'volume' variant (options.variant = 'volume'; the default stays W2-D):
 *   note strands   54 lanes; half-width = SPREAD·thickness + VOLUME_GAIN·(thickness − base),
 *                  i.e. the note's own velocity × duration contribution opens the bundle. (derived)
 *   rest strands   exactly the W2-D rest strands (same lanes, spread, dim dotted). (derived)
 *   coupling       for each real coupling window (contiguous λ > 0 in the COMPLETED frame, bounded by
 *                  the λ = 0 samples on either side), a reaching strand bends by
 *                    AMP · reach · (peak λ / λmax) · sin²(π·(t − start)/(end − start))^(1 + threshold)
 *                  so the bend rises across the whole window instead of the 0.25-beat λ ramp, is exactly
 *                  0 at the window edges and outside, and keeps the window's consonance-set strength.
 *                  Windows come from the completed frame, so earlier trail never changes. (derived λ, designed easing)
 *   view           identical to W2-D, for like-for-like comparison.
 */
import type { MusicalComposition } from './composition.ts';
import type { RibbonSample, RibbonTrackFrame } from './compositionMotion.ts';
import { fitView, type MaterialView } from './currentMaterial.ts';

export interface MotionFrameLike { tracks: RibbonTrackFrame[]; pull?: Record<string, number[]> }
export interface FilamentStrand {
  key: string;
  trackId: string;
  kind: 'note' | 'rest';
  /** Strand index within its voice's bundle (0 … FILAMENT_STRANDS − 1). */
  lane: number;
  points: Array<[number, number]>;
  d: string;
  opacity: number;
  width: number;
  /** Largest bend toward the melody along this piece (0 = none, 1 = full). */
  maxBend: number;
  /** Score beat of each point (same order as points). */
  beats: number[];
  /** Bend toward the melody at each point (0 … 1). */
  bends: number[];
}

/** 'w2d' = the W2-D baseline (default, unchanged). 'volume' = W2-E variant. */
export type FilamentVariant = 'w2d' | 'volume';
export interface FilamentOptions { variant?: FilamentVariant }
export interface FilamentLayer {
  view: MaterialView;
  strands: FilamentStrand[];
  cores: Array<{ key: string; trackId: string; d: string }>;
  voiceHue: Record<string, string>;
}

export const FILAMENT_STRANDS = 36;
/** Strands per voice for sounding notes in the 'volume' variant (rests keep the W2-D lanes). */
export const FILAMENT_VOLUME_STRANDS = 54;
const STRIDE = 3;          // use every 3rd motion sample (≈ 0.094 beat); curves are smoothed
const SPREAD = 1.9;
const UNDULATE = 0.35;
const REST_LANES = 0.25;   // |lane position| ≤ this survives in silence
const BEND_SHARE = 0.45;   // fraction of a pulled voice's strands that can reach across
const BEND_LIMIT = 0.85;
const COUPLING_MAX = 0.3;  // λ normaliser (matches DEFAULT_CURRENT_CONFIG.couplingMax)
// W2-E 'volume' variant
const BASE_THICKNESS = 2.2;   // motion engine's thickness with no note contribution (BASE_WIDTH in compositionMotion.ts)
const VOLUME_GAIN = 4.2;      // extra half-width per unit of note contribution (velocity × swell/plateau)
const VOLUME_BEND_LIMIT = 0.7;
const VOLUME_BEND_AMP = 0.8;

/** Warm hue per voice on black (DAO-inspired palette). */
export const FILAMENT_PALETTE = { ground: '#000000', bone: '#EEEBE4', voices: ['#F2C47E', '#E2774C', '#E9A5A0'] } as const;

export const FILAMENT_MAPPINGS = {
  derived: [
    'Bundle width = note thickness (velocity swell + written duration)',
    'Silence: only inner strands, dimmer and dotted',
    'Strands reaching across voices = real coupling λ (Current only)',
    'Strand path = the motion engine’s coordinates',
  ],
  designed: ['Strand count, sway amplitude/frequency, weights and opacities (hashed per strand)', 'Black/bone/warm palette', 'Canvas fit'],
} as const;

/** 32-bit FNV-1a → [0, 1). Deterministic stand-in for randomness. */
function hash01(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom through the points, as cubic Bézier segments. */
function smoothPath(p: Array<[number, number]>): string {
  if (p.length === 1) return `M ${p[0][0]} ${p[0][1]} C ${p[0][0]} ${p[0][1]} ${p[0][0]} ${p[0][1]} ${p[0][0]} ${p[0][1]}`;
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], e = p[Math.min(p.length - 1, i + 2)];
    const c1 = [r2(b[0] + (c[0] - a[0]) / 6), r2(b[1] + (c[1] - a[1]) / 6)];
    const c2 = [r2(c[0] - (e[0] - b[0]) / 6), r2(c[1] - (e[1] - b[1]) / 6)];
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${c[0]} ${c[1]}`;
  }
  return d;
}

function decimate(s: RibbonSample[]): number[] {
  const idx: number[] = [];
  for (let i = 0; i < s.length; i += STRIDE) idx.push(i);
  if (idx.at(-1) !== s.length - 1) idx.push(s.length - 1); // live head
  return idx;
}

function normalAt(s: RibbonSample[], i: number): [number, number] {
  const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
}

interface Lane { k: number; u: number; phase: number; freq: number; weight: number; opacity: number; reach: number; threshold: number }

function lanes(trackId: string, count = FILAMENT_STRANDS): Lane[] {
  return Array.from({ length: count }, (_, k) => {
    const h = (salt: string) => hash01(`${trackId}:${k}:${salt}`);
    const u = -1 + (2 * (k + 0.5)) / count + (h('jitter') - 0.5) * (1.2 / count);
    const reachSeed = h('reach');
    return {
      k, u,
      phase: h('phase') * Math.PI * 2,
      freq: 0.35 + h('freq') * 0.9,
      weight: 0.35 + h('weight') * 0.55,
      opacity: 0.07 + 0.5 * Math.pow(1 - Math.min(1, Math.abs(u)), 1.6),
      reach: reachSeed > 1 - BEND_SHARE ? (reachSeed - (1 - BEND_SHARE)) / BEND_SHARE : 0,
      threshold: 0.1 + 0.55 * h('threshold'), // volume variant only: higher → strand enters later / leaves earlier in a window
    };
  });
}

interface CouplingWindow { start: number; end: number; peak: number }

/** Contiguous λ > 0 runs of one voice in the completed frame, bounded by the λ = 0 samples around them. */
function couplingWindows(complete: MotionFrameLike, trackId: string): CouplingWindow[] {
  const t = complete.tracks.find((x) => x.trackId === trackId);
  const pull = complete.pull?.[trackId];
  if (!t || !pull) return [];
  const out: CouplingWindow[] = [];
  let i = 0;
  while (i < pull.length) {
    if (pull[i] > 0) {
      let j = i;
      let peak = 0;
      while (j < pull.length && pull[j] > 0) { peak = Math.max(peak, pull[j]); j++; }
      out.push({ start: t.samples[Math.max(0, i - 1)].beat, end: t.samples[Math.min(t.samples.length - 1, j)].beat, peak });
      i = j;
    } else i++;
  }
  return out;
}

/** How one pass of strands is shaped. 'w2d' reproduces the W2-D baseline exactly. */
type Mode = 'w2d' | 'volume';

export function buildFilamentLayer(composition: MusicalComposition, frame: MotionFrameLike, complete: MotionFrameLike, options: FilamentOptions = {}): FilamentLayer {
  const variant = options.variant ?? 'w2d';
  // Same framing for both variants (the variant must fit inside the W2-D view; tested).
  const view = fitView(complete, SPREAD + UNDULATE + 1);
  const voiceHue: Record<string, string> = {};
  composition.tracks.forEach((t, i) => { voiceHue[t.id] = FILAMENT_PALETTE.voices[i % FILAMENT_PALETTE.voices.length]; });
  const out: FilamentLayer = { view, strands: [], cores: [], voiceHue };

  const lead = frame.tracks[0];
  const leadByBeat = new Map((lead?.samples ?? []).map((p, i) => [p.beat, { p, n: normalAt(lead.samples, i) }]));

  frame.tracks.forEach((t, ti) => {
    const s = t.samples;
    if (s.length < 2) return;
    const idx = decimate(s);
    const pull = ti > 0 ? frame.pull?.[t.trackId] : undefined;
    const windows = ti > 0 && variant === 'volume' ? couplingWindows(complete, t.trackId) : [];
    out.cores.push({ key: `core-${t.trackId}`, trackId: t.trackId, d: smoothPath(idx.map((i) => [r2(s[i].x), r2(s[i].y)])) });

    const pass = (laneSet: Lane[], mode: Mode, kinds: ReadonlySet<'note' | 'rest'>) => {
      for (const lane of laneSet) {
        // Point of this strand at motion sample i.
        const at = (i: number): { pt: [number, number]; bend: number } => {
          const p = s[i];
          const [nx, ny] = normalAt(s, i);
          const sway = UNDULATE * p.width * Math.sin(lane.phase + 2 * Math.PI * lane.freq * p.beat);
          // volume: the note's own contribution to thickness (velocity × swell/plateau) opens the bundle further.
          const half = mode === 'volume' ? SPREAD * p.width + VOLUME_GAIN * Math.max(0, p.width - BASE_THICKNESS) : SPREAD * p.width;
          const off = lane.u * half + sway;
          let x = p.x + nx * off, y = p.y + ny * off;
          let bend = 0;
          const lambda = pull?.[i] ?? 0;
          const other = lambda > 0 && lane.reach > 0 ? leadByBeat.get(p.beat) : undefined;
          if (other) {
            if (mode === 'volume') {
              // Ease across the whole coupling window (zero at its edges), strength from the window's peak λ.
              const w = windows.find((x) => p.beat > x.start && p.beat < x.end);
              const bump = w ? Math.pow(Math.sin((Math.PI * (p.beat - w.start)) / (w.end - w.start)) ** 2, 1 + lane.threshold) : 0;
              bend = w ? VOLUME_BEND_AMP * lane.reach * (w.peak / COUPLING_MAX) * bump : 0;
            } else {
              bend = Math.min(1, (lambda / COUPLING_MAX) * lane.reach);
            }
            const limit = mode === 'volume' ? VOLUME_BEND_LIMIT : BEND_LIMIT;
            const lo = lane.u * SPREAD * other.p.width;
            const tx = other.p.x + other.n[0] * lo, ty = other.p.y + other.n[1] * lo;
            x += bend * limit * (tx - x); y += bend * limit * (ty - y);
          }
          return { pt: [r2(x), r2(y)], bend };
        };
        // Split into note / rest pieces; rests keep only inner lanes.
        let start = 0;
        for (let j = 1; j <= idx.length; j++) {
          if (j < idx.length && s[idx[j]].kind === s[idx[start]].kind) continue;
          const kind = s[idx[start]].kind;
          const end = Math.min(j, idx.length - 1); // share the boundary point so pieces join
          const piece = idx.slice(Math.max(0, start - (kind === 'rest' ? 1 : 0)), end + 1);
          // A single sample at the exact end of a note is not a silence worth drawing.
          const realSilence = kind === 'rest' && j - start >= 2;
          if (kinds.has(kind) && piece.length >= 2 && (kind === 'note' || (realSilence && Math.abs(lane.u) <= REST_LANES))) {
            const pts = piece.map(at);
            out.strands.push({
              key: `${t.trackId}-${lane.k}-${kind}-${s[idx[start]].beat}`,
              trackId: t.trackId, kind, lane: lane.k,
              points: pts.map((q) => q.pt), d: smoothPath(pts.map((q) => q.pt)),
              opacity: kind === 'rest' ? lane.opacity * 0.45 : lane.opacity,
              width: lane.weight,
              maxBend: Math.max(0, ...pts.map((q) => q.bend)),
              beats: piece.map((i) => s[i].beat),
              bends: pts.map((q) => q.bend),
            });
          }
          start = j;
        }
      }
    };

    if (variant === 'w2d') {
      pass(lanes(t.trackId), 'w2d', new Set(['note', 'rest']));
    } else {
      pass(lanes(t.trackId, FILAMENT_VOLUME_STRANDS), 'volume', new Set(['note']));
      pass(lanes(t.trackId), 'w2d', new Set(['rest'])); // silence: exactly the W2-D rest strands
    }
  });
  return out;
}
