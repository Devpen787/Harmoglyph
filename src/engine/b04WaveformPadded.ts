/**
 * B04 corrected measurement — padded WAV export.
 *
 * The original experiment (b04WaveformMeasurement.ts) rendered a one-step sheet.
 * renderSheetToWavBytes() allocates steps.length × stepSec + 0.75 s, so a one-step
 * file can end before the note's sound does. This script renders the same note
 * followed by N silent steps (gate 0 → skipped by the renderer) and sweeps N.
 * Negative control: once the file is long enough, more padding must not move the
 * last above-threshold sample.
 *
 * Synthesis: unmodified production renderSheetToWavBytes (WAV export path only;
 * live Web Audio playback is a different graph and is not measured here).
 *
 * Run: node --import tsx src/engine/b04WaveformPadded.ts > results.json
 */
import { COMPOSITION_PRESETS, noteAsSynthStep, type CompositionNote } from './composition.ts';
import { renderSheetToWavBytes } from './audioSynth.ts';
import type { EvaluatedRowStep, SynthVoiceId } from '../types/chimera.ts';

const SAMPLE_RATE = 22050;
const THRESHOLD = 0.001;
const PADS = [0, 8, 16, 32, 64]; // silent steps after the note
const VOICES: SynthVoiceId[] = ['music-box', 'celestial-chime', 'haunted-organ'];
const SCORES = ['pulse-study', 'ascending-light', 'glass-garden', 'leap-dialogue'];

function pcm(bytes: Uint8Array): Float32Array {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = (bytes.length - 44) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = v.getInt16(44 + i * 2, true) / 32768;
  return out;
}

function lastAbove(x: Float32Array, thr: number): number {
  for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i]) > thr) return i;
  return -1;
}

function rms(x: Float32Array, fromSec: number, toSec: number): number {
  const a = Math.max(0, Math.floor(fromSec * SAMPLE_RATE));
  const b = Math.min(x.length, Math.floor(toSec * SAMPLE_RATE));
  let s = 0;
  for (let i = a; i < b; i++) s += x[i] * x[i];
  return b > a ? Math.sqrt(s / (b - a)) : 0;
}

const silent = (s: EvaluatedRowStep): EvaluatedRowStep => ({ ...s, gate: 0 });

const rows: unknown[] = [];
for (const scoreId of SCORES) {
  const score = COMPOSITION_PRESETS.find((p) => p.id === scoreId)!;
  const seen = new Set<number>();
  const notes: CompositionNote[] = score.notes.filter((n) => !seen.has(n.durationBeats) && seen.add(n.durationBeats));
  for (const note of notes) {
    const step = noteAsSynthStep(note, score.bpm);
    const scoreSec = (note.durationBeats * 60) / score.bpm;
    for (const voice of VOICES) {
      const sweep = PADS.map((pad) => {
        const x = pcm(renderSheetToWavBytes([step, ...Array.from({ length: pad }, () => silent(step))], score.bpm, 1, voice, 'harmonic-sine', 0));
        const last = lastAbove(x, THRESHOLD);
        const fileSec = x.length / SAMPLE_RATE;
        const lastSec = last / SAMPLE_RATE;
        return { pad, fileSec: +fileSec.toFixed(4), lastAboveSec: +lastSec.toFixed(4), hitsFileEnd: fileSec - lastSec < 0.005 };
      });
      const final = sweep[sweep.length - 1];
      const stable = sweep.slice(1).filter((r) => !r.hitsFileEnd).map((r) => r.lastAboveSec);
      const converged = stable.length >= 2 && stable.every((v) => v === stable[stable.length - 1]);
      const x = pcm(renderSheetToWavBytes([step, ...Array.from({ length: 64 }, () => silent(step))], score.bpm, 1, voice, 'harmonic-sine', 0));
      rows.push({
        scoreId, noteId: note.id, voice, bpm: score.bpm, durationBeats: note.durationBeats,
        scoreDurationSec: +scoreSec.toFixed(4),
        paddingSweep: sweep,
        convergedLastAboveSec: converged ? final.lastAboveSec : null,
        converged,
        soundMinusScoreSec: converged ? +(final.lastAboveSec - scoreSec).toFixed(4) : null,
        rmsAtOnset50ms: +rms(x, 0, 0.05).toFixed(5),
        rmsAroundScoreEnd50ms: +rms(x, scoreSec - 0.025, scoreSec + 0.025).toFixed(5),
      });
    }
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  synthesisPath: 'renderSheetToWavBytes — WAV export only, not live Web Audio playback',
  sampleRate: SAMPLE_RATE, threshold: THRESHOLD, paddingStepsSwept: PADS,
  results: rows,
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');

// Compact summary on stderr
const R = rows as Array<any>;
process.stderr.write('score/note                voice            dur(s)  pad0-last  file0   converged-last  sound-score  rms@end/rms@onset\n');
for (const r of R) {
  const p0 = r.paddingSweep[0];
  const ratio = r.rmsAtOnset50ms > 0 ? r.rmsAroundScoreEnd50ms / r.rmsAtOnset50ms : 0;
  const db = ratio > 0 ? (20 * Math.log10(ratio)).toFixed(1) + ' dB' : '-inf';
  process.stderr.write(
    `${(r.scoreId + '/' + r.noteId).padEnd(25)} ${r.voice.padEnd(16)} ${r.scoreDurationSec.toFixed(3)}  ${p0.lastAboveSec.toFixed(3)}${p0.hitsFileEnd ? '*' : ' '}    ${p0.fileSec.toFixed(3)}  ` +
    `${r.converged ? r.convergedLastAboveSec.toFixed(3) : 'NOT CONVERGED'}          ${r.converged ? (r.soundMinusScoreSec >= 0 ? '+' : '') + r.soundMinusScoreSec.toFixed(3) : '   -  '}       ${db}\n`,
  );
}
process.stderr.write('* = last above-threshold sample is at the file end (truncated by buffer)\n');
