/**
 * W1 Production-Path Scheduling Diagnostic  (corrected, 18 Nov 2026)
 *
 * Exercises the ACTUAL engine modules used by CompositionJourneyView:
 *   planCompositionTimeline → CompositionLookaheadCursor.pull
 *   → classifyScheduledEvents
 *   → noteAsSynthStep → mapMathToSynthParams (B04 chain)
 *
 * Run with: node --import tsx src/engine/productionPathDiagnostic.ts
 *
 * What this measures:
 *   - Computed scheduledAudioSec timestamps (= what the Web Audio API
 *     receives as the start() argument) relative to the audio-clock origin.
 *   - JS callback timing (performance.now) vs. expected nominal schedule time.
 *   - Correct seek: planCompositionTimeline(score, fromBeat) reduces the event
 *     list and shifts offsets to start from 0 relative to the seek point.
 *   - Real B04 chain: noteAsSynthStep → mapMathToSynthParams → voice multiplier.
 *
 * What this CANNOT measure (stated explicitly per R6):
 *   - Whether audio hardware actually produced sound at the scheduled timestamp.
 *   - Perceived rhythmic quality by a listener.
 *   - setInterval callback jitter under real page load (React, GC, layout).
 *   - AudioContext behaviour in a background tab.
 *
 * The diagnostic runs in Node (no browser/AudioContext). It models the
 * production timing computations using performance.now() as a clock proxy.
 * This is sufficient to verify timestamp algebra and seek correctness.
 * Browser-side AudioContext clock behaviour is separately noted as unverifiable
 * in this environment.
 */

import { COMPOSITION_PRESETS, noteAsSynthStep } from './composition.ts';
import {
  planCompositionTimeline,
  CompositionLookaheadCursor,
  classifyScheduledEvents,
  type TimedCompositionNote,
} from './compositionTimeline.ts';
import { mapMathToSynthParams } from './mathArtTheory.ts';
import { clampDecayMs } from './spreadsheetVm.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

type VoiceId = 'music-box' | 'celestial-chime' | 'haunted-organ' | 'analog-pluck';

interface ScheduledEvent {
  noteId: string;
  trackId: string;
  startBeat: number;
  nominalOffsetSec: number;
  computedAudioOnsetSec: number;  // = originAudioSec + max(0, nominalOffset) [production formula]
  jsCallbackOffsetSec: number;    // performance.now() relative to origin, at the moment pull() fires
  lateByMs: number;               // max(0, jsCallbackOffset - nominalOffset) × 1000
  classifiedLate: boolean;
}

interface SeekCase {
  fromBeat: number;
  expectedEventCount: number;
  actualEventCount: number;
  firstEventStartBeat: number | null;
  firstEventOffsetSec: number | null;
  correct: boolean;
}

interface B04Note {
  noteId: string;
  trackId: string;
  startBeat: number;
  durationBeats: number;
  scoreDurationSec: number;
  baseDecayMs: number;      // from noteAsSynthStep → mapMathToSynthParams (harmonic-sine, imperfection=0)
  voiceDecays: Record<VoiceId, {
    finalDecayMs: number;
    gapSec: number;
    truncationPct: number;
    cappedAt900: boolean;
  }>;
  worstCaseVoice: VoiceId;
  worstCaseGapSec: number;
  bestCaseVoice: VoiceId;
  bestCaseGapSec: number;
}

interface DiagnosticCase {
  label: string;
  scoreId: string;
  bpm: number;
  fromBeat: number;
  pollIntervalMs: number;
  horizonMs: number;
  delayMs: number;          // 0 = normal; >0 = simulated callback delay
  events: ScheduledEvent[];
  seekVerification: SeekCase | null;
  b04Notes: B04Note[];
  summaryStats: {
    totalEvents: number;
    lateEvents: number;
    latePercent: number;
    p50LateMs: number;
    p95LateMs: number;
    maxLateMs: number;
    coalescedOnsets: number;  // events sharing same computed onset (1ms bucket)
  };
}

