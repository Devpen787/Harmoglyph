import { type EvaluatedRowStep, type MathFoundationId, type SynthVoiceId } from '../types/chimera.ts';
import { clampDecayMs, clampFmIndex, clampFreq, clampGate, clampModRatio } from './spreadsheetVm.ts';
import { mapMathToSynthParams } from './mathArtTheory.ts';

export const SYNTH_VOICES: Array<{ id: SynthVoiceId; label: string }> = [
  { id: 'music-box', label: 'Music Box' },
  { id: 'celestial-chime', label: 'Celestial Chime' },
  { id: 'haunted-organ', label: 'Haunted Organ' },
  { id: 'analog-pluck', label: 'Analog Pluck' },
];

class ChimeraAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private sampleBuf = new Float32Array(64);
  private activeOscillators = new Set<OscillatorNode>();

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.28;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;

      // Subtle warm delay echo network for musical depth
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.value = 0.23;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2300;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.26;
      const delayWet = this.ctx.createGain();
      delayWet.gain.value = 0.22;

      this.masterGain.connect(this.analyser);
      this.masterGain.connect(this.delayNode);
      this.delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      delayFilter.connect(delayWet);
      delayWet.connect(this.analyser);

      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Prepare a short start lead while the user gesture can unlock Web Audio.
   * A frozen/suspended context has no progressing time; the caller must handle
   * suspension and must not infer device output latency from this value.
   */
  public preparePlayback(leadSeconds = 0.12): number | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    return ctx.currentTime + Math.max(0.06, Math.min(0.5, leadSeconds));
  }

  public getAudioClockTime(): number | null {
    return this.ctx?.currentTime ?? null;
  }

  /** Stop scheduled and sounding oscillators on edit, pause or navigation. */
  public stopScheduledNotes(): void {
    const now = this.ctx?.currentTime;
    if (now === undefined) return;
    for (const oscillator of this.activeOscillators) {
      try { oscillator.stop(now); } catch { /* Already ended. */ }
    }
    this.activeOscillators.clear();
  }

  /** Existing instant audition path remains supported. */
  public triggerStep(
    step: EvaluatedRowStep,
    voice: SynthVoiceId = 'music-box',
    foundation: MathFoundationId = 'harmonic-sine',
    imperfection = 0,
  ): void {
    this.scheduleStepAt(step, undefined, voice, foundation, imperfection);
  }

  /** Schedule a note against an explicit AudioContext-clock timestamp. */
  public scheduleStepAt(
    step: EvaluatedRowStep,
    startAudioSeconds: number | undefined,
    voice: SynthVoiceId = 'music-box',
    foundation: MathFoundationId = 'harmonic-sine',
    imperfection = 0,
  ): void {
    const gate = clampGate(step.gate);
    if (gate <= 0.02 || step.hasError) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // Late notes are made audible now; their nominal target is preserved in
    // the deterministic timeline for independent late-scheduler measurements.
    const now = startAudioSeconds !== undefined && Number.isFinite(startAudioSeconds)
      ? Math.max(ctx.currentTime, startAudioSeconds) : ctx.currentTime;
    const freq = clampFreq(step.freqHz);
    const mathFm = mapMathToSynthParams(step, foundation, imperfection);
    const fmIndex = mathFm.effectiveFmIndex;
    const modRatio = mathFm.effectiveModRatio;
    const baseDecay = mathFm.effectiveDecayMs / 1000;
    const decaySec =
      voice === 'celestial-chime'
        ? Math.min(1.1, baseDecay * 1.45)
        : voice === 'haunted-organ'
          ? Math.min(1.0, baseDecay * 1.25)
          : baseDecay;
    const peakGain = Math.min(0.32, 0.26 * gate);

    const carrier = ctx.createOscillator();
    const chorusOsc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const chorusGain = ctx.createGain();
    const subGain = ctx.createGain();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    if (voice === 'music-box') {
      carrier.type = 'sine';
      chorusOsc.type = 'triangle';
      chorusOsc.frequency.setValueAtTime(clampFreq(freq * 2), now);
      chorusGain.gain.setValueAtTime(0.16, now);
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(clampFreq(freq * 0.5), now);
      subGain.gain.setValueAtTime(0.12, now);
      modGain.gain.setValueAtTime(freq * (fmIndex * 0.14), now);
      filter.frequency.setValueAtTime(Math.min(6400, freq * 4.5), now);
      filter.Q.setValueAtTime(1.5, now);
    } else if (voice === 'celestial-chime') {
      carrier.type = 'sine';
      chorusOsc.type = 'sine';
      chorusOsc.detune.setValueAtTime(9, now);
      chorusOsc.frequency.setValueAtTime(freq, now);
      chorusGain.gain.setValueAtTime(0.35, now);
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(clampFreq(freq * 0.5), now);
      subGain.gain.setValueAtTime(0.18, now);
      modGain.gain.setValueAtTime(freq * (fmIndex * 0.2), now);
      filter.frequency.setValueAtTime(Math.min(5800, freq * 3.8), now);
      filter.Q.setValueAtTime(1.8, now);
    } else if (voice === 'haunted-organ') {
      carrier.type = 'sawtooth';
      chorusOsc.type = 'triangle';
      chorusOsc.frequency.setValueAtTime(clampFreq(freq * 1.498), now);
      chorusGain.gain.setValueAtTime(0.24, now);
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(clampFreq(freq * 0.5), now);
      subGain.gain.setValueAtTime(0.28, now);
      modGain.gain.setValueAtTime(freq * (fmIndex * 0.16), now);
      filter.frequency.setValueAtTime(Math.min(3600, freq * 2.4), now);
      filter.Q.setValueAtTime(2.6, now);
    } else {
      // analog-pluck
      carrier.type = 'sawtooth';
      chorusOsc.type = 'sawtooth';
      chorusOsc.detune.setValueAtTime(-11, now);
      chorusOsc.frequency.setValueAtTime(freq, now);
      chorusGain.gain.setValueAtTime(0.32, now);
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(clampFreq(freq * 0.5), now);
      subGain.gain.setValueAtTime(0.25, now);
      modGain.gain.setValueAtTime(freq * (fmIndex * 0.18), now);
      filter.frequency.setValueAtTime(Math.min(6200, freq * 5.2), now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 1.2), now + decaySec);
      filter.Q.setValueAtTime(3.2, now);
    }

    carrier.frequency.setValueAtTime(freq, now);
    if (mathFm.detuneCents !== 0) {
      carrier.detune.setValueAtTime(mathFm.detuneCents, now);
    }
    mod.type = 'sine';
    mod.frequency.setValueAtTime(clampFreq(freq * modRatio), now);
    modGain.gain.exponentialRampToValueAtTime(0.5, now + decaySec);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      Math.min(7200, Math.max(240, filter.frequency.value * mathFm.filterScale)),
      now,
    );
    const attackSec = voice === 'haunted-organ' ? 0.032 : 0.009;
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + attackSec);
    if (decaySec >= 0.35) {
      env.gain.linearRampToValueAtTime(peakGain * 0.56, now + decaySec * 0.42);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, now + decaySec);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(filter);
    chorusOsc.connect(chorusGain);
    chorusGain.connect(filter);
    subOsc.connect(subGain);
    subGain.connect(filter);

    filter.connect(env);
    env.connect(this.masterGain);

    const stopAt = now + decaySec + 0.04;
    for (const oscillator of [carrier, chorusOsc, subOsc, mod]) {
      this.activeOscillators.add(oscillator);
      oscillator.addEventListener('ended', () => this.activeOscillators.delete(oscillator), { once: true });
      oscillator.start(now);
      oscillator.stop(stopAt);
    }
  }

  public sampleWaveformInto(
    out: Float32Array,
    fallbackStep?: EvaluatedRowStep,
    foundation: MathFoundationId = 'harmonic-sine',
    phaseOffset = 0,
    imperfection = 0,
  ): number {
    const len = out.length;
    if (this.analyser && this.ctx?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.sampleBuf);
      let energy = 0;
      const stride = this.sampleBuf.length / len;
      for (let i = 0; i < len; i++) {
        const idx = Math.min(this.sampleBuf.length - 1, Math.floor(i * stride));
        const v = Math.max(-1, Math.min(1, (this.sampleBuf[idx] ?? 0) * 2.4));
        out[i] = v;
        energy += Math.abs(v);
      }
      if (energy > 0.004) {
        return energy / len;
      }
    }

    if (!fallbackStep) {
      out.fill(0);
      return 0;
    }

    const mathFm = mapMathToSynthParams(fallbackStep, foundation, imperfection);
    const cycles = Math.max(1, fallbackStep.freqHz / 110);
    let energy = 0;
    for (let i = 0; i < len; i++) {
      const t = (i / len) * Math.PI * 2 + phaseOffset;
      const mod = Math.sin(t * cycles * mathFm.effectiveModRatio) * mathFm.effectiveFmIndex * 0.22;
      const val = Math.sin(t * cycles + mod) * Math.max(0.22, fallbackStep.gate) * 0.62;
      out[i] = val;
      energy += Math.abs(val);
    }
    return energy / len;
  }

  public readWaveform(
    fallbackStep?: EvaluatedRowStep,
    foundation: MathFoundationId = 'harmonic-sine',
    imperfection = 0,
  ): number[] {
    if (this.analyser && this.ctx?.state === 'running') {
      this.analyser.getFloatTimeDomainData(this.sampleBuf);
      const out: number[] = [];
      let energy = 0;
      for (let i = 0; i < 32; i++) {
        const v = this.sampleBuf[i * 2] ?? 0;
        energy += Math.abs(v);
        out.push(Math.max(-1, Math.min(1, v * 2.2)));
      }
      if (energy > 0.004) return out;
    }

    if (!fallbackStep) return new Array(32).fill(0);
    const mathFm = mapMathToSynthParams(fallbackStep, foundation, imperfection);
    const out: number[] = [];
    const cycles = Math.max(1, fallbackStep.freqHz / 110);
    for (let i = 0; i < 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      const mod = Math.sin(t * cycles * mathFm.effectiveModRatio) * mathFm.effectiveFmIndex * 0.22;
      out.push(Math.sin(t * cycles + mod) * Math.max(0.25, fallbackStep.gate) * 0.65);
    }
    return out;
  }
}

