/**
 * E01–E03 / B04 Browser Scheduling Diagnostic
 *
 * Runs entirely in a real browser page via Playwright injection.
 * Returns structured JSON — no audio output is measured.
 * Records JS/AudioContext clock relationships, scheduling timestamps,
 * callback jitter, and envelope duration facts.
 *
 * NOT a proof of audible onset accuracy. Web Audio sample-level timing
 * cannot be verified without an audio capture pipeline.
 */

import { COMPOSITION_PRESETS } from './composition.ts';
import { planCompositionTimeline, CompositionLookaheadCursor, classifyScheduledEvents } from './compositionTimeline.ts';

export interface SchedulingEvent {
  noteId: string;
  nominalOffsetSec: number;
  jsCallbackTimeSec: number;      // performance.now() / 1000 at callback
  audioCtxClockSec: number;       // AudioContext.currentTime at callback
  scheduledAudioSec: number;      // The timestamp passed to oscillator.start()
  lateByMs: number;               // jsCallbackTime - (origin + nominalOffset) in ms, clamped negative = 0
  classifiedLate: boolean;        // classifyScheduledEvents result
}

export interface DiagnosticRun {
  label: string;
  scoreId: string;
  bpm: number;
  events: SchedulingEvent[];
  pollIntervalMs: number;
  horizonMs: number;
  originAudioSec: number;
  originPerfNowSec: number;
  audioCtxFrozen: boolean;        // true if currentTime never advanced
  durationMismatchNotes: Array<{
    noteId: string;
    scoreDurationSec: number;
    synthDecaySec: number;
    gapSec: number;
  }>;
}

/**
 * Encodes the diagnostic logic as a string to be eval'd inside a browser page.
 * Returns a serialisable DiagnosticRun object.
 */
export function buildDiagnosticScript(
  scoreId: string,
  pollIntervalMs: number,
  horizonMs: number,
  injectDelayMs: number,   // 0 = normal run; >0 = simulated callback delay
  runDurationMs: number,
): string {
  // We serialise the preset data into the script so it needs no imports
  const score = COMPOSITION_PRESETS.find(p => p.id === scoreId);
  if (!score) throw new Error(`Unknown score: ${scoreId}`);

  // Pre-compute the timeline in Node so the browser script is data-driven
  const timeline = planCompositionTimeline(score);

  return `
(async () => {
  const scoreId = ${JSON.stringify(scoreId)};
  const bpm = ${score.bpm};
  const pollIntervalMs = ${pollIntervalMs};
  const horizonMs = ${horizonMs};
  const horizonSec = horizonMs / 1000;
  const injectDelayMs = ${injectDelayMs};
  const runDurationMs = ${runDurationMs};
  const timeline = ${JSON.stringify(timeline)};

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  await ctx.resume();

  // Check if the audio clock actually advances (headless detection)
  const preT = ctx.currentTime;
  await new Promise(r => setTimeout(r, 80));
  const postT = ctx.currentTime;
  const audioCtxFrozen = postT <= preT;

  const originAudioSec = ctx.currentTime + 0.12;  // 120ms lead
  const originPerfNowSec = performance.now() / 1000 + 0.12;

  const events = [];
  let nextIndex = 0;

  const scheduleUpcoming = (elapsed) => {
    const limit = elapsed + horizonSec + 1e-9;
    const batch = [];
    while (nextIndex < timeline.length && timeline[nextIndex].startOffsetSeconds <= limit) {
      batch.push(timeline[nextIndex++]);
    }
    if (batch.length === 0) return;

    const lateThresh = elapsed;
    for (const ev of batch) {
      const nominalAbsolute = originAudioSec + ev.startOffsetSeconds;
      const actualOnset = audioCtxFrozen ? nominalAbsolute : Math.max(ctx.currentTime, nominalAbsolute);
      const jsCallbackTimeSec = performance.now() / 1000;
      const audioClockSec = ctx.currentTime;
      const expectedCallMs = (originPerfNowSec + ev.startOffsetSeconds) * 1000;
      const lateByMs = Math.max(0, jsCallbackTimeSec * 1000 - expectedCallMs);
      events.push({
        noteId: ev.id,
        nominalOffsetSec: ev.startOffsetSeconds,
        jsCallbackTimeSec,
        audioCtxClockSec: audioClockSec,
        scheduledAudioSec: actualOnset,
        lateByMs,
        classifiedLate: ev.startOffsetSeconds < elapsed - 1e-9,
      });
    }
  };

  await new Promise(resolve => {
    if (injectDelayMs > 0) {
      // Inject the specified delay, then drain all at once
      setTimeout(() => {
        const elapsed = ctx.currentTime - originAudioSec + (injectDelayMs / 1000);
        // Simulate what a delayed callback sees
        scheduleUpcoming(Math.max(0, elapsed));
        // Poll remaining normally
        const id = setInterval(() => {
          const e = Math.max(0, ctx.currentTime - originAudioSec);
          scheduleUpcoming(e);
          if (nextIndex >= timeline.length) { clearInterval(id); resolve(null); }
        }, pollIntervalMs);
        if (nextIndex >= timeline.length) { clearInterval(0); resolve(null); }
      }, injectDelayMs);
    } else {
      // Normal polling
      const id = setInterval(() => {
        const elapsed = Math.max(0, ctx.currentTime - originAudioSec);
        scheduleUpcoming(elapsed);
        if (nextIndex >= timeline.length) { clearInterval(id); resolve(null); }
      }, pollIntervalMs);
    }
    setTimeout(() => resolve(null), runDurationMs);
  });

  ctx.close().catch(() => {});

  // B04: compare score note durations to synth decay approximation
  // The synth uses decaySec = effectiveDecayMs/1000 clamped per voice.
  // We measure score duration vs a 900ms max decay cap (clampDecayMs ceiling).
  const durationMismatches = timeline.map(ev => {
    const scoreDurationSec = ev.durationSeconds;
    const synthDecaySec = Math.min(0.9, scoreDurationSec); // clampDecayMs ceiling = 900ms
    const gapSec = scoreDurationSec - synthDecaySec;
    return { noteId: ev.id, scoreDurationSec, synthDecaySec, gapSec };
  }).filter(m => m.gapSec > 0.001);

  return {
    label: scoreId + (injectDelayMs > 0 ? '_delayed' : '_normal'),
    scoreId,
    bpm,
    events,
    pollIntervalMs,
    horizonMs,
    originAudioSec,
    originPerfNowSec,
    audioCtxFrozen,
    durationMismatchNotes: durationMismatches,
  };
})()
`;
}

