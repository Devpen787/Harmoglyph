/**
 * W2-C "Luminous" — a visual MATERIAL for the Current grammar.
 *
 * Pure, read-only: it takes Current motion frames and returns SVG geometry to
 * draw. It never changes motion coordinates, the score or audio. Every element
 * is derived from samples the motion engine already produced:
 *
 *   view        uniform scale + translation fitting the COMPLETED drawing into the
 *               canvas (fixed during playback, so nothing jumps). Designed.
 *   phraseBands one faint column per bar, from where the melody is at each bar line.
 *   sheets      a translucent "silk" sheet hanging off each voice; its depth is the
 *               note thickness (velocity × duration plateau), so louder/held notes
 *               cast deeper sheets. Spacing factor is designed.
 *   echoes      one thin parallel line on the other side, same rule, fainter.
 *   cores       bright centreline of each voice.
 *   restThreads dotted centreline over rest samples only (silence ≠ note).
 *   membranes   filled band between a pulled voice and the melody over each run
 *               where the real coupling λ > 0; opacity ∝ mean λ.
 *   onsets      one node per started note at its onset, radius ∝ velocity.
 */
import type { MusicalComposition } from './composition.ts';
import type { CurrentFrame } from './compositionCurrent.ts';
import type { RibbonSample } from './compositionMotion.ts';

export interface MaterialView { scale: number; tx: number; ty: number; transform: string }
export interface LuminousLayer {
  view: MaterialView;
  phraseBands: Array<{ index: number; x0: number; x1: number }>;
  sheets: Array<{ key: string; trackId: string; d: string }>;
  echoes: Array<{ key: string; trackId: string; d: string }>;
  cores: Array<{ key: string; trackId: string; d: string }>;
  restThreads: Array<{ key: string; trackId: string; d: string }>;
  membranes: Array<{ key: string; d: string; meanPull: number }>;
  onsets: Array<{ noteId: string; trackId: string; x: number; y: number; r: number }>;
}

export const LUMINOUS_MAPPINGS = {
  derived: [
    'Sheet and echo depth = note thickness (velocity, written duration)',
    'Onset node size = velocity; one node per note',
    'Membrane = real voice coupling λ; opacity follows λ',
    'Phrase columns = bar lines at the melody’s position',
    'Dotted thread = silence (no note)',
  ],
  designed: ['Canvas fit (uniform scale ≤ 2)', 'Sheet/echo spacing factors, glow, palette and opacities'],
} as const;

const MARGIN = 60;
const MAX_SCALE = 2;
const SHEET_FACTOR = 2.4;
const ECHO_FACTOR = 1.6;

const f2 = (n: number) => n.toFixed(2);
const line = (pts: Array<[number, number]>) => 'M ' + pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join(' L ');

function normals(s: RibbonSample[]): Array<[number, number]> {
  return s.map((_, i) => {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });
}

function fitView(complete: CurrentFrame): MaterialView {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of complete.tracks) for (const s of t.samples) {
    const pad = s.width * SHEET_FACTOR + 4;
    minX = Math.min(minX, s.x - pad); maxX = Math.max(maxX, s.x + pad);
    minY = Math.min(minY, s.y - pad); maxY = Math.max(maxY, s.y + pad);
  }
  if (!Number.isFinite(minX)) return { scale: 1, tx: 0, ty: 0, transform: '' };
  const avail = 600 - 2 * MARGIN;
  const scale = Math.max(1, Math.min(MAX_SCALE, avail / (maxX - minX), avail / (maxY - minY)));
  const tx = 300 - scale * (minX + maxX) / 2;
  const ty = 300 - scale * (minY + maxY) / 2;
  return { scale, tx, ty, transform: `translate(${f2(tx)} ${f2(ty)}) scale(${scale.toFixed(4)})` };
}

