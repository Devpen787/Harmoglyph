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
}
export interface FilamentLayer {
  view: MaterialView;
  strands: FilamentStrand[];
  cores: Array<{ key: string; trackId: string; d: string }>;
  voiceHue: Record<string, string>;
}

export const FILAMENT_STRANDS = 36;
const STRIDE = 3;          // use every 3rd motion sample (≈ 0.094 beat); curves are smoothed
const SPREAD = 1.9;
const UNDULATE = 0.35;
const REST_LANES = 0.25;   // |lane position| ≤ this survives in silence
const BEND_SHARE = 0.45;   // fraction of a pulled voice's strands that can reach across
const BEND_LIMIT = 0.85;
const COUPLING_MAX = 0.3;  // λ normaliser (matches DEFAULT_CURRENT_CONFIG.couplingMax)

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

interface Lane { k: number; u: number; phase: number; freq: number; weight: number; opacity: number; reach: number }

function lanes(trackId: string): Lane[] {
  return Array.from({ length: FILAMENT_STRANDS }, (_, k) => {
    const h = (salt: string) => hash01(`${trackId}:${k}:${salt}`);
    const u = -1 + (2 * (k + 0.5)) / FILAMENT_STRANDS + (h('jitter') - 0.5) * (1.2 / FILAMENT_STRANDS);
    const reachSeed = h('reach');
    return {
      k, u,
      phase: h('phase') * Math.PI * 2,
      freq: 0.35 + h('freq') * 0.9,
      weight: 0.35 + h('weight') * 0.55,
      opacity: 0.07 + 0.5 * Math.pow(1 - Math.min(1, Math.abs(u)), 1.6),
      reach: reachSeed > 1 - BEND_SHARE ? (reachSeed - (1 - BEND_SHARE)) / BEND_SHARE : 0,
    };
  });
}

export function buildFilamentLayer(composition: MusicalComposition, frame: MotionFrameLike, complete: MotionFrameLike): FilamentLayer {
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
    out.cores.push({ key: `core-${t.trackId}`, trackId: t.trackId, d: smoothPath(idx.map((i) => [r2(s[i].x), r2(s[i].y)])) });

    for (const lane of lanes(t.trackId)) {
      // Point of this strand at motion sample i.
      const at = (i: number): { pt: [number, number]; bend: number } => {
        const p = s[i];
        const [nx, ny] = normalAt(s, i);
        const sway = UNDULATE * p.width * Math.sin(lane.phase + 2 * Math.PI * lane.freq * p.beat);
        const off = lane.u * SPREAD * p.width + sway;
        let x = p.x + nx * off, y = p.y + ny * off;
        let bend = 0;
        const lambda = pull?.[i] ?? 0;
        const other = lambda > 0 && lane.reach > 0 ? leadByBeat.get(p.beat) : undefined;
        if (other) {
          bend = Math.min(1, (lambda / COUPLING_MAX) * lane.reach);
          const lo = lane.u * SPREAD * other.p.width;
          const tx = other.p.x + other.n[0] * lo, ty = other.p.y + other.n[1] * lo;
          x += bend * BEND_LIMIT * (tx - x); y += bend * BEND_LIMIT * (ty - y);
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
        if (piece.length >= 2 && (kind === 'note' || (realSilence && Math.abs(lane.u) <= REST_LANES))) {
          const pts = piece.map(at);
          out.strands.push({
            key: `${t.trackId}-${lane.k}-${kind}-${s[idx[start]].beat}`,
            trackId: t.trackId, kind, lane: lane.k,
            points: pts.map((q) => q.pt), d: smoothPath(pts.map((q) => q.pt)),
            opacity: kind === 'rest' ? lane.opacity * 0.45 : lane.opacity,
            width: lane.weight,
            maxBend: Math.max(0, ...pts.map((q) => q.bend)),
          });
        }
        start = j;
      }
    }
  });
  return out;
}
