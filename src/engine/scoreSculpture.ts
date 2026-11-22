/**
 * Static 3D score sculpture (first study: Leap Dialogue).
 *
 * Pure and deterministic. The sculpture is the COMPLETED Current motion path of
 * each voice, the same coordinates the 2D Current/Luminous/Filament artwork uses,
 * lifted into depth. It does not depend on playback, the clock or randomness.
 *
 *   X, Y     = the 2D path (SVG x − 300, 300 − SVG y)                 (derived)
 *   radius   = 0.6 × note thickness while a note sounds;
 *              0.3 × thickness in silence (thinner, so rest ≠ note)  (derived; factors designed)
 *   Z relief = RELIEF × (thickness − base): louder / held notes rise  (derived; factor designed)
 *   depth    'relief'    every voice on one plane (shallow relief)
 *            'separated' melody at +45, each further voice 90 deeper (designed spacing)
 *   bridges  struts from a pulled voice to the melody at the same beat, only where
 *            the real coupling λ > 0; strength = λ / λmax           (derived)
 *   anchors  for each requested beat, every note that starts there, placed on its
 *            voice's path at that onset                              (derived)
 */
import { noteName, totalBeats, type MusicalComposition } from './composition.ts';
import { computeCurrentFrame, DEFAULT_CURRENT_CONFIG, type CurrentConfig } from './compositionCurrent.ts';

export type SculptureDepth = 'relief' | 'separated';
export type Vec3 = [number, number, number];
export interface SculptureVoice { trackId: string; trackIndex: number; points: Vec3[]; radii: number[]; beats: number[]; noteIds: Array<string | null>; kinds: Array<'note' | 'rest'> }
export interface SculptureBridge { beat: number; from: Vec3; to: Vec3; strength: number }
export interface SculptureAnchorNote { noteId: string; trackId: string; midi: number; name: string; position: Vec3 }
export interface SculptureAnchor { beat: number; notes: SculptureAnchorNote[] }
export interface SculptureModel { depth: SculptureDepth; voices: SculptureVoice[]; bridges: SculptureBridge[]; anchors: SculptureAnchor[]; bounds: { min: Vec3; max: Vec3 } }
export interface SculptureOptions { anchorBeats?: number[]; config?: CurrentConfig }

/** Leap Dialogue's three documented region anchors (zero-based beats; see harmoglyph-motion tasks). */
export const LEAP_DIALOGUE_ANCHOR_BEATS = [0, 2, 6];

const BASE_THICKNESS = 2.2; // motion engine thickness with no note contribution
const NOTE_RADIUS = 0.6;
const REST_RADIUS = 0.3;
const RELIEF = 2.2;
const VOICE_DEPTH = 90;
const BRIDGE_EVERY = 4;

export const SCULPTURE_MAPPINGS = {
  derived: ['X/Y = the Current motion path of each voice', 'Tube radius and surface lift = note thickness (velocity, duration)', 'Thin tube = silence', 'Struts = real coupling λ, strength λ/λmax', 'Anchors = notes starting at the chosen beats'],
  designed: ['Radius and lift factors', 'Voice depth spacing (separated: 90 units)', 'Strut spacing, materials, lighting, camera'],
} as const;

export function buildScoreSculpture(composition: MusicalComposition, depth: SculptureDepth, options: SculptureOptions = {}): SculptureModel {
  const config = options.config ?? DEFAULT_CURRENT_CONFIG;
  const span = totalBeats(composition);
  const frame = computeCurrentFrame(composition, span, config);
  const planeZ = (trackIndex: number) => (depth === 'relief' ? 0 : trackIndex === 0 ? VOICE_DEPTH / 2 : -VOICE_DEPTH / 2 - (trackIndex - 1) * VOICE_DEPTH);

  const voices: SculptureVoice[] = frame.tracks.map((t) => {
    const v: SculptureVoice = { trackId: t.trackId, trackIndex: t.trackIndex, points: [], radii: [], beats: [], noteIds: [], kinds: [] };
    for (const s of t.samples) {
      const lift = RELIEF * Math.max(0, s.width - BASE_THICKNESS);
      v.points.push([s.x - 300, 300 - s.y, planeZ(t.trackIndex) + lift]);
      v.radii.push((s.kind === 'note' ? NOTE_RADIUS : REST_RADIUS) * s.width);
      v.beats.push(s.beat);
      v.noteIds.push(s.noteId);
      v.kinds.push(s.kind);
    }
    return v;
  });

  const bridges: SculptureBridge[] = [];
  const lead = voices[0];
  if (lead && config.couplingMax > 0) {
    const leadAt = new Map(lead.beats.map((b, i) => [b, lead.points[i]]));
    frame.tracks.slice(1).forEach((t, k) => {
      const v = voices[k + 1];
      const pull = frame.pull[t.trackId] ?? [];
      pull.forEach((lambda, i) => {
        const to = leadAt.get(v.beats[i]);
        if (lambda > 1e-3 && i % BRIDGE_EVERY === 0 && to) bridges.push({ beat: v.beats[i], from: v.points[i], to, strength: Math.min(1, lambda / config.couplingMax) });
      });
    });
  }

  const anchors: SculptureAnchor[] = (options.anchorBeats ?? []).map((beat) => ({
    beat,
    notes: voices.flatMap((v) => {
      const i = v.beats.findIndex((b) => Math.abs(b - beat) < 1e-9);
      return composition.notes
        .filter((n) => n.trackId === v.trackId && Math.abs(n.startBeat - beat) < 1e-9)
        .map((n) => ({ noteId: n.id, trackId: n.trackId, midi: n.midi, name: noteName(n.midi), position: i >= 0 ? v.points[i] : ([NaN, NaN, NaN] as Vec3) }));
    }),
  }));

  const all = voices.flatMap((v) => v.points);
  const min: Vec3 = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))) as Vec3;
  const max: Vec3 = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k]))) as Vec3;
  return { depth, voices, bridges, anchors, bounds: { min, max } };
}
