/**
 * B04 Waveform Measurement — renders actual PCM samples from the production
 * offline synthesiser and measures envelope decay vs score duration.
 *
 * Uses: renderSheetToWavBytes (src/engine/audioSynth.ts) — the same function
 * that powers the .wav export button. This is NOT the live Web Audio playback
 * path (scheduleStepAt uses a Web Audio oscillator graph). Both paths share
 * noteAsSynthStep → mapMathToSynthParams but diverge at sample generation.
 * That limitation is stated in every result.
 *
 * Run: node --import tsx src/engine/b04WaveformMeasurement.ts
 * No browser, no DOM, no audio hardware required.
 */

import { COMPOSITION_PRESETS, noteAsSynthStep, type CompositionNote } from './composition.ts';
import { renderSheetToWavBytes } from './audioSynth.ts';
import type { SynthVoiceId } from '../types/chimera.ts';

const SAMPLE_RATE = 22050; // matches renderSheetToWavBytes
const SILENCE_THRESHOLD = 0.001; // amplitude below which we call it silence

interface NoteWaveformResult {
  scoreId: string;
  noteId: string;
  trackId: string;
  voice: SynthVoiceId;
  durationBeats: number;
  bpm: number;
  scoreDurationSec: number;
  /** Measured from PCM samples: time of last sample above SILENCE_THRESHOLD */
  measuredDecaySec: number | null;
  /** Gap between score duration and measured decay (positive = truncated) */
  measuredGapSec: number | null;
  /** RMS over windows of 50ms */
  rmsEnvelope: Array<{ windowStartSec: number; rms: number }>;
  /** Peak amplitude in the buffer */
  peakAmplitude: number;
  /** Source of synthesis: clarifies this is the offline export path */
  synthesisPath: 'renderSheetToWavBytes (offline PCM export, not live Web Audio graph)';
}

function parsePcmFromWav(wavBytes: Uint8Array): Float32Array {
  // Skip 44-byte RIFF header, read int16 PCM
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const numSamples = (wavBytes.length - 44) / 2;
  const pcm = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    pcm[i] = view.getInt16(44 + i * 2, true) / 32768;
  }
  return pcm;
}

