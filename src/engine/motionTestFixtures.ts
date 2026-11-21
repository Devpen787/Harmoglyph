import assert from 'node:assert/strict';
import type { MusicalComposition } from './composition.ts';
import type { RibbonFrame } from './compositionMotion.ts';

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

/** A sample may name a note only while that note is sounding; silence names none. */
export function assertStrictAttribution(score: MusicalComposition, frame: Pick<RibbonFrame, 'tracks'>, label: string) {
  for (const t of frame.tracks) {
    const trackNotes = score.notes.filter((n) => n.trackId === t.trackId);
    for (const s of t.samples) {
      const sounding = trackNotes.find((n) => s.beat >= n.startBeat - 1e-9 && s.beat < n.startBeat + n.durationBeats - 1e-9);
      if (s.kind === 'note') {
        assert.ok(sounding && s.noteId === sounding.id, `${label}: beat ${s.beat} attributed to ${s.noteId} but sounding is ${sounding?.id}`);
        assert.equal(s.restAfterNoteId, null);
      } else {
        assert.equal(s.kind, 'rest', `${label}: unknown kind`);
        assert.equal(s.noteId, null, `${label}: rest at beat ${s.beat} must not claim a note`);
        assert.ok(!sounding, `${label}: beat ${s.beat} marked rest while ${sounding?.id} sounds`);
        assert.ok(s.restAfterNoteId, `${label}: rest records which note preceded it`);
      }
    }
  }
}