/** Contiguous index runs where pred holds. */
function runs<T>(xs: T[], pred: (x: T, i: number) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  xs.forEach((x, i) => {
    if (pred(x, i)) { if (start < 0) start = i; }
    else if (start >= 0) { out.push([start, i - 1]); start = -1; }
  });
  if (start >= 0) out.push([start, xs.length - 1]);
  return out;
}

export function buildLuminousLayer(composition: MusicalComposition, frame: CurrentFrame, complete: CurrentFrame): LuminousLayer {
  const view = fitView(complete);
  const layer: LuminousLayer = { view, phraseBands: [], sheets: [], echoes: [], cores: [], restThreads: [], membranes: [], onsets: [] };
  const velocity = new Map(composition.notes.map((n) => [n.id, n.velocity]));

  // Phrase columns, from the COMPLETED melody so they don't shift while playing.
  const lead = complete.tracks[0]?.samples ?? [];
  if (lead.length) {
    const xAt = (b: number) => lead.reduce((best, s) => (Math.abs(s.beat - b) < Math.abs(best.beat - b) ? s : best)).x;
    const bars = Math.ceil(complete.span / composition.beatsPerBar);
    for (let i = 0; i < bars; i++) layer.phraseBands.push({ index: i, x0: xAt(i * composition.beatsPerBar), x1: xAt(Math.min(complete.span, (i + 1) * composition.beatsPerBar)) });
  }

  for (const t of frame.tracks) {
    const s = t.samples;
    if (s.length < 2) continue;
    const n = normals(s);
    const centre = s.map((p) => [p.x, p.y] as [number, number]);
    const off = (k: number) => s.map((p, i) => [p.x + n[i][0] * p.width * k, p.y + n[i][1] * p.width * k] as [number, number]);
    const sheetEdge = off(SHEET_FACTOR);
    layer.sheets.push({ key: `sheet-${t.trackId}`, trackId: t.trackId, d: line([...centre, ...sheetEdge.reverse()]) + ' Z' });
    layer.echoes.push({ key: `echo-${t.trackId}`, trackId: t.trackId, d: line(off(-ECHO_FACTOR)) });
    layer.cores.push({ key: `core-${t.trackId}`, trackId: t.trackId, d: line(centre) });
    runs(s, (p) => p.kind === 'rest').forEach(([a, b], k) => {
      if (b <= a) return; // a single sample at the exact note end is not a silence worth drawing
      const from = Math.max(0, a - 1); // join the thread to the note it follows
      layer.restThreads.push({ key: `rest-${t.trackId}-${k}`, trackId: t.trackId, d: line(centre.slice(from, b + 1)) });
    });
    let prev: string | null = null;
    for (const p of s) {
      for (const id of p.activeNoteIds) {
        if (id === prev || layer.onsets.some((o) => o.noteId === id)) continue;
        layer.onsets.push({ noteId: id, trackId: t.trackId, x: p.x, y: p.y, r: 1.6 + 3.2 * (velocity.get(id) ?? 0.5) });
      }
      prev = p.noteId;
    }
  }

  // Membranes: real coupling only (pull > 0), between the pulled voice and the melody at the same beats.
  const leadNow = frame.tracks[0];
  if (leadNow) {
    const byBeat = new Map(leadNow.samples.map((p) => [p.beat, p]));
    for (const t of frame.tracks.slice(1)) {
      const pull = frame.pull[t.trackId] ?? [];
      runs(t.samples, (p, i) => pull[i] > 1e-3 && byBeat.has(p.beat)).forEach(([a, b], k) => {
        if (b <= a) return;
        const mine = t.samples.slice(a, b + 1);
        const theirs = mine.map((p) => byBeat.get(p.beat)!);
        const meanPull = pull.slice(a, b + 1).reduce((x, y) => x + y, 0) / (b - a + 1);
        layer.membranes.push({ key: `mem-${t.trackId}-${k}`, meanPull, d: line([...mine.map((p) => [p.x, p.y] as [number, number]), ...theirs.reverse().map((p) => [p.x, p.y] as [number, number])]) + ' Z' });
      });
    }
  }
  return layer;
}