function measureDecay(pcm: Float32Array, startSample: number, durationSamples: number): {
  measuredDecaySec: number | null;
  rmsEnvelope: NoteWaveformResult['rmsEnvelope'];
  peakAmplitude: number;
} {
  const windowSamples = Math.floor(SAMPLE_RATE * 0.05); // 50ms windows
  const rmsEnvelope: NoteWaveformResult['rmsEnvelope'] = [];
  let lastNonSilentSample = -1;
  let peakAmplitude = 0;

  // Scan from note start to end of buffer (note may ring past its score end)
  const scanEnd = Math.min(pcm.length, startSample + durationSamples + Math.floor(SAMPLE_RATE * 1.5));

  for (let w = startSample; w < scanEnd; w += windowSamples) {
    const wEnd = Math.min(w + windowSamples, scanEnd);
    let sumSq = 0;
    let count = 0;
    for (let s = w; s < wEnd; s++) {
      const v = Math.abs(pcm[s]);
      sumSq += v * v;
      if (v > peakAmplitude) peakAmplitude = v;
      if (v > SILENCE_THRESHOLD) lastNonSilentSample = s;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    rmsEnvelope.push({
      windowStartSec: (w - startSample) / SAMPLE_RATE,
      rms,
    });
  }

  const measuredDecaySec = lastNonSilentSample >= 0
    ? (lastNonSilentSample - startSample) / SAMPLE_RATE
    : null;

  return { measuredDecaySec, rmsEnvelope, peakAmplitude };
}

function measureNote(
  note: CompositionNote,
  bpm: number,
  scoreId: string,
  voice: SynthVoiceId,
): NoteWaveformResult {
  const step = noteAsSynthStep(note, bpm);
  const scoreDurationSec = note.durationBeats * 60 / bpm;

  // Render a single-note "sheet" of one step at this BPM
  // renderSheetToWavBytes takes steps[] and bpm; we pass one step
  const wavBytes = renderSheetToWavBytes([step], bpm, 1, voice, 'harmonic-sine', 0);
  const pcm = parsePcmFromWav(wavBytes);

  // Note starts at sample 0 in a single-step render
  const startSample = 0;
  const durationSamples = Math.floor(scoreDurationSec * SAMPLE_RATE);
  const { measuredDecaySec, rmsEnvelope, peakAmplitude } = measureDecay(pcm, startSample, durationSamples);
  const measuredGapSec = measuredDecaySec !== null ? Math.max(0, scoreDurationSec - measuredDecaySec) : null;

  return {
    scoreId,
    noteId: note.id,
    trackId: note.trackId,
    voice,
    durationBeats: note.durationBeats,
    bpm,
    scoreDurationSec,
    measuredDecaySec,
    measuredGapSec,
    rmsEnvelope,
    peakAmplitude,
    synthesisPath: 'renderSheetToWavBytes (offline PCM export, not live Web Audio graph)',
  };
}

// ── Run measurements ──────────────────────────────────────────────────────────

const VOICES: SynthVoiceId[] = ['music-box', 'celestial-chime', 'haunted-organ'];
const TARGET_SCORES = ['pulse-study', 'ascending-light', 'glass-garden', 'leap-dialogue'];

// For each score, test the most representative notes per the B04 concern:
// - short notes (pulse-study: 0.5 beats)
// - medium notes (ascending-light: 1 beat)
// - longer notes (glass-garden: 2-beat notes, 1-beat notes)
// - overlapping/long voice (leap-dialogue: 2-beat counter notes)

const results: NoteWaveformResult[] = [];

for (const scoreId of TARGET_SCORES) {
  const score = COMPOSITION_PRESETS.find(p => p.id === scoreId)!;

  // Pick representative notes: first note of each unique durationBeats
  const seen = new Set<number>();
  const repNotes: CompositionNote[] = [];
  for (const note of score.notes) {
    if (!seen.has(note.durationBeats)) {
      seen.add(note.durationBeats);
      repNotes.push(note);
    }
  }

  for (const note of repNotes) {
    for (const voice of VOICES) {
      results.push(measureNote(note, score.bpm, scoreId, voice));
    }
  }
}

// ── Print summary table ───────────────────────────────────────────────────────

const sep = '─'.repeat(115);
process.stderr.write('\n' + sep + '\n');
process.stderr.write('B04 Waveform Measurement — PCM samples from renderSheetToWavBytes\n');
process.stderr.write('Path: noteAsSynthStep → renderSheetToWavBytes (offline export path)\n');
process.stderr.write('NOT the live Web Audio path (scheduleStepAt uses a different synthesis graph)\n');
process.stderr.write('Silence threshold: ' + SILENCE_THRESHOLD + ' amplitude  |  Window: 50ms RMS\n');
process.stderr.write(sep + '\n');
process.stderr.write(
  `${'Score'.padEnd(18)} ${'Note'.padEnd(10)} ${'Voice'.padEnd(17)} ${'Beats'.padStart(5)} ` +
  `${'scoreSec'.padStart(9)} ${'decaySec'.padStart(9)} ${'gapSec'.padStart(7)} ${'peak'.padStart(6)} ${'status'.padEnd(16)}\n`,
);
process.stderr.write(sep + '\n');

for (const r of results) {
  const gap = r.measuredGapSec;
  const decay = r.measuredDecaySec;
  const status = gap === null ? 'NO_SIGNAL' :
                 gap > 0.1 ? 'TRUNCATED' :
                 gap > 0.03 ? 'short-tail' : 'ok';
  process.stderr.write(
    `${r.scoreId.padEnd(18)} ${r.noteId.padEnd(10)} ${r.voice.padEnd(17)} ${String(r.durationBeats).padStart(5)} ` +
    `${r.scoreDurationSec.toFixed(3).padStart(9)} ${(decay ?? 0).toFixed(3).padStart(9)} ` +
    `${(gap ?? 0).toFixed(3).padStart(7)} ${r.peakAmplitude.toFixed(3).padStart(6)} ${status.padEnd(16)}\n`,
  );
}

process.stderr.write(sep + '\n');

// RMS envelope for the most critical cases (long notes, each voice)
process.stderr.write('\nRMS envelope detail for 2-beat notes (most critical B04 cases):\n');
for (const r of results.filter(r => r.durationBeats >= 2)) {
  process.stderr.write(`\n${r.scoreId}/${r.noteId} [${r.voice}] score=${r.scoreDurationSec.toFixed(3)}s:\n`);
  // Print windows every 100ms
  const step = 2; // every other 50ms window = 100ms resolution
  const windows = r.rmsEnvelope.filter((_, i) => i % step === 0);
  let line = '  t: ';
  for (const w of windows.slice(0, 20)) line += w.windowStartSec.toFixed(2).padStart(6);
  process.stderr.write(line + '\n');
  line = 'rms: ';
  for (const w of windows.slice(0, 20)) line += w.rms.toFixed(3).padStart(6);
  process.stderr.write(line + '\n');
  process.stderr.write(`  score duration mark at: ${r.scoreDurationSec.toFixed(3)}s | measured decay end: ${(r.measuredDecaySec ?? 0).toFixed(3)}s\n`);
}

process.stderr.write('\nMEASUREMENT LIMITS:\n');
process.stderr.write('  - renderSheetToWavBytes: PCM math (sin/exp); Web Audio live path uses different oscillator nodes\n');
process.stderr.write('  - Silence threshold 0.001 may differ from perceptual silence; earphones matter\n');
process.stderr.write('  - Delay echo (0.23s, 0.25 feedback) adds energy after nominal note end\n');
process.stderr.write('  - These are measured samples from production code — not approximations\n');
process.stderr.write(sep + '\n');

// Output JSON for archiving
process.stdout.write(JSON.stringify({
  generatedAt: new Date().toISOString(),
  silenceThreshold: SILENCE_THRESHOLD,
  sampleRate: SAMPLE_RATE,
  synthesisPath: 'renderSheetToWavBytes (audioSynth.ts) — offline PCM export, not live Web Audio graph',
  results: results.map(r => ({
    scoreId: r.scoreId,
    noteId: r.noteId,
    trackId: r.trackId,
    voice: r.voice,
    durationBeats: r.durationBeats,
    bpm: r.bpm,
    scoreDurationSec: r.scoreDurationSec,
    measuredDecaySec: r.measuredDecaySec,
    measuredGapSec: r.measuredGapSec,
    peakAmplitude: r.peakAmplitude,
    // Compact RMS: just the values
    rmsEnvelope: r.rmsEnvelope.map(w => ({ t: parseFloat(w.windowStartSec.toFixed(2)), rms: parseFloat(w.rms.toFixed(4)) })),
  })),
}, null, 2) + '\n');
