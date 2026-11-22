import assert from 'node:assert/strict';
import type { MusicalComposition } from './composition.ts';

/** Melody with explicit rests at beats 2–3 and 6–8 (total 8 beats). */
export const RESTED: MusicalComposition = {
  id: 'rested', title: 'Rested', bpm: 100, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
  tracks: [{ id: 'lead', label: 'Melody', voice: 'music-box' }],
  notes: [
    { id: 'n1', trackId: 'lead', midi: 60, startBeat: 0, durationBeats: 1, velocity: 0.7 },
    { id: 'n2', trackId: 'lead', midi: 64, startBeat: 1, durationBeats: 1, velocity: 0.7 },
    { id: 'n3', trackId: 'lead', midi: 67, startBeat: 3, durationBeats: 1, velocity: 0.7 },
    { id: 'n4', trackId: 'lead', midi: 72, startBeat: 4, durationBeats: 2, velocity: 0.7 },
  ],
};

/** Same-track overlap: A (C4) holds beats 0–4 while B (G4) sounds beats 1–2. */
export const OVERLAP: MusicalComposition = {
  id: 'overlap', title: 'Overlap', bpm: 100, beatsPerBar: 4, tuning: '12tet', referenceMidi: 60,
  tracks: [{ id: 'lead', label: 'Melody', voice: 'music-box' }],
  notes: [
    { id: 'A', trackId: 'lead', midi: 60, startBeat: 0, durationBeats: 4, velocity: 0.7 },
    { id: 'B', trackId: 'lead', midi: 67, startBeat: 1, durationBeats: 1, velocity: 0.7 },
  ],
};

type AttributedSample = { beat: number; kind: string; noteId: string | null; restAfterNoteId: string | null; activeNoteIds: string[] };

/**
 * Truthful attribution: every sample lists ALL notes sounding on its voice
 * (onset order); noteId is the newest of them; silence names none.
 */
export function assertStrictAttribution(score: MusicalComposition, frame: { tracks: Array<{ trackId: string; samples: AttributedSample[] }> }, label: string) {
  for (const t of frame.tracks) {
    const trackNotes = score.notes.filter((n) => n.trackId === t.trackId).sort((a, b) => a.startBeat - b.startBeat || a.id.localeCompare(b.id));
    for (const s of t.samples) {
      const sounding = trackNotes.filter((n) => s.beat >= n.startBeat - 1e-9 && s.beat < n.startBeat + n.durationBeats - 1e-9).map((n) => n.id);
      assert.deepEqual(s.activeNoteIds, sounding, `${label}: beat ${s.beat} active notes`);
      if (s.kind === 'note') {
        assert.equal(s.noteId, sounding.at(-1), `${label}: beat ${s.beat} owner must be the newest sounding note`);
        assert.equal(s.restAfterNoteId, null, `${label}: note sample has no rest link`);
      } else {
        assert.equal(s.kind, 'rest', `${label}: unknown kind`);
        assert.equal(s.noteId, null, `${label}: rest at beat ${s.beat} must not claim a note`);
        assert.equal(sounding.length, 0, `${label}: beat ${s.beat} marked rest while ${sounding.join(',')} sounds`);
        assert.ok(s.restAfterNoteId, `${label}: rest records which note preceded it`);
      }
    }
  }
}