// ── B04 analysis ──────────────────────────────────────────────────────────────

function analyseB04(events: TimedCompositionNote[], bpm: number): B04Note[] {
  const voices: VoiceId[] = ['music-box', 'celestial-chime', 'haunted-organ', 'analog-pluck'];
  return events.map(ev => {
    const note = ev.note;
    const step = noteAsSynthStep(note, bpm);
    const mathFm = mapMathToSynthParams(step, 'harmonic-sine', 0);
    const baseDecayMs = mathFm.effectiveDecayMs;
    const scoreDurationSec = ev.durationSeconds;

    // Reproduce exact voice switch from audioSynth.ts scheduleStepAt():
    const voiceDecays = {} as B04Note['voiceDecays'];
    for (const voice of voices) {
      const baseDecaySec = baseDecayMs / 1000;
      const finalDecaySec =
        voice === 'celestial-chime' ? Math.min(1.1, baseDecaySec * 1.45)
        : voice === 'haunted-organ'  ? Math.min(1.0, baseDecaySec * 1.25)
        : baseDecaySec;
      const gapSec = Math.max(0, scoreDurationSec - finalDecaySec);
      voiceDecays[voice] = {
        finalDecayMs: Math.round(finalDecaySec * 1000),
        gapSec,
        truncationPct: scoreDurationSec > 0 ? (gapSec / scoreDurationSec) * 100 : 0,
        cappedAt900: baseDecayMs >= 900,
      };
    }

    const gaps = voices.map(v => ({ v, gap: voiceDecays[v].gapSec }));
    gaps.sort((a, b) => b.gap - a.gap);
    const worst = gaps[0];
    const best = gaps[gaps.length - 1];

    return {
      noteId: note.id,
      trackId: note.trackId,
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
      scoreDurationSec,
      baseDecayMs,
      voiceDecays,
      worstCaseVoice: worst.v as VoiceId,
      worstCaseGapSec: worst.gap,
      bestCaseVoice: best.v as VoiceId,
      bestCaseGapSec: best.gap,
    };
  });
}

// ── Virtual-clock scheduler ───────────────────────────────────────────────────
// Mimics CompositionJourneyView.scheduleUpcoming():
//   elapsed = getAudioClockTime() - originAudioSeconds
//   batch = cursor.pull(elapsed, horizonSec)
//   for event: onset = max(ctx.currentTime, originAudioSec + event.startOffsetSeconds)
//
// In Node there is no AudioContext. We use performance.now() as the clock and
// simulate a fixed-rate poll (synchronous, deterministic). The onset formula
// is reproduced exactly; it cannot produce a real Web Audio timestamp.

function runVirtualScheduler(
  events: TimedCompositionNote[],
  pollIntervalMs: number,
  horizonSec: number,
  delayMs: number,
  originSec: number,     // simulated audio origin in seconds from performance.now() / 1000
): ScheduledEvent[] {
  const cursor = new CompositionLookaheadCursor(events);
  const scheduled: ScheduledEvent[] = [];

  // Simulate time advancing in poll-sized steps.
  // If delayMs > 0, skip ahead by that amount for the first poll only.
  let simulatedNowSec = originSec;
  const pollSec = pollIntervalMs / 1000;
  const maxIterations = Math.ceil(
    (events[events.length - 1]?.startOffsetSeconds ?? 0) / pollSec + 10,
  );

  for (let i = 0; i < maxIterations && cursor.remaining > 0; i++) {
    // First iteration may have an injected delay
    const stepSec = i === 0 && delayMs > 0 ? (delayMs / 1000) : pollSec;
    simulatedNowSec += stepSec;

    const elapsed = simulatedNowSec - originSec;
    const batch = cursor.pull(elapsed, horizonSec);
    if (batch.length === 0) continue;

    const { late, onTime } = classifyScheduledEvents(batch, elapsed);

    for (const ev of batch) {
      const nominalAbsoluteSec = originSec + ev.startOffsetSeconds;
      // Production formula: Math.max(ctx.currentTime, startAudioSeconds)
      const computedAudioOnsetSec = Math.max(simulatedNowSec, nominalAbsoluteSec);
      const jsCallbackOffsetSec = elapsed;
      const lateByMs = Math.max(0, (elapsed - ev.startOffsetSeconds) * 1000);
      scheduled.push({
        noteId: ev.id,
        trackId: ev.note.trackId,
        startBeat: ev.startBeat,
        nominalOffsetSec: ev.startOffsetSeconds,
        computedAudioOnsetSec,
        jsCallbackOffsetSec,
        lateByMs,
        classifiedLate: late.some(l => l.id === ev.id),
      });
    }
  }

  return scheduled;
}