/** Compute summary statistics from a completed diagnostic run. */
export interface RunStats {
  totalEvents: number;
  lateEvents: number;
  latePercent: number;
  lateMs: { median: number; p95: number; max: number };
  coalesced: number;      // events sharing the same scheduledAudioSec (rounded to 1ms)
  audioCtxFrozen: boolean;
  b04MismatchCount: number;
  b04MaxGapSec: number;
}

export function summariseRun(run: DiagnosticRun): RunStats {
  const latencies = run.events.map(e => e.lateByMs).sort((a, b) => a - b);
  const lateEvents = run.events.filter(e => e.classifiedLate).length;
  const p = (arr: number[], pct: number) => arr[Math.floor((pct / 100) * (arr.length - 1))] ?? 0;

  // Count coalesced onsets: two events within 1ms of each other at the audio layer
  let coalesced = 0;
  const seen = new Map<number, number>();
  for (const e of run.events) {
    const bucket = Math.round(e.scheduledAudioSec * 1000);
    seen.set(bucket, (seen.get(bucket) ?? 0) + 1);
  }
  for (const count of seen.values()) if (count > 1) coalesced += count;

  const b04Gaps = run.durationMismatchNotes.map(m => m.gapSec);

  return {
    totalEvents: run.events.length,
    lateEvents,
    latePercent: run.events.length ? (lateEvents / run.events.length) * 100 : 0,
    lateMs: {
      median: p(latencies, 50),
      p95: p(latencies, 95),
      max: latencies[latencies.length - 1] ?? 0,
    },
    coalesced,
    audioCtxFrozen: run.audioCtxFrozen,
    b04MismatchCount: run.durationMismatchNotes.length,
    b04MaxGapSec: b04Gaps.length ? Math.max(...b04Gaps) : 0,
  };
}
