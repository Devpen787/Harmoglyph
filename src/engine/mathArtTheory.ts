import {
  type ArtModeId,
  type EvaluatedRowStep,
  type MathFoundationId,
  SHEET_COLS,
  type SheetCol,
  type SheetEvaluationResult,
  type SheetRawGrid,
} from '../types/chimera.ts';
import { clampDecayMs, clampFmIndex, clampModRatio } from './spreadsheetVm.ts';

export const PHI = (1 + Math.sqrt(5)) / 2; // 1.618033988749895
export const INV_PHI = 1 / PHI; // 0.6180339887498949
export const GOLDEN_ANGLE_RAD = (Math.PI * 2) / (PHI * PHI); // ~137.5077 deg in radians

export interface MathFoundationSpec {
  id: MathFoundationId;
  label: string;
  principle: string;
  musicalEffect: string;
  visualEffect: string;
  equation: string;
}

export interface FoundationSynthParams {
  effectiveFmIndex: number;
  effectiveModRatio: number;
  effectiveDecayMs: number;
  detuneCents: number;
  filterScale: number;
}

export interface FoundationArtParams {
  freqMultiplierX: number;
  freqMultiplierY: number;
  phaseOffsetRad: number;
  spiralTwistRad: number;
  radialScale: number;
  petalOrder: number;
  secondaryScale: number;
}

export interface Sculpture3DParams {
  vertexCount: number;
  tubularSegments: number;
  orbitRadiusScale: number;
  coronaRadiusScale: number;
  lobeOrder: number;
  angularTwist: number;
  sampleOrbitScaleAt: (t: number, step?: EvaluatedRowStep) => number;
}

export const MATH_FOUNDATIONS: MathFoundationSpec[] = [
  {
    id: 'harmonic-sine',
    label: 'Harmonic Sine',
    principle: 'Fourier integer wave superposition (2π periodic phase)',
    musicalEffect: 'Pure harmonic FM sidebands with smooth sinusoidal tremolo',
    visualEffect: 'Clean orthogonal Lissajous & harmonic wave symmetry',
    equation: 'y(t) = Σ Aₙ·sin(n·ωt + φₙ)',
  },
  {
    id: 'fibonacci',
    label: 'Fibonacci',
    principle: 'Recursive growth Fₙ = Fₙ₋₁ + Fₙ₋₂ & Pisano mod-12 cycles',
    musicalEffect: 'Modulator ratio tracks Fₙ₊₁/Fₙ with downbeat FM swells',
    visualEffect: 'Phyllotaxis golden-angle spiral (137.5°) & 3/5/8-lobe petals',
    equation: 'Fₙ = Fₙ₋₁ + Fₙ₋₂ · θₖ = k·(2π/φ²)',
  },
  {
    id: 'golden-ratio',
    label: 'Golden Ratio φ',
    principle: 'Irrational φ = (1+√5)/2 ≈ 1.61803 avoiding rational resonance',
    musicalEffect: 'Inharmonic bell/chime FM partials at φ & φ² ratios',
    visualEffect: 'Quasi-periodic φ-precessing rosettes & logarithmic spiral',
    equation: 'ωₓ/ωᵧ = φ ≈ 1.6180 · r(θ) = r₀·φ^(2θ/π)',
  },
  {
    id: 'pythagorean',
    label: 'Pythagorean',
    principle: 'Whole-number monochord fractions 3ᵏ/2ᵐ ∈ ℚ (2:1, 3:2, 4:3)',
    musicalEffect: 'Locks FM ratios to pure zero-beat integer/fifth intervals',
    visualEffect: 'Exact closed rational p:q knots with maximal axis symmetry',
    equation: 'f₂/f₁ = 3ᵏ/2ᵐ · ωₓ:ωᵧ = p:q ∈ ℕ',
  },
];

export function getMathFoundationSpec(id: MathFoundationId = 'harmonic-sine'): MathFoundationSpec {
  return MATH_FOUNDATIONS.find((f) => f.id === id) ?? MATH_FOUNDATIONS[0];
}