// ── Summary statistics ────────────────────────────────────────────────────────

function computeStats(events: ScheduledEvent[]): DiagnosticCase['summaryStats'] {
  if (events.length === 0) {
    return { totalEvents: 0, lateEvents: 0, latePercent: 0, p50LateMs: 0, p95LateMs: 0, maxLateMs: 0, coalescedOnsets: 0 };
  }
  const latencies = events.map(e => e.lateByMs).sort((a, b) => a - b);
  const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(p / 100 * (arr.length - 1)))];
  const lateEvents = events.filter(e => e.classifiedLate).length;

  // Count events sharing the same 1ms onset bucket
  const buckets = new Map<number, number>();
  for (const e of events) {
    const b = Math.round(e.computedAudioOnsetSec * 1000);
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  let coalesced = 0;
  for (const count of buckets.values()) if (count > 1) coalesced += count;

  return {
    totalEvents: events.length,
    lateEvents,
    latePercent: (lateEvents / events.length) * 100,
    p50LateMs: pct(latencies, 50),
    p95LateMs: pct(latencies, 95),
    maxLateMs: latencies[latencies.length - 1] ?? 0,
    coalescedOnsets: coalesced,
  };
}

// ── Case runner ───────────────────────────────────────────────────────────────

function runCase(
  label: string,
  scoreId: string,
  fromBeat: number,
  pollMs: number,
  horizonMs: number,
  delayMs: number,
): DiagnosticCase {
  const score = COMPOSITION_PRESETS.find(p => p.id === scoreId)!;
  const events = planCompositionTimeline(score, fromBeat);
  const originSec = 0.12; // Matches preparePlayback(0.15) lead

  // Seek verification: check that event count and first-event beat are correct
  let seekVerification: SeekCase | null = null;
  if (fromBeat > 0) {
    const allEvents = planCompositionTimeline(score, 0);
    const expectedAfterSeek = allEvents.filter(e => e.startBeat >= fromBeat - 1e-9);
    seekVerification = {
      fromBeat,
      expectedEventCount: expectedAfterSeek.length,
      actualEventCount: events.length,
      firstEventStartBeat: events[0]?.startBeat ?? null,
      firstEventOffsetSec: events[0]?.startOffsetSeconds ?? null,
      correct: events.length === expectedAfterSeek.length &&
               (events[0]?.startBeat ?? -1) >= fromBeat - 1e-9 &&
               Math.abs((events[0]?.startOffsetSeconds ?? 0)) < 1e-9 + (events[0]?.startBeat ?? 0) - fromBeat,
    };
    // More precise: first event offset should equal (firstBeat - fromBeat) * 60/bpm
    if (events.length > 0) {
      const expectedFirstOffset = (events[0].startBeat - fromBeat) * 60 / score.bpm;
      seekVerification.correct =
        events.length === expectedAfterSeek.length &&
        events[0].startBeat >= fromBeat - 1e-9 &&
        Math.abs(events[0].startOffsetSeconds - expectedFirstOffset) < 1e-10;
    }
  }

  const scheduled = runVirtualScheduler(events, pollMs, horizonMs / 1000, delayMs, originSec);
  const b04Notes = analyseB04(events, score.bpm).filter(n => n.worstCaseGapSec > 0.001);

  return {
    label,
    scoreId,
    bpm: score.bpm,
    fromBeat,
    pollIntervalMs: pollMs,
    horizonMs,
    delayMs,
    events: scheduled,
    seekVerification,
    b04Notes,
    summaryStats: computeStats(scheduled),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const cases: DiagnosticCase[] = [
  // E03-A: normal poll, fast notes
  runCase('E03-A: production-path/pulse-study/normal', 'pulse-study', 0, 30, 180, 0),
  // E03-B: simultaneous voices
  runCase('E03-B: production-path/leap-dialogue/normal', 'leap-dialogue', 0, 30, 180, 0),
  // E03-C: ascending pitch
  runCase('E03-C: production-path/ascending-light/normal', 'ascending-light', 0, 30, 180, 0),
  // E03-D: 400ms injected delay (negative control)
  runCase('E03-D: production-path/pulse-study/400ms-delay', 'pulse-study', 0, 30, 180, 400),
  // E03-E: CORRECTED seek — glass-garden from beat 3 (was incorrectly beat 0 before)
  runCase('E03-E: production-path/glass-garden/seek-beat3', 'glass-garden', 3, 30, 180, 0),
  // E03-F: seek at beat 0 for comparison (full timeline)
  runCase('E03-F: production-path/glass-garden/no-seek', 'glass-garden', 0, 30, 180, 0),
];

// ── Print results ─────────────────────────────────────────────────────────────

const sep = '─'.repeat(110);
process.stderr.write('\n' + sep + '\n');
process.stderr.write('W1 Production-Path Scheduling Diagnostic (corrected)\n');
process.stderr.write('Engine: planCompositionTimeline → CompositionLookaheadCursor → classifyScheduledEvents\n');
process.stderr.write('Clock: virtual (performance.now proxy) — NOT a real AudioContext; onset timestamps are computed, not measured\n');
process.stderr.write(sep + '\n');
process.stderr.write(
  `${'Case'.padEnd(50)} ${'Ev'.padStart(3)} ${'Late'.padStart(5)} ${'Late%'.padStart(6)} ` +
  `${'p50ms'.padStart(6)} ${'p95ms'.padStart(6)} ${'maxMs'.padStart(6)} ${'Coal.'.padStart(6)}\n`,
);
process.stderr.write(sep + '\n');

for (const c of cases) {
  const s = c.summaryStats;
  process.stderr.write(
    `${c.label.padEnd(50)} ${String(s.totalEvents).padStart(3)} ${String(s.lateEvents).padStart(5)} ` +
    `${s.latePercent.toFixed(0).padStart(5)}% ` +
    `${s.p50LateMs.toFixed(1).padStart(6)} ${s.p95LateMs.toFixed(1).padStart(6)} ` +
    `${s.maxLateMs.toFixed(1).padStart(6)} ${String(s.coalescedOnsets).padStart(6)}\n`,
  );
  if (c.seekVerification) {
    const sv = c.seekVerification;
    const ok = sv.correct ? '✔' : '✖ FAIL';
    process.stderr.write(
      `  SEEK from beat ${sv.fromBeat}: expected ${sv.expectedEventCount} events, got ${sv.actualEventCount}. ` +
      `First event beat=${sv.firstEventStartBeat?.toFixed(1)} offset=${sv.firstEventOffsetSec?.toFixed(3)}s. ${ok}\n`,
    );
  }
}

process.stderr.write(sep + '\n');
process.stderr.write('\nE03-D delayed events:\n');
const delayedCase = cases.find(c => c.label.includes('400ms'));
if (delayedCase) {
  for (const ev of delayedCase.events.filter(e => e.classifiedLate)) {
    process.stderr.write(
      `  ${ev.noteId}: nominal=${ev.nominalOffsetSec.toFixed(3)}s ` +
      `computed_onset=${ev.computedAudioOnsetSec.toFixed(4)}s ` +
      `lateBy=${ev.lateByMs.toFixed(1)}ms\n`,
    );
  }
  const coalesced = delayedCase.events.filter(e => e.classifiedLate && e.lateByMs > 0);
  if (coalesced.length >= 2) {
    const same = coalesced.filter(e =>
      Math.abs(e.computedAudioOnsetSec - coalesced[0].computedAudioOnsetSec) < 0.001,
    );
    process.stderr.write(`  → ${same.length} notes share onset=${coalesced[0].computedAudioOnsetSec.toFixed(4)}s (coalesced)\n`);
  }
}

process.stderr.write('\nB04 — Real chain: noteAsSynthStep → mapMathToSynthParams → voice multiplier\n');
process.stderr.write('Source: noteAsSynthStep decayMs = clamp(beats × 60000/bpm × 0.86, 90, 900)\n');
process.stderr.write('Voice multipliers: celestial-chime ×1.45 (cap 1100ms), haunted-organ ×1.25 (cap 1000ms)\n');
process.stderr.write('Note: gaps are CALCULATED from source code, NOT measured audio envelopes\n\n');

// Show worst case per score (worst-case voice)
const b04BySCore = new Map<string, { maxGap: number; note: B04Note; voice: string }>();
for (const c of cases) {
  for (const n of c.b04Notes) {
    const key = c.scoreId;
    const current = b04BySCore.get(key);
    if (!current || n.worstCaseGapSec > current.maxGap) {
      b04BySCore.set(key, { maxGap: n.worstCaseGapSec, note: n, voice: n.worstCaseVoice });
    }
  }
}

process.stderr.write(
  `${'Score'.padEnd(20)} ${'BPM'.padStart(4)} ${'Note'.padEnd(12)} ${'Beats'.padStart(6)} ` +
  `${'scoreSec'.padStart(9)} ${'baseMs'.padStart(7)} ` +
  `${'worst-voice'.padEnd(16)} ${'worstMs'.padStart(8)} ${'gapSec'.padStart(7)} ${'trunc%'.padStart(7)} ` +
  `${'best-voice'.padEnd(16)} ${'bestMs'.padStart(8)} ${'bestGap'.padStart(8)}\n`,
);
process.stderr.write('─'.repeat(130) + '\n');

for (const [scoreId, { note, voice }] of b04BySCore) {
  const score = COMPOSITION_PRESETS.find(p => p.id === scoreId)!;
  const wd = note.voiceDecays[note.worstCaseVoice];
  const bd = note.voiceDecays[note.bestCaseVoice];
  process.stderr.write(
    `${scoreId.padEnd(20)} ${String(score.bpm).padStart(4)} ${note.noteId.padEnd(12)} ` +
    `${String(note.durationBeats).padStart(6)} ` +
    `${note.scoreDurationSec.toFixed(3).padStart(9)} ${String(Math.round(note.baseDecayMs)).padStart(7)} ` +
    `${note.worstCaseVoice.padEnd(16)} ${String(wd.finalDecayMs).padStart(8)} ` +
    `${wd.gapSec.toFixed(3).padStart(7)} ${wd.truncationPct.toFixed(0).padStart(6)}% ` +
    `${note.bestCaseVoice.padEnd(16)} ${String(bd.finalDecayMs).padStart(8)} ` +
    `${bd.gapSec.toFixed(3).padStart(8)}\n`,
  );
}

process.stderr.write('\nMEASUREMENT LIMITS (explicitly stated per R6):\n');
process.stderr.write('  - computedAudioOnsetSec: computed timestamp algebra only; NOT measured DAC output\n');
process.stderr.write('  - B04 gaps: source-code calculation; NOT measured audio waveform or listener perception\n');
process.stderr.write('  - Scheduler jitter: virtual clock (synchronous); NOT real setInterval under page load\n');
process.stderr.write('  - AudioContext.currentTime in headless Chromium: does not advance reliably\n');
process.stderr.write('  - Real browser audio output requires a headed browser + audio capture hardware\n');
process.stderr.write(sep + '\n');

// Output JSON for archiving
process.stdout.write(JSON.stringify({ cases, generatedAt: new Date().toISOString() }, null, 2) + '\n');