export const chimeraAudio = new ChimeraAudioEngine();

export function renderSheetToWavBytes(
  steps: EvaluatedRowStep[],
  bpm: number,
  loops = 1,
  voice: SynthVoiceId = 'music-box',
  foundation: MathFoundationId = 'harmonic-sine',
  imperfection = 0,
): Uint8Array {
  const sampleRate = 22050;
  const safeBpm = Math.max(40, Math.min(240, bpm));
  const stepSec = 60 / safeBpm / 2;
  const totalSteps = steps.length * loops;
  const tailSec = 0.75;
  const totalSamples = Math.floor((totalSteps * stepSec + tailSec) * sampleRate);
  const floatBuf = new Float32Array(totalSamples);

  for (let loop = 0; loop < loops; loop++) {
    for (let sIdx = 0; sIdx < steps.length; sIdx++) {
      const step = steps[sIdx];
      const gate = clampGate(step.gate);
      if (gate <= 0.02 || step.hasError) continue;

      const startSample = Math.floor((loop * steps.length + sIdx) * stepSec * sampleRate);
      const freq = clampFreq(step.freqHz);
      const mathFm = mapMathToSynthParams(step, foundation, imperfection);
      const modFreq = clampFreq(freq * mathFm.effectiveModRatio);
      const fmDepth = mathFm.effectiveFmIndex * (voice === 'music-box' ? 0.25 : 0.38);
      const decayMult = voice === 'celestial-chime' ? 1.4 : voice === 'haunted-organ' ? 1.2 : 1.0;
      const decaySamples = Math.floor((mathFm.effectiveDecayMs * decayMult / 1000) * sampleRate);
      const amp = Math.min(0.32, 0.24 * gate);

      for (let i = 0; i < decaySamples; i++) {
        const pos = startSample + i;
        if (pos >= totalSamples) break;
        const t = i / sampleRate;
        const attack = Math.min(1, i / Math.floor((voice === 'haunted-organ' ? 0.03 : 0.009) * sampleRate));
        const env = attack * Math.exp((-4.2 * i) / Math.max(1, decaySamples));
        const modVal = Math.sin(2 * Math.PI * modFreq * t) * fmDepth * (1 - i / decaySamples);

        const fundamental = Math.sin(2 * Math.PI * freq * t + modVal);
        const overtone =
          voice === 'music-box'
            ? 0.2 * Math.sin(2 * Math.PI * freq * 2 * t)
            : voice === 'haunted-organ'
              ? 0.24 * Math.sin(2 * Math.PI * freq * 1.498 * t)
              : voice === 'analog-pluck'
                ? 0.22 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp((-8 * i) / Math.max(1, decaySamples))
                : 0.25 * Math.sin(2 * Math.PI * (freq * 1.004) * t + modVal);
        const sub = 0.14 * Math.sin(2 * Math.PI * (freq * 0.5) * t);

        const sample = (fundamental + overtone + sub) * env * amp;
        floatBuf[pos] = Math.max(-0.92, Math.min(0.92, floatBuf[pos] + sample));
      }
    }
  }

  // Apply gentle offline musical delay echo for lush depth
  const delaySamples = Math.floor(0.23 * sampleRate);
  for (let i = delaySamples; i < totalSamples; i++) {
    floatBuf[i] = Math.max(-0.95, Math.min(0.95, floatBuf[i] + floatBuf[i - delaySamples] * 0.25));
  }

  const dataByteLen = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLen, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataByteLen, true);

  for (let i = 0; i < totalSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, floatBuf[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }

  return new Uint8Array(buffer);
}