export function fibonacciNumber(n: number): number {
  const safeN = Math.max(0, Math.min(30, Math.floor(n)));
  if (safeN <= 1) return safeN;
  let a = 0;
  let b = 1;
  for (let i = 2; i <= safeN; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

const PYTHAGOREAN_MOD_RATIOS = [0.5, 1, 1.3333, 1.5, 2, 3, 4, 6];

function snapPythagoreanRatio(ratio: number): number {
  let best = 2;
  let bestDist = Infinity;
  for (const r of PYTHAGOREAN_MOD_RATIOS) {
    const d = Math.abs(ratio - r);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

/**
 * Maps the active mathematical foundation + spreadsheet row parameters
 * into acoustically clamped FM synthesizer modulation parameters.
 */
export function mapMathToSynthParams(
  step: EvaluatedRowStep,
  foundation: MathFoundationId = 'harmonic-sine',
  imperfection = 0,
): FoundationSynthParams {
  const rowIdx = Math.max(0, step.row - 1);
  const delta = Math.max(0, Math.min(1, Number.isFinite(imperfection) ? imperfection : 0));
  const baseFm = clampFmIndex(step.fmIndex);
  const baseRatio = clampModRatio(step.modRatio);
  const baseDecay = clampDecayMs(step.decayMs);

  const organicDrift = delta * Math.sin((rowIdx + 1) * GOLDEN_ANGLE_RAD);
  const organicCos = delta * Math.cos((rowIdx + 1) * PHI);

  const applyImperfection = (params: FoundationSynthParams): FoundationSynthParams => {
    if (delta <= 0.001) return params;
    return {
      effectiveFmIndex: clampFmIndex(params.effectiveFmIndex * (1 + organicCos * 0.28)),
      effectiveModRatio: clampModRatio(params.effectiveModRatio * (1 + organicDrift * 0.14)),
      effectiveDecayMs: clampDecayMs(params.effectiveDecayMs * (1 + organicDrift * 0.18)),
      detuneCents: params.detuneCents + organicDrift * 18,
      filterScale: Math.max(0.65, params.filterScale * (1 + organicCos * 0.22)),
    };
  };

  if (foundation === 'fibonacci') {
    const fCurr = fibonacciNumber((rowIdx % 9) + 2); // 1, 2, 3, 5, 8, 13, 21, 34, 55
    const fNext = fibonacciNumber((rowIdx % 9) + 3);
    const fibRatio = fNext / Math.max(1, fCurr); // converges onto PHI: 2, 1.5, 1.667, 1.6...
    const pisanoAccent = (fCurr % 5) / 4; // 0..1 rhythmic pulse
    return applyImperfection({
      effectiveFmIndex: clampFmIndex(baseFm * (0.85 + pisanoAccent * 0.6)),
      effectiveModRatio: clampModRatio(baseRatio * 0.45 + fibRatio * 0.85),
      effectiveDecayMs: clampDecayMs(baseDecay * (0.94 + pisanoAccent * 0.2)),
      detuneCents: ((fCurr % 7) - 3) * 1.4,
      filterScale: 0.95 + pisanoAccent * 0.25,
    });
  }

  if (foundation === 'golden-ratio') {
    const phiMode = rowIdx % 3 === 0 ? PHI * 2 : rowIdx % 2 === 0 ? PHI : 1 + INV_PHI;
    return applyImperfection({
      effectiveFmIndex: clampFmIndex(baseFm * 1.32 + 0.55),
      effectiveModRatio: clampModRatio(baseRatio * 0.3 + phiMode * 0.85),
      effectiveDecayMs: clampDecayMs(baseDecay * 1.15),
      detuneCents: 6.5,
      filterScale: 1.18,
    });
  }

  if (foundation === 'pythagorean') {
    const pureRatio = snapPythagoreanRatio(baseRatio);
    return applyImperfection({
      effectiveFmIndex: clampFmIndex(baseFm * 0.82),
      effectiveModRatio: clampModRatio(pureRatio),
      effectiveDecayMs: clampDecayMs(baseDecay * 0.96),
      detuneCents: 0,
      filterScale: 0.92,
    });
  }

  // harmonic-sine (Fourier periodic wave modulation)
  const sineMod = 1 + 0.16 * Math.sin((rowIdx / 8) * Math.PI * 2);
  return applyImperfection({
    effectiveFmIndex: clampFmIndex(baseFm * sineMod),
    effectiveModRatio: clampModRatio(baseRatio),
    effectiveDecayMs: clampDecayMs(baseDecay),
    detuneCents: 2,
    filterScale: 1.0,
  });
}

/**
 * Maps the active mathematical foundation + instantaneous curve step
 * into geometric parameters for the SVG parametric vector plotter.
 */
export function mapMathToArtParams(
  step: EvaluatedRowStep,
  u: number,
  sampleIdx: number,
  foundation: MathFoundationId = 'harmonic-sine',
  imperfection = 0,
): FoundationArtParams {
  const rowIdx = Math.max(0, step.row - 1);
  const delta = Math.max(0, Math.min(1, Number.isFinite(imperfection) ? imperfection : 0));

  const applyArtImperfection = (base: FoundationArtParams): FoundationArtParams => {
    if (delta <= 0.001) return base;
    const ripple = Math.sin(u * Math.PI * 5 * PHI + sampleIdx * 0.07);
    const twist = u * GOLDEN_ANGLE_RAD * delta * 1.65;
    return {
      ...base,
      freqMultiplierX: base.freqMultiplierX * (1 + delta * 0.09 * Math.cos(u * PHI * 4)),
      phaseOffsetRad: base.phaseOffsetRad + ripple * delta * 0.65,
      spiralTwistRad: base.spiralTwistRad + twist,
      radialScale: base.radialScale * (1 + ripple * delta * 0.16),
    };
  };

  if (foundation === 'fibonacci') {
    const fCurr = fibonacciNumber((rowIdx % 7) + 3); // 2, 3, 5, 8, 13, 21, 34
    const fPrev = fibonacciNumber((rowIdx % 7) + 2);
    const fibGrowth = fCurr / Math.max(1, fPrev);
    const petalOrder = [3, 5, 8, 13][rowIdx % 4];
    return applyArtImperfection({
      freqMultiplierX: fibGrowth * 0.72,
      freqMultiplierY: 1,
      phaseOffsetRad: Math.sin(u * Math.PI * 3) * 0.28,
      spiralTwistRad: u * GOLDEN_ANGLE_RAD * 2.2,
      radialScale: 0.84 + 0.24 * Math.sqrt(Math.max(0.05, u)),
      petalOrder,
      secondaryScale: INV_PHI + 0.08 * Math.sin(sampleIdx * 0.1),
    });
  }

  if (foundation === 'golden-ratio') {
    return applyArtImperfection({
      freqMultiplierX: PHI,
      freqMultiplierY: 1,
      phaseOffsetRad: u * Math.PI * PHI,
      spiralTwistRad: u * Math.PI * 2 * INV_PHI,
      radialScale: 0.78 + 0.28 * Math.pow(PHI, (u - 0.5) * 0.85),
      petalOrder: 5,
      secondaryScale: INV_PHI,
    });
  }

  if (foundation === 'pythagorean') {
    return applyArtImperfection({
      freqMultiplierX: 1,
      freqMultiplierY: 1,
      phaseOffsetRad: 0,
      spiralTwistRad: 0,
      radialScale: 1.0,
      petalOrder: 3,
      secondaryScale: 0.75,
    });
  }

  // harmonic-sine
  return applyArtImperfection({
    freqMultiplierX: 1 + 0.06 * Math.sin(u * Math.PI * 2),
    freqMultiplierY: 1,
    phaseOffsetRad: 0.22 * Math.cos(u * Math.PI * 4),
    spiralTwistRad: 0,
    radialScale: 0.96 + 0.08 * Math.sin(u * Math.PI * 4),
    petalOrder: 4,
    secondaryScale: 0.68,
  });
}

/**
 * Maps active mathematical foundation and spreadsheet steps to 3D harmonic sculpture
 * geometry parameters, dynamically scaling vertex count and orbit radius for
 * Fibonacci and Golden Ratio modes, modulated by controlled organic imperfection (δ).
 */
export function mapMathToSculpture3DParams(
  steps: EvaluatedRowStep[],
  foundation: MathFoundationId = 'harmonic-sine',
  isSoftwareGl = false,
  imperfection = 0,
): Sculpture3DParams {
  const count = Math.max(1, steps.length);
  const delta = Math.max(0, Math.min(1, Number.isFinite(imperfection) ? imperfection : 0));
  let sumOrbit = 0;
  let sumFm = 0;
  for (let i = 0; i < steps.length; i++) {
    sumOrbit += steps[i]?.orbitX ?? 50;
    sumFm += steps[i]?.fmIndex ?? 2;
  }
  const avgOrbit = steps.length > 0 ? sumOrbit / steps.length : 50;
  const avgFm = steps.length > 0 ? sumFm / steps.length : 2;
  const orbitNorm = Math.max(0.45, Math.min(1.8, avgOrbit / 50));
  const fmNorm = Math.max(0.25, Math.min(2.0, avgFm / 4));

  const baseVertices = isSoftwareGl ? 68 : 120;
  const organicWave = (t: number) =>
    delta <= 0.001 ? 1 : 1 + Math.sin(t * Math.PI * 5 * PHI + GOLDEN_ANGLE_RAD) * delta * 0.16;

  if (foundation === 'fibonacci') {
    const fibTier = count > 24 ? fibonacciNumber(13) : count > 12 ? fibonacciNumber(12) + fibonacciNumber(9) : fibonacciNumber(12); // 233, 178, 144
    const vertexCount = isSoftwareGl
      ? Math.max(72, Math.round(fibTier * INV_PHI))
      : fibTier;
    const fibIndex = 6 + (count % 4);
    const fibGrowth = fibonacciNumber(fibIndex + 1) / Math.max(1, fibonacciNumber(fibIndex));
    const orbitRadiusScale = Number((0.78 * fibGrowth * (0.82 + 0.18 * orbitNorm)).toFixed(4));
    const coronaRadiusScale = Number((1.12 + 0.1 * orbitNorm).toFixed(4));
    const lobeOrder = count > 16 ? 8 : 5;

    return {
      vertexCount,
      tubularSegments: Math.min(256, Math.max(84, vertexCount)),
      orbitRadiusScale,
      coronaRadiusScale,
      lobeOrder,
      angularTwist: GOLDEN_ANGLE_RAD + delta * 0.75,
      sampleOrbitScaleAt: (t: number, step?: EvaluatedRowStep) => {
        const clampedT = Math.max(0, Math.min(1, t));
        const rowOrbitFactor = step ? 0.92 + Math.max(10, Math.min(100, step.orbitX)) / 500 : 1;
        const phyllotaxisSpread = Math.sqrt(0.42 + clampedT * fibGrowth * 0.58);
        return orbitRadiusScale * phyllotaxisSpread * rowOrbitFactor * organicWave(clampedT);
      },
    };
  }

  if (foundation === 'golden-ratio') {
    const complexityBoost = 0.94 + 0.12 * Math.min(1, fmNorm * 0.65);
    const vertexCount = Math.min(256, Math.max(88, Math.round(baseVertices * PHI * complexityBoost)));
    const orbitRadiusScale = Number((PHI * (0.76 + 0.16 * orbitNorm)).toFixed(4));
    const coronaRadiusScale = Number((PHI * 0.78 + 0.06 * orbitNorm).toFixed(4));

    return {
      vertexCount,
      tubularSegments: Math.min(256, Math.max(88, vertexCount)),
      orbitRadiusScale,
      coronaRadiusScale,
      lobeOrder: 5,
      angularTwist: Math.PI * 2 * INV_PHI + delta * 0.85,
      sampleOrbitScaleAt: (t: number, step?: EvaluatedRowStep) => {
        const clampedT = Math.max(0, Math.min(1, t));
        const rowOrbitFactor = step ? 0.9 + Math.max(10, Math.min(100, step.orbitX)) / 480 : 1;
        const phiSpiral = Math.pow(PHI, (clampedT - 0.35) * 0.62);
        return orbitRadiusScale * phiSpiral * rowOrbitFactor * organicWave(clampedT);
      },
    };
  }

  if (foundation === 'pythagorean') {
    const vertexCount = isSoftwareGl ? 60 : 108;
    const orbitRadiusScale = Number((0.92 + 0.1 * orbitNorm).toFixed(4));
    return {
      vertexCount,
      tubularSegments: isSoftwareGl ? 72 : 120,
      orbitRadiusScale,
      coronaRadiusScale: 0.98,
      lobeOrder: 3,
      angularTwist: delta * 1.15,
      sampleOrbitScaleAt: (t: number) =>
        orbitRadiusScale * (0.96 + 0.05 * Math.cos(t * Math.PI * 6)) * organicWave(t),
    };
  }

  // harmonic-sine
  const orbitRadiusScale = Number((0.96 + 0.1 * orbitNorm).toFixed(4));
  return {
    vertexCount: baseVertices,
    tubularSegments: isSoftwareGl ? 80 : 144,
    orbitRadiusScale,
    coronaRadiusScale: 1.0,
    lobeOrder: 6,
    angularTwist: delta * 1.1,
    sampleOrbitScaleAt: (t: number) =>
      orbitRadiusScale * (0.95 + 0.07 * Math.sin(t * Math.PI * 4)) * organicWave(t),
  };
}

/**
 * Generates an 8-step or 12-step formula spreadsheet grid directly
 * embodying a mathematical principle when the user wants a pure demo patch.
 */
export function buildFoundationFormulaPatch(
  foundation: MathFoundationId,
  rootHz = 261.63,
): { grid: SheetRawGrid; rowCount: number; title: string } {
  const grid: SheetRawGrid = { A1: String(rootHz) };

  if (foundation === 'fibonacci') {
    const fibSemis = [0, 1, 2, 3, 5, 8, 13, 12];
    fibSemis.forEach((semi, idx) => {
      const r = idx + 1;
      if (r > 1) grid[`A${r}`] = `=A1*POW(2,${semi}/12)`;
      grid[`B${r}`] = '0.92';
      grid[`C${r}`] = `=${(1.4 + (idx % 5) * 0.45).toFixed(2)}`;
      grid[`D${r}`] = `=ROUND(50+SIN(ROW()*${INV_PHI.toFixed(3)})*38,0)`;
      grid[`E${r}`] = String(240 + (idx % 4) * 70);
      grid[`F${r}`] = idx % 2 === 0 ? '1.5' : '2.5';
    });
    return { grid, rowCount: 8, title: 'Fibonacci Interval Series' };
  }

  if (foundation === 'golden-ratio') {
    for (let r = 1; r <= 8; r++) {
      if (r > 1) grid[`A${r}`] = `=A1*POW(2,ROUND(MOD(ROW()*${PHI.toFixed(4)},12),0)/12)`;
      grid[`B${r}`] = r % 4 === 0 ? '0.7' : '0.95';
      grid[`C${r}`] = `=${(1.6 + (r % 3) * 0.8).toFixed(2)}`;
      grid[`D${r}`] = `=ROUND(52+COS(ROW()*${PHI.toFixed(3)})*40,0)`;
      grid[`E${r}`] = '340';
      grid[`F${r}`] = String(PHI.toFixed(3));
    }
    return { grid, rowCount: 8, title: 'Golden Ratio φ Chimes' };
  }

  if (foundation === 'pythagorean') {
    const ratios = ['1', '9/8', '81/64', '4/3', '3/2', '27/16', '243/128', '2'];
    ratios.forEach((ratioExpr, idx) => {
      const r = idx + 1;
      if (r > 1) grid[`A${r}`] = `=A1*(${ratioExpr})`;
      grid[`B${r}`] = '0.95';
      grid[`C${r}`] = '1.8';
      grid[`D${r}`] = `=${35 + idx * 8}`;
      grid[`E${r}`] = '320';
      grid[`F${r}`] = idx % 2 === 0 ? '1.5' : '2';
    });
    return { grid, rowCount: 8, title: 'Pythagorean Pure 3/2 Scale' };
  }

  for (let r = 1; r <= 8; r++) {
    if (r > 1) grid[`A${r}`] = `=A1*(1+0.5*ABS(SIN(ROW()*PI()/4)))`;
    grid[`B${r}`] = '0.9';
    grid[`C${r}`] = `=1.5+ABS(SIN(ROW()*0.785))*2.0`;
    grid[`D${r}`] = `=50+SIN(ROW()*0.785)*38`;
    grid[`E${r}`] = '280';
    grid[`F${r}`] = '2';
  }
  return { grid, rowCount: 8, title: 'Harmonic Sine Wave' };
}

export type FormulaHintKind = 'function' | 'constant';

export interface FormulaMathHint {
  name: string;
  aliases?: string[];
  kind: FormulaHintKind;
  signature: string;
  insertText: string;
  cursorBackOffset: number;
  source: 'mathArtTheory' | 'spreadsheetVm';
  foundationAffinity?: MathFoundationId;
  summary: string;
  example: string;
}

export const FORMULA_MATH_HINTS: FormulaMathHint[] = [
  {
    name: 'FIB',
    aliases: ['FIBONACCI'],
    kind: 'function',
    signature: 'FIB(n)',
    insertText: 'FIB()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    foundationAffinity: 'fibonacci',
    summary: 'Fibonacci number F_n (0 <= n <= 30) from mathArtTheory.ts',
    example: '=A1*(1+MOD(FIB(ROW()),12)/12)',
  },
  {
    name: 'PHI',
    kind: 'constant',
    signature: 'PHI',
    insertText: 'PHI',
    cursorBackOffset: 0,
    source: 'mathArtTheory',
    foundationAffinity: 'golden-ratio',
    summary: 'Golden ratio constant φ = (1+√5)/2 ≈ 1.618034',
    example: '=ROUND(50+COS(ROW()*PHI)*38,0)',
  },
  {
    name: 'INV_PHI',
    kind: 'constant',
    signature: 'INV_PHI',
    insertText: 'INV_PHI',
    cursorBackOffset: 0,
    source: 'mathArtTheory',
    foundationAffinity: 'golden-ratio',
    summary: 'Reciprocal golden ratio 1/φ ≈ 0.618034',
    example: '=ROUND(50+SIN(ROW()*INV_PHI)*38,0)',
  },
  {
    name: 'GOLDEN_ANGLE',
    aliases: ['GOLDEN_ANGLE_RAD'],
    kind: 'constant',
    signature: 'GOLDEN_ANGLE',
    insertText: 'GOLDEN_ANGLE',
    cursorBackOffset: 0,
    source: 'mathArtTheory',
    foundationAffinity: 'fibonacci',
    summary: 'Phyllotaxis golden angle 2π/φ² ≈ 2.39996 rad (137.5°)',
    example: '=50+SIN(ROW()*GOLDEN_ANGLE)*36',
  },
  {
    name: 'PERTURB',
    aliases: ['WARP'],
    kind: 'function',
    signature: 'PERTURB(val, amt)',
    insertText: 'PERTURB()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    foundationAffinity: 'golden-ratio',
    summary: 'Golden-angle organic imperfection drift (val ± amt)',
    example: '=PERTURB(A1*POW(2,5/12),0.15)',
  },
  {
    name: 'SIN',
    kind: 'function',
    signature: 'SIN(rad)',
    insertText: 'SIN()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    foundationAffinity: 'harmonic-sine',
    summary: 'Sine wave modulator [-1, 1] for harmonic curves & LFOs',
    example: '=50+SIN(ROW()*PI()/4)*38',
  },
  {
    name: 'COS',
    kind: 'function',
    signature: 'COS(rad)',
    insertText: 'COS()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    foundationAffinity: 'harmonic-sine',
    summary: 'Cosine phase modulator [-1, 1] for orthogonal symmetry',
    example: '=50+COS(ROW()*PHI)*40',
  },
  {
    name: 'POW',
    kind: 'function',
    signature: 'POW(base, exp)',
    insertText: 'POW()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    foundationAffinity: 'pythagorean',
    summary: 'Exponentiation; e.g. POW(2, semis/12) for musical intervals',
    example: '=A1*POW(2,5/12)',
  },
  {
    name: 'MOD',
    kind: 'function',
    signature: 'MOD(a, b)',
    insertText: 'MOD()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    foundationAffinity: 'fibonacci',
    summary: 'Positive modulo remainder for Pisano & Euclidean rhythms',
    example: '=IF(MOD(ROW(),2)=0,0.9,0)',
  },
  {
    name: 'PI',
    kind: 'constant',
    signature: 'PI',
    insertText: 'PI',
    cursorBackOffset: 0,
    source: 'mathArtTheory',
    foundationAffinity: 'harmonic-sine',
    summary: 'Circle constant π ≈ 3.141593 radians',
    example: '=A1*(1+0.5*ABS(SIN(ROW()*PI/4)))',
  },
  {
    name: 'ROUND',
    kind: 'function',
    signature: 'ROUND(x)',
    insertText: 'ROUND()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    summary: 'Round numeric expression to nearest integer',
    example: '=ROUND(50+SIN(ROW()*INV_PHI)*38,0)',
  },
  {
    name: 'ABS',
    kind: 'function',
    signature: 'ABS(x)',
    insertText: 'ABS()',
    cursorBackOffset: 1,
    source: 'mathArtTheory',
    summary: 'Absolute value magnitude (rectifies bipolar waves)',
    example: '=1.5+ABS(SIN(ROW()*0.785))*2',
  },
  {
    name: 'ROW',
    kind: 'function',
    signature: 'ROW()',
    insertText: 'ROW()',
    cursorBackOffset: 0,
    source: 'mathArtTheory',
    summary: 'Current 1-based step index (1..48)',
    example: '=A1*POW(2,(ROW()-1)/12)',
  },
  {
    name: 'COL',
    kind: 'function',
    signature: 'COL()',
    insertText: 'COL()',
    cursorBackOffset: 0,
    source: 'spreadsheetVm',
    summary: 'Current 1-based column index (A=1 .. F=6)',
    example: '=COL()*110',
  },
  {
    name: 'IF',
    kind: 'function',
    signature: 'IF(cond, thenVal, elseVal)',
    insertText: 'IF()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Conditional branch (nonzero cond selects thenVal)',
    example: '=IF(MOD(ROW(),4)=1,1,0.4)',
  },
  {
    name: 'SQRT',
    kind: 'function',
    signature: 'SQRT(x)',
    insertText: 'SQRT()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Square root of clamped non-negative value',
    example: '=40+SQRT(ROW())*15',
  },
  {
    name: 'FLOOR',
    kind: 'function',
    signature: 'FLOOR(x)',
    insertText: 'FLOOR()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Round down to largest integer <= x',
    example: '=FLOOR(ROW()/2)*110',
  },
  {
    name: 'CEIL',
    kind: 'function',
    signature: 'CEIL(x)',
    insertText: 'CEIL()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Round up to smallest integer >= x',
    example: '=CEIL(ROW()/2)',
  },
  {
    name: 'SUM',
    kind: 'function',
    signature: 'SUM(range_or_args)',
    insertText: 'SUM()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Sum of cell range or comma-separated arguments',
    example: '=SUM(A1:A4)/4',
  },
  {
    name: 'AVG',
    kind: 'function',
    signature: 'AVG(range_or_args)',
    insertText: 'AVG()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Arithmetic mean of range or arguments',
    example: '=AVG(A1:A4)',
  },
  {
    name: 'MIN',
    kind: 'function',
    signature: 'MIN(range_or_args)',
    insertText: 'MIN()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Minimum value across range or arguments',
    example: '=MIN(A1:A8)',
  },
  {
    name: 'MAX',
    kind: 'function',
    signature: 'MAX(range_or_args)',
    insertText: 'MAX()',
    cursorBackOffset: 1,
    source: 'spreadsheetVm',
    summary: 'Maximum value across range or arguments',
    example: '=MAX(A1:A8)',
  },
];

const HINT_BY_UPPER_NAME = new Map<string, FormulaMathHint>();
for (const hint of FORMULA_MATH_HINTS) {
  HINT_BY_UPPER_NAME.set(hint.name.toUpperCase(), hint);
  for (const alias of hint.aliases ?? []) {
    HINT_BY_UPPER_NAME.set(alias.toUpperCase(), hint);
  }
}

export function findFormulaHintByName(name: string): FormulaMathHint | undefined {
  return HINT_BY_UPPER_NAME.get(name.trim().toUpperCase());
}

export function getFormulaHints(
  query: string,
  foundation: MathFoundationId = 'harmonic-sine',
): FormulaMathHint[] {
  const q = query.trim().toUpperCase();
  const scored = FORMULA_MATH_HINTS.map((hint, idx) => {
    const names = [hint.name, ...(hint.aliases ?? [])];
    let matchScore = 0;

    if (!q) {
      matchScore = 10;
    } else if (names.some((n) => n === q)) {
      matchScore = 100;
    } else if (names.some((n) => n.startsWith(q))) {
      matchScore = 70;
    } else if (names.some((n) => n.includes(q))) {
      matchScore = 40;
    } else if (hint.summary.toUpperCase().includes(q)) {
      matchScore = 15;
    }

    if (matchScore === 0) return null;

    const affinityBoost = hint.foundationAffinity === foundation ? 12 : 0;
    const theoryBoost = hint.source === 'mathArtTheory' ? 4 : 0;
    return { hint, score: matchScore + affinityBoost + theoryBoost, idx };
  }).filter((item): item is { hint: FormulaMathHint; score: number; idx: number } => item !== null);

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((item) => item.hint);
}

// ============================================================================
// COMPLEXITY ENGINE: FORMULA-TO-VERTEX HARMONY SCORE & SYMMETRY ADVISOR
// ============================================================================

export type SymmetrySuggestionCategory =
  | 'error-recovery'
  | 'formula-density'
  | 'vertex-balance'
  | 'algebraic-depth'
  | 'ratio-consonance'
  | 'organic-drift';

export interface SymmetrySuggestion {
  id: string;
  category: SymmetrySuggestionCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  actionLabel?: string;
  recommendedFormula?: string;
  recommendedCol?: SheetCol;
}

export interface ComplexityAnalysisInput {
  grid: SheetRawGrid;
  evaluation: SheetEvaluationResult;
  artMode?: ArtModeId;
  foundation?: MathFoundationId;
  imperfection?: number;
  rowCount?: number;
  visualVertexCountOverride?: number;
}

export interface ComplexityHarmonyReport {
  harmonyScore: number; // 0..100 overall Art-Math Harmony Score
  grade: 'Transcendent' | 'Resonant' | 'Balanced' | 'Developing' | 'Sparse';
  formulaCount: number;
  dynamicFormulaCount: number;
  totalActiveCells: number;
  visualVertexCount: number;
  stepNodeCount: number;
  formulaToVertexRatio: number; // formulaCount / visualVertexCount
  formulasPerStep: number;
  leverageScore: number; // 0..100 score from formula-to-vertex generative efficiency
  symmetryBalance: number; // 0..100 pitch-ratio & polar centroid balance
  columnCoverageScore: number; // 0..100 how well Pitch/FM/Orbit/Decay dimensions are algebraically coupled
  suggestions: SymmetrySuggestion[];
}

const COMPLEXITY_DYNAMIC_FN_RE =
  /\b(SIN|COS|FIB|FIBONACCI|PHI|INV_PHI|GOLDEN_ANGLE|POW|MOD|PERTURB|WARP|IF|SQRT)\b/i;

const CLEAN_SIMPLE_RATIOS = [1, 1.125, 1.2, 1.25, 1.3333, 1.5, 1.6, 1.6667, 1.875, 2];

function evaluateRatioClarity(steps: EvaluatedRowStep[]): {
  consonanceAvg: number;
  phaseBalance: number;
} {
  const active = steps.filter((s) => s.gate > 0.02 && !s.hasError);
  if (active.length === 0) {
    return { consonanceAvg: 0.4, phaseBalance: 0.4 };
  }
  const rootHz = Math.max(20, active[0].freqHz || 261.63);
  let consonanceSum = 0;
  let sumCos = 0;
  let sumSin = 0;

  for (const s of active) {
    const ratio = Math.max(0.1, s.freqHz / rootHz);
    const oct = Math.floor(Math.log2(ratio));
    const folded = ratio / Math.pow(2, oct);

    let minCents = Infinity;
    for (const target of CLEAN_SIMPLE_RATIOS) {
      const cents = Math.abs(1200 * Math.log2(folded / target));
      if (cents < minCents) minCents = cents;
    }
    const clarity = Math.max(0.25, Math.min(1, 1 - minCents / 95));
    consonanceSum += clarity;

    const frac = ((Math.log2(ratio) % 1) + 1) % 1;
    const rad = frac * Math.PI * 2;
    sumCos += Math.cos(rad);
    sumSin += Math.sin(rad);
  }

  const n = active.length;
  const consonanceAvg = consonanceSum / n;
  const centroidDist = Math.hypot(sumCos / n, sumSin / n);
  // Balance rewards multiple distinct pitches distributed around the pitch circle without collapsing to 1 point
  const distinctAngles = new Set(
    active.map((s) => Math.round((((Math.log2(Math.max(0.1, s.freqHz / rootHz)) % 1) + 1) % 1) * 12)),
  ).size;
  const diversityFactor = Math.min(1, distinctAngles / Math.min(4, Math.max(2, n)));
  const phaseBalance = Math.max(0.2, Math.min(1, (1 - centroidDist * 0.65) * 0.6 + diversityFactor * 0.4));

  return { consonanceAvg, phaseBalance };
}

export const ComplexityEngine = {
  computeFormulaToVertexRatio(formulaCount: number, visualVertexCount: number): number {
    const safeVertices = Math.max(1, visualVertexCount);
    return Math.round((Math.max(0, formulaCount) / safeVertices) * 10000) / 10000;
  },

  computeHarmonyScore(params: {
    formulaCount: number;
    dynamicFormulaCount: number;
    visualVertexCount: number;
    symmetryBalance: number;
    columnCoverageScore: number;
    errorCount: number;
  }): {
    harmonyScore: number;
    leverageScore: number;
    formulaToVertexRatio: number;
  } {
    const formulaToVertexRatio = ComplexityEngine.computeFormulaToVertexRatio(
      params.formulaCount,
      params.visualVertexCount,
    );

    // Generative leverage curves cleanly around ideal band [0.08 .. 0.34] formulas per 3D vertex
    // (where 1 compact formula drives ~3 to ~12 geometric manifold vertices)
    let leverageScore = 0;
    if (params.formulaCount <= 0) {
      leverageScore = 12;
    } else if (formulaToVertexRatio < 0.08) {
      leverageScore = 24 + (formulaToVertexRatio / 0.08) * 58;
    } else if (formulaToVertexRatio <= 0.34) {
      const dynamicBonus = Math.min(
        14,
        (params.dynamicFormulaCount / Math.max(1, params.formulaCount)) * 14,
      );
      leverageScore = 84 + dynamicBonus;
    } else {
      // Beyond 0.34 formulas/vertex means dense per-cell overrides; still productive, softly tapers
      const excess = Math.min(0.6, formulaToVertexRatio - 0.34);
      leverageScore = Math.max(62, 95 - excess * 42);
    }

    const rawHarmony =
      leverageScore * 0.36 +
      params.symmetryBalance * 0.38 +
      params.columnCoverageScore * 0.26 -
      params.errorCount * 15;

    return {
      harmonyScore: Math.round(Math.max(0, Math.min(100, rawHarmony))),
      leverageScore: Math.round(Math.max(0, Math.min(100, leverageScore))),
      formulaToVertexRatio,
    };
  },

  analyze(input: ComplexityAnalysisInput): ComplexityHarmonyReport {
    const artMode: ArtModeId = input.artMode ?? 'harmonograph';
    const foundation: MathFoundationId = input.foundation ?? 'harmonic-sine';
    const imperfection = Math.max(0, Math.min(1, input.imperfection ?? 0));
    const steps = input.evaluation.steps ?? [];
    const rowCount = Math.max(1, Math.min(48, input.rowCount ?? (steps.length || 8)));
    const totalActiveCells = rowCount * SHEET_COLS.length;

    const sculpture3D = mapMathToSculpture3DParams(steps, foundation, false, imperfection);
    const visualVertexCount = Math.max(
      1,
      input.visualVertexCountOverride ?? sculpture3D.vertexCount,
    );
    const stepNodeCount = steps.slice(0, rowCount).filter((s) => s.gate > 0.02 && !s.hasError).length;

    let formulaCount = 0;
    let dynamicFormulaCount = 0;
    const colFormulaCounts: Record<SheetCol, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

    for (let r = 1; r <= rowCount; r++) {
      for (const col of SHEET_COLS) {
        const raw = (input.grid[`${col}${r}`] ?? '').trim();
        if (raw.startsWith('=')) {
          formulaCount++;
          colFormulaCounts[col]++;
          if (COMPLEXITY_DYNAMIC_FN_RE.test(raw)) {
            dynamicFormulaCount++;
          }
        }
      }
    }

    const coveredDims = SHEET_COLS.filter((c) => colFormulaCounts[c] > 0).length;
    const hasPitchFormula = colFormulaCounts.A > 0;
    const hasGeometryFormula = colFormulaCounts.D > 0 || colFormulaCounts.C > 0;
    const columnCoverageScore = Math.min(
      100,
      Math.round(
        (coveredDims / 4) * 58 +
          (hasPitchFormula ? 22 : 0) +
          (hasGeometryFormula ? 20 : 0),
      ),
    );

    const { consonanceAvg, phaseBalance } = evaluateRatioClarity(steps.slice(0, rowCount));
    // Foundation & imperfection contribution to geometric-acoustic alignment
    const foundationBonus =
      foundation === 'pythagorean'
        ? 0.08
        : foundation === 'harmonic-sine'
          ? 0.05
          : 0.04;
    const driftPenalty = imperfection > 0.4 ? (imperfection - 0.4) * 0.45 : 0;
    const symmetryBalance = Math.round(
      Math.max(
        10,
        Math.min(100, (consonanceAvg * 0.56 + phaseBalance * 0.44 + foundationBonus - driftPenalty) * 100),
      ),
    );

    const { harmonyScore, leverageScore, formulaToVertexRatio } =
      ComplexityEngine.computeHarmonyScore({
        formulaCount,
        dynamicFormulaCount,
        visualVertexCount,
        symmetryBalance,
        columnCoverageScore,
        errorCount: input.evaluation.errorCount,
      });

    const formulasPerStep =
      Math.round((formulaCount / Math.max(1, stepNodeCount || rowCount)) * 100) / 100;

    const grade: ComplexityHarmonyReport['grade'] =
      harmonyScore >= 88
        ? 'Transcendent'
        : harmonyScore >= 74
          ? 'Resonant'
          : harmonyScore >= 58
            ? 'Balanced'
            : harmonyScore >= 40
              ? 'Developing'
              : 'Sparse';

    const suggestions: SymmetrySuggestion[] = [];

    if (input.evaluation.errorCount > 0) {
      suggestions.push({
        id: 'sug-fix-errors',
        category: 'error-recovery',
        priority: 'high',
        title: `Resolve ${input.evaluation.errorCount} cell formula error(s)`,
        detail:
          'Formula errors clamp acoustic output and collapse coupled 3D vertices back to default circles.',
      });
    }

    if (colFormulaCounts.A === 0) {
      suggestions.push({
        id: 'sug-couple-pitch',
        category: 'formula-density',
        priority: 'high',
        title: 'Couple Pitch Column A to Root Cell A1',
        detail:
          'Your 3D manifold has ' +
          `${visualVertexCount} vertices, but Pitch Col A uses static numbers instead of =A1 ratios.`,
        actionLabel: 'Fill Col A Fifths',
        recommendedCol: 'A',
        recommendedFormula: '=A1*POW(2,MOD((ROW()-1)*7,12)/12)',
      });
    }

    if (formulaToVertexRatio < 0.075 && colFormulaCounts.D === 0) {
      suggestions.push({
        id: 'sug-couple-orbit',
        category: 'vertex-balance',
        priority: 'high',
        title: `Raise formula-to-vertex ratio (${formulaCount}:${visualVertexCount}) via Orbit Col D`,
        detail:
          'Add an algebraic radial wave in Column D so all ' +
          `${visualVertexCount} vertices expand symmetrically with every step.`,
        actionLabel: 'Fill Col D Wave',
        recommendedCol: 'D',
        recommendedFormula: '=ROUND(50+38*SIN(ROW()*PI/4))',
      });
    } else if (colFormulaCounts.C === 0 && colFormulaCounts.F === 0) {
      suggestions.push({
        id: 'sug-couple-fm',
        category: 'algebraic-depth',
        priority: 'medium',
        title: 'Link FM Brightness (Col C) to wave phase',
        detail:
          'Modulating FM Index algebraically aligns audio overtone shimmer directly with visual ribbon thickness.',
        actionLabel: 'Fill Col C FM',
        recommendedCol: 'C',
        recommendedFormula: '=1.4+2.4*ABS(SIN(ROW()*PI/4))',
      });
    }

    if (dynamicFormulaCount < 3 && formulaCount >= 2) {
      suggestions.push({
        id: 'sug-dynamic-math',
        category: 'algebraic-depth',
        priority: 'medium',
        title: 'Upgrade static expressions with FIB, PHI, or SIN functions',
        detail:
          'Only ' +
          `${dynamicFormulaCount}/${formulaCount} formulas use dynamic math functions; periodic or golden functions increase geometric richness.`,
        actionLabel: 'Fill Col D φ Orbit',
        recommendedCol: 'D',
        recommendedFormula: '=ROUND(52+36*COS(ROW()*GOLDEN_ANGLE))',
      });
    }

    if (symmetryBalance < 62) {
      suggestions.push({
        id: 'sug-improve-symmetry',
        category: 'ratio-consonance',
        priority: 'high',
        title: 'Align intervals to low-integer harmonic ratios',
        detail:
          `Current symmetry balance is ${symmetryBalance}%. Use whole-number fractions or Pythagorean 3:2 steps so wave crests close cleanly.`,
        actionLabel: 'Apply Pythagorean Triad',
        recommendedCol: 'A',
        recommendedFormula: '=A1*IF(MOD(ROW(),3)=1,1,IF(MOD(ROW(),3)=2,5/4,3/2))',
      });
    }

    if (imperfection > 0.55) {
      suggestions.push({
        id: 'sug-tame-drift',
        category: 'organic-drift',
        priority: 'medium',
        title: `Lower Organic Imperfection δ (${Math.round(imperfection * 100)}%) toward 15–30%`,
        detail:
          'High golden-angle drift is pulling vertices off nodal axes; moderate imperfection keeps living movement without breaking harmony.',
      });
    } else if (
      imperfection <= 0.02 &&
      (foundation === 'fibonacci' || foundation === 'golden-ratio') &&
      suggestions.length < 3
    ) {
      suggestions.push({
        id: 'sug-organic-breath',
        category: 'organic-drift',
        priority: 'low',
        title: 'Introduce ~14% Organic Imperfection (δ) for natural phyllotaxis flow',
        detail:
          'Pair Fibonacci/φ math with gentle organic drift or PERTURB() so rigid lines breathe like botanical spirals.',
        actionLabel: 'Perturb Col E',
        recommendedCol: 'E',
        recommendedFormula: '=ROUND(PERTURB(280+SIN(ROW()*INV_PHI)*80,0.2))',
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        id: 'sug-optimal-equilibrium',
        category: 'vertex-balance',
        priority: 'low',
        title: `Optimal Art-Math Equilibrium (${formulaCount} formulas → ${visualVertexCount} vertices)`,
        detail:
          'Your formula-to-vertex ratio and interval consonance are strongly coupled. Try switching 3D Form or exporting SVG/WAV.',
      });
    }

    return {
      harmonyScore,
      grade,
      formulaCount,
      dynamicFormulaCount,
      totalActiveCells,
      visualVertexCount,
      stepNodeCount,
      formulaToVertexRatio,
      formulasPerStep,
      leverageScore,
      symmetryBalance,
      columnCoverageScore,
      suggestions: suggestions.slice(0, 4),
    };
  },
};


