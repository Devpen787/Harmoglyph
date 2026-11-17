import {
  type ArtModeId,
  type EvaluatedRowStep,
  type MathFoundationId,
  type SheetRawGrid,
  type SynthVoiceId,
} from '../types/chimera.ts';
import {
  getMathFoundationSpec,
  mapMathToArtParams,
  mapMathToSynthParams,
} from './mathArtTheory.ts';

export interface VectorPoint {
  x: number;
  y: number;
  row: number;
  gate: number;
  noteName: string;
  freqHz: number;
  ratioLabel: string;
}

export interface IntervalRatioMatch {
  p: number;
  q: number;
  label: string;
  exactRatio: number;
  centsError: number;
  consonance: number; // 0..1 based on Euler gradus suavitatis / ratio simplicity
}

export interface StepSymmetryMetric extends IntervalRatioMatch {
  row: number;
  thetaDeg: number;
  octave: number;
}

export interface HarmonicSymmetryAnalysis {
  rootHz: number;
  dominantRatio: IntervalRatioMatch;
  symmetryIndex: number; // 0..100 combined harmonic ratio simplicity + pitch-circle balance
  phaseBalance: number; // 0..100 polar centroid symmetry
  symmetryClass: string;
  equationText: string;
  stepRatios: StepSymmetryMetric[];
}

export interface VectorArtwork {
  primaryPathD: string;
  secondaryPathD: string;
  haloPathD: string;
  vertices: VectorPoint[];
  symmetry: HarmonicSymmetryAnalysis;
}

export const ART_MODES: Array<{ id: ArtModeId; label: string }> = [
  { id: 'harmonograph', label: 'Harmonograph' },
  { id: 'pitch-spiral', label: 'Euler Pitch Spiral' },
  { id: 'mandala', label: 'Chladni Mandala' },
  { id: 'ribbon', label: 'FM Wave Ribbon' },
];

const JUST_INTERVALS: Array<{ p: number; q: number; label: string }> = [
  { p: 1, q: 1, label: 'Unison' },
  { p: 16, q: 15, label: 'Minor 2nd' },
  { p: 9, q: 8, label: 'Major 2nd' },
  { p: 6, q: 5, label: 'Minor 3rd' },
  { p: 5, q: 4, label: 'Major 3rd' },
  { p: 4, q: 3, label: 'Fourth' },
  { p: 45, q: 32, label: 'Tritone' },
  { p: 3, q: 2, label: 'Fifth' },
  { p: 8, q: 5, label: 'Minor 6th' },
  { p: 5, q: 3, label: 'Major 6th' },
  { p: 9, q: 5, label: 'Minor 7th' },
  { p: 15, q: 8, label: 'Major 7th' },
  { p: 2, q: 1, label: 'Octave' },
];

export function matchJustInterval(ratio: number): IntervalRatioMatch {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const octaves = Math.floor(Math.log2(safeRatio));
  const folded = safeRatio / Math.pow(2, octaves);

  let best = JUST_INTERVALS[0];
  let bestCents = Infinity;

  for (const candidate of JUST_INTERVALS) {
    const target = candidate.p / candidate.q;
    const cents = Math.abs(1200 * Math.log2(folded / target));
    if (cents < bestCents) {
      bestCents = cents;
      best = candidate;
    }
  }

  // If octave-folded near 2:1, reflect octave label cleanly
  const isOctaveMultiple = Math.abs(octaves) >= 1 && best.p === 1 && best.q === 1;
  const p = isOctaveMultiple ? 2 : best.p;
  const q = isOctaveMultiple ? 1 : best.q;
  const label = isOctaveMultiple ? 'Octave' : best.label;

  // Euler-inspired consonance: simple ratios (1:1, 2:1, 3:2, 4:3, 5:4) score high; 16:15 & 45:32 low
  const complexity = p + q - 1; // 1:1->1, 2:1->2, 3:2->4, 4:3->6, 5:4->8, 16:15->30, 45:32->76
  const ratioSimplicity = Math.max(0.08, 1 / (1 + Math.log2(Math.max(1, complexity))));
  const tuningClarity = Math.max(0.25, 1 - bestCents / 65);
  const consonance = Math.min(1, ratioSimplicity * 0.8 + tuningClarity * 0.2);

  return {
    p,
    q,
    label,
    exactRatio: safeRatio,
    centsError: Math.round(bestCents * 10) / 10,
    consonance,
  };
}

export function analyzeHarmonicSymmetry(
  steps: EvaluatedRowStep[],
  artMode: ArtModeId = 'harmonograph',
  foundation: MathFoundationId = 'harmonic-sine',
): HarmonicSymmetryAnalysis {
  const foundationSpec = getMathFoundationSpec(foundation);
  if (!steps.length) {
    return {
      rootHz: 261.63,
      dominantRatio: { p: 1, q: 1, label: 'Unison', exactRatio: 1, centsError: 0, consonance: 1 },
      symmetryIndex: 100,
      phaseBalance: 100,
      symmetryClass: 'Unison Reference',
      equationText: foundationSpec.equation,
      stepRatios: [],
    };
  }

  const firstActive = steps.find((s) => s.gate > 0.02 && !s.hasError) ?? steps[0];
  const rootHz = Math.max(20, firstActive.freqHz || 261.63);

  const stepRatios: StepSymmetryMetric[] = steps.map((s) => {
    const ratio = s.freqHz / rootHz;
    const match = matchJustInterval(ratio);
    const logVal = Math.log2(Math.max(0.05, ratio));
    const frac = ((logVal % 1) + 1) % 1;
    const thetaDeg = Math.round(frac * 360);
    return {
      ...match,
      row: s.row,
      thetaDeg,
      octave: Math.round(logVal * 100) / 100,
    };
  });

  const activeIndices = steps
    .map((s, idx) => (s.gate > 0.02 && !s.hasError ? idx : -1))
    .filter((idx) => idx >= 0);
  const activeMetrics = (activeIndices.length ? activeIndices : [0]).map((idx) => stepRatios[idx]);

  // Polar centroid balance around the chromatic pitch circle: sum of e^(i * 2π * log2(f/f0))
  let sumCos = 0;
  let sumSin = 0;
  let consonanceSum = 0;
  const ratioCounts = new Map<string, { count: number; match: IntervalRatioMatch }>();

  for (const m of activeMetrics) {
    const rad = (m.thetaDeg * Math.PI) / 180;
    sumCos += Math.cos(rad);
    sumSin += Math.sin(rad);
    consonanceSum += m.consonance;

    const key = `${m.p}:${m.q}`;
    const existing = ratioCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      ratioCounts.set(key, { count: 1, match: m });
    }
  }

  const n = Math.max(1, activeMetrics.length);
  const centroidMag = Math.hypot(sumCos / n, sumSin / n);
  const phaseBalance = Math.round(Math.max(0, Math.min(100, (1 - centroidMag * 0.85) * 100)));
  const avgConsonance = consonanceSum / n;

  // Prefer the most frequent non-1:1 interval as dominant harmonic generator if present
  const sortedRatios = Array.from(ratioCounts.values()).sort((a, b) => {
    const aNonUnison = a.match.p === 1 && a.match.q === 1 ? 0 : 1;
    const bNonUnison = b.match.p === 1 && b.match.q === 1 ? 0 : 1;
    if (aNonUnison !== bNonUnison) return bNonUnison - aNonUnison;
    return b.count - a.count;
  });
  const dominantRatio = sortedRatios[0]?.match ?? stepRatios[0];

  const symmetryIndex = Math.round(
    Math.max(8, Math.min(100, avgConsonance * 68 + (phaseBalance / 100) * 32)),
  );

  let symmetryClass = `${dominantRatio.p}:${dominantRatio.q} Harmonic Ratio`;
  if (dominantRatio.p === 1 && dominantRatio.q === 1) {
    symmetryClass = '1:1 Unison Circle';
  } else if (dominantRatio.p === 2 && dominantRatio.q === 1) {
    symmetryClass = '2:1 Octave Mirror';
  } else if (dominantRatio.p === 3 && dominantRatio.q === 2) {
    symmetryClass = '3:2 Fifth Lissajous';
  } else if (dominantRatio.p === 4 && dominantRatio.q === 3) {
    symmetryClass = '4:3 Fourth Rosette';
  } else if (dominantRatio.p === 5 && dominantRatio.q === 4) {
    symmetryClass = '5:4 Triadic Star';
  } else if (symmetryIndex < 48) {
    symmetryClass = 'Aperiodic / Dissonant Web';
  }

  const { p, q } = dominantRatio;
  let equationText = `x(t)=A·e^(-dt)·sin(${p}t+φ), y(t)=B·e^(-dt)·cos(${q}t)`;
  if (artMode === 'pitch-spiral') {
    equationText = `z(k) = r(fₖ)·e^(i·2π·log₂(fₖ/${rootHz.toFixed(1)}))`;
  } else if (artMode === 'mandala') {
    equationText = `r(θ) = R₀ + A·[cos(${p}θ+φ) − ½·cos(${q}θ)]`;
  } else if (artMode === 'ribbon') {
    equationText = `y(t) = A·sin(ω_c·t + I·sin((${p}/${q})·ω_c·t))`;
  }
  equationText = `${foundationSpec.label}: ${foundationSpec.equation} · ${equationText}`;

  return {
    rootHz,
    dominantRatio,
    symmetryIndex,
    phaseBalance,
    symmetryClass,
    equationText,
    stepRatios,
  };
}

export function computeVectorCurve(
  steps: EvaluatedRowStep[],
  artMode: ArtModeId = 'harmonograph',
  foundation: MathFoundationId = 'harmonic-sine',
  imperfection = 0,
): VectorArtwork {
  const symmetry = analyzeHarmonicSymmetry(steps, artMode, foundation);
  if (!steps.length) {
    return { primaryPathD: '', secondaryPathD: '', haloPathD: '', vertices: [], symmetry };
  }

  const cx = 220;
  const cy = 140;
  const primaryPts: Array<{ x: number; y: number }> = [];
  const secondaryPts: Array<{ x: number; y: number }> = [];
  const haloPts: Array<{ x: number; y: number }> = [];
  const subSamples = 280;

  const { rootHz, dominantRatio, stepRatios } = symmetry;
  const p = dominantRatio.p;
  const q = dominantRatio.q;

  // For harmonograph: integrate continuous angular phase using true step ratio f(u)/A1
  // scaled by the active mathematical foundation (Sine, Fibonacci, Golden Ratio φ, Pythagorean).
  let phaseX = 0;
  let phaseY = 0;
  const cycles = Math.max(2, Math.min(4, q <= 1 ? 2 : q));
  const dBase = (Math.PI * 2 * cycles) / subSamples;

  for (let i = 0; i <= subSamples; i++) {
    const u = i / subSamples;
    const stepFloat = u * (steps.length - 1);
    const idx = Math.floor(stepFloat);
    const nextIdx = Math.min(steps.length - 1, idx + 1);
    const frac = stepFloat - idx;
    const s1 = steps[idx];
    const s2 = steps[nextIdx];

    const mathArt = mapMathToArtParams(s1, u, i, foundation, imperfection);
    const fm1 = mapMathToSynthParams(s1, foundation, imperfection);
    const fm2 = mapMathToSynthParams(s2, foundation, imperfection);

    const freq = s1.freqHz * (1 - frac) + s2.freqHz * frac;
    const fm = fm1.effectiveFmIndex * (1 - frac) + fm2.effectiveFmIndex * frac;
    const orbit = s1.orbitX * (1 - frac) + s2.orbitX * frac;
    const ratio = fm1.effectiveModRatio * (1 - frac) + fm2.effectiveModRatio * frac;
    const gate = s1.gate * (1 - frac) + s2.gate * frac;
    const decay = fm1.effectiveDecayMs * (1 - frac) + fm2.effectiveDecayMs * frac;

    const theta = u * Math.PI * 2;
    const pitchRatio = Math.max(0.5, Math.min(4, freq / rootHz));
    const logPitch = Math.log2(Math.max(0.25, freq / rootHz));
    const normPitch = Math.min(1, Math.max(0, (logPitch + 1.2) / 3.2));

    if (artMode === 'pitch-spiral') {
      // Euler Complex Plane: z = r * e^(i * 2π * log2(f / rootHz)) + foundation twist
      const eulerAngle = logPitch * Math.PI * 2 - Math.PI / 2 + mathArt.spiralTwistRad * 0.25;
      const radial = (36 + normPitch * 68 + gate * 12) * mathArt.radialScale;
      const x = cx + Math.cos(eulerAngle) * radial;
      const y = cy + Math.sin(eulerAngle) * radial * 0.92;
      primaryPts.push({ x, y });

      const invAngle = -eulerAngle + (orbit / 100) * 0.35 + mathArt.phaseOffsetRad;
      const invR = radial * (mathArt.secondaryScale + 0.08 * Math.sin(theta * ratio));
      secondaryPts.push({
        x: cx + Math.cos(invAngle) * invR,
        y: cy + Math.sin(invAngle) * invR * 0.92,
      });

      const envR = radial + 10 + Math.sin(theta * Math.max(2, mathArt.petalOrder)) * (3 + fm * 1.4);
      haloPts.push({
        x: cx + Math.cos(eulerAngle) * envR,
        y: cy + Math.sin(eulerAngle) * envR * 0.92,
      });
    } else if (artMode === 'mandala') {
      // Chladni Nodal Standing-Wave Symmetry shaped by ratio p:q & mathematical foundation petals
      const nMode =
        foundation === 'fibonacci' || foundation === 'golden-ratio'
          ? mathArt.petalOrder
          : Math.max(2, Math.min(9, p));
      const mMode = Math.max(1, Math.min(8, q + Math.round(ratio) - 1));
      const orbitPhase = (orbit / 100) * Math.PI + mathArt.phaseOffsetRad;
      const chladni =
        Math.cos(theta * nMode + orbitPhase) - 0.55 * Math.cos(theta * mMode - fm * 0.25);
      const baseR = (54 + normPitch * 38 + chladni * (16 + gate * 18)) * mathArt.radialScale;
      const rotTheta = theta + mathArt.spiralTwistRad * 0.2;
      const x = cx + Math.cos(rotTheta) * baseR;
      const y = cy + Math.sin(rotTheta) * baseR * 0.9;
      primaryPts.push({ x, y });

      const secR = Math.max(18, baseR * mathArt.secondaryScale + Math.sin(theta * (nMode + mMode)) * 10);
      secondaryPts.push({
        x: cx + Math.cos(rotTheta + Math.PI / Math.max(2, nMode)) * secR,
        y: cy + Math.sin(rotTheta + Math.PI / Math.max(2, nMode)) * secR * 0.9,
      });

      const haloR = baseR + 12;
      haloPts.push({
        x: cx + Math.cos(rotTheta) * haloR,
        y: cy + Math.sin(rotTheta) * haloR * 0.9,
      });
    } else if (artMode === 'ribbon') {
      // FM Synthesis Wave Equation: carrier freq ratio modulated by active foundation
      const x = 22 + u * 396;
      const amp = (24 + normPitch * 58 + gate * 16) * mathArt.radialScale;
      const carrierCycles = 2 + pitchRatio * 1.6 * mathArt.freqMultiplierX;
      const fmSignal =
        Math.sin(
          theta * carrierCycles +
            mathArt.phaseOffsetRad +
            fm * 0.55 * Math.sin(theta * carrierCycles * ratio),
        );
      const overtone =
        Math.cos(theta * (p + q + mathArt.petalOrder * 0.25) + (orbit / 100) * Math.PI) *
        (8 + fm * 1.6);
      const y = cy + fmSignal * amp * 0.72 + overtone;
      primaryPts.push({ x, y });
      secondaryPts.push({
        x,
        y: cy - fmSignal * amp * mathArt.secondaryScale + Math.sin(theta * p) * 14,
      });
      haloPts.push({
        x,
        y: cy + fmSignal * amp * 0.9 + overtone * 1.15,
      });
    } else {
      // harmonograph: Blackburn / Lissajous Pendulum driven by pitchRatio & mathematical foundation
      if (i > 0) {
        phaseX += dBase * pitchRatio * mathArt.freqMultiplierX;
        phaseY += dBase * mathArt.freqMultiplierY;
      }
      const rx = (64 + (orbit / 100) * 108) * mathArt.radialScale;
      const ry = (42 + normPitch * 70) * mathArt.radialScale;
      const decayFactor = 0.08 + (1 - Math.min(900, Math.max(40, decay)) / 950) * 0.22;
      const damp = Math.exp(-u * decayFactor);
      const phi = (orbit / 100) * Math.PI * 0.5 + 0.35 + mathArt.phaseOffsetRad;

      const modX = Math.sin(phaseX * ratio + fm * 0.35) * (7 + fm * 2.2) * gate;
      const modY = Math.cos(phaseY * ratio + fm * 0.25) * (6 + fm * 1.8) * gate;

      const x = cx + Math.sin(phaseX + phi) * rx * damp + modX;
      const y = cy + Math.cos(phaseY) * ry * damp + modY;
      primaryPts.push({ x, y });

      secondaryPts.push({
        x: cx + Math.sin(theta * p * mathArt.freqMultiplierX + phi) * rx * mathArt.secondaryScale + modY * 0.55,
        y: cy + Math.cos(theta * q * mathArt.freqMultiplierY) * ry * mathArt.secondaryScale - modX * 0.45,
      });

      haloPts.push({
        x: cx + Math.sin(phaseX + phi) * (rx + 12) * damp + modX * 1.1,
        y: cy + Math.cos(phaseY) * (ry + 10) * damp + modY * 1.1,
      });
    }
  }

  const toPath = (arr: Array<{ x: number; y: number }>, close: boolean) => {
    const d = arr
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');
    return close && artMode !== 'ribbon' && artMode !== 'pitch-spiral' ? `${d} Z` : d;
  };

  const vertices: VectorPoint[] = steps.map((s, idx) => {
    if (artMode === 'pitch-spiral') {
      const u = idx / Math.max(1, steps.length - 1);
      const mathArt = mapMathToArtParams(s, u, idx, foundation, imperfection);
      const logPitch = Math.log2(Math.max(0.25, s.freqHz / rootHz));
      const normPitch = Math.min(1, Math.max(0, (logPitch + 1.2) / 3.2));
      const eulerAngle = logPitch * Math.PI * 2 - Math.PI / 2 + mathArt.spiralTwistRad * 0.25;
      const radial = (36 + normPitch * 68 + s.gate * 12) * mathArt.radialScale;
      return {
        x: cx + Math.cos(eulerAngle) * radial,
        y: cy + Math.sin(eulerAngle) * radial * 0.92,
        row: s.row,
        gate: s.gate,
        noteName: s.noteName,
        freqHz: s.freqHz,
        ratioLabel: `${stepRatios[idx].p}:${stepRatios[idx].q}`,
      };
    }

    const sampleIdx = Math.min(
      primaryPts.length - 1,
      Math.round((idx / Math.max(1, steps.length - 1)) * subSamples),
    );
    return {
      x: primaryPts[sampleIdx].x,
      y: primaryPts[sampleIdx].y,
      row: s.row,
      gate: s.gate,
      noteName: s.noteName,
      freqHz: s.freqHz,
      ratioLabel: `${stepRatios[idx].p}:${stepRatios[idx].q}`,
    };
  });

  // In pitch-spiral mode, draw primaryPathD cleanly through the exact harmonic vertices
  // so geometric polygons (triangles, hexagons, circle-of-fifths stars) appear crisp!
  const spiralChordPath =
    artMode === 'pitch-spiral'
      ? vertices
          .map((v, idx) => `${idx === 0 ? 'M' : 'L'}${v.x.toFixed(1)},${v.y.toFixed(1)}`)
          .join(' ')
      : toPath(primaryPts, true);

  return {
    primaryPathD: spiralChordPath,
    secondaryPathD: toPath(secondaryPts, true),
    haloPathD: toPath(haloPts, true),
    vertices,
    symmetry,
  };
}

/**
 * Generates exact symmetric polygon / star vertices inside the 440x280 art stage
 * so users can hear how geometric symmetry maps into musical intervals.
 */
export function buildSymmetricPolygonPoints(
  sides: number,
  starStep = 1,
  radius = 78,
): Array<{ x: number; y: number }> {
  const cx = 220;
  const cy = 140;
  const pts: Array<{ x: number; y: number }> = [];
  const count = Math.max(3, Math.min(16, sides));
  for (let k = 0; k < count; k++) {
    const vertexIdx = (k * starStep) % count;
    const angle = (vertexIdx / count) * Math.PI * 2 - Math.PI / 2;
    pts.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.92,
    });
  }
  // Return to root vertex to close the symmetry + resolve musically!
  pts.push({ ...pts[0] });
  return pts;
}

/**
 * Inverse Geometric-to-Musical Compiler:
 * Maps 2D canvas line/polygon points (x, y) back into live A1:F{N} spreadsheet formulas
 * via Euler polar pitch-circle mapping:
 *   - Polar angle θ -> 12-tone chromatic pitch class (=A1*POW(2, semi/12))
 *   - Polar radius r -> Octave shift + FM index + Harmonic ratio
 *   - Horizontal coordinate x -> Orbit X (Column D)
 *   - Segment arc length Δs -> Envelope decay ms (Column E)
 */
export function geometryToFormulaGrid(
  rawPoints: Array<{ x: number; y: number }>,
  options?: { baseHz?: number; targetSteps?: number },
): { grid: SheetRawGrid; rowCount: number } {
  const baseHz = Math.max(110, Math.min(523.25, options?.baseHz ?? 261.63));
  if (!rawPoints.length) {
    return { grid: {}, rowCount: 8 };
  }

  // Resample dense freehand strokes cleanly to 8..24 musical steps
  const desiredCount =
    options?.targetSteps ??
    (rawPoints.length <= 16 ? Math.max(4, rawPoints.length) : 16);
  const stepCount = Math.max(4, Math.min(24, desiredCount));

  const sampled: Array<{ x: number; y: number }> = [];
  if (rawPoints.length <= stepCount) {
    for (let i = 0; i < rawPoints.length; i++) {
      sampled.push(rawPoints[i]);
    }
  } else {
    for (let i = 0; i < stepCount; i++) {
      const idx = Math.round((i / Math.max(1, stepCount - 1)) * (rawPoints.length - 1));
      sampled.push(rawPoints[idx]);
    }
  }

  const cx = 220;
  const cy = 140;
  const grid: SheetRawGrid = {};

  let rootSemiOffset = 0;
  let rootFreq = baseHz;

  sampled.forEach((pt, idx) => {
    const row = idx + 1;
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const r = Math.hypot(dx, dy);

    // Angle starting at 12 o'clock clockwise in [0, 2π)
    const angle = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const pitchClass = Math.round((angle / (Math.PI * 2)) * 12) % 12;
    const octaveShift = r < 46 ? -12 : r > 94 ? 12 : 0;
    const totalSemi = pitchClass + octaveShift;

    if (row === 1) {
      rootSemiOffset = totalSemi;
      rootFreq = Math.round(baseHz * Math.pow(2, pitchClass / 12) * 100) / 100;
      rootSemiOffset = pitchClass; // keep A1 in comfortable middle octave
      grid.A1 = String(rootFreq);
    } else {
      const relSemi = totalSemi - rootSemiOffset;
      grid[`A${row}`] = relSemi === 0 ? '=A1' : `=A1*POW(2,${relSemi}/12)`;
    }

    // Center deadzone creates a rhythmic rest; otherwise active gate
    const gate = r < 14 ? 0 : Math.min(1, Math.max(0.65, 0.7 + (r / 130) * 0.3));
    const fmMod = Math.round((0.8 + Math.min(1, r / 120) * 3.4) * 10) / 10;
    const orbitX = Math.round(Math.max(10, Math.min(100, (pt.x / 440) * 100)));

    const prev = idx > 0 ? sampled[idx - 1] : pt;
    const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    const decayMs = Math.round(Math.max(160, Math.min(680, 190 + segLen * 2.1)));
    const harmonic = r < 46 ? 1.5 : r > 94 ? 3 : 2;

    grid[`B${row}`] = gate === 0 ? '0' : gate.toFixed(2);
    grid[`C${row}`] = String(fmMod);
    grid[`D${row}`] = String(orbitX);
    grid[`E${row}`] = String(decayMs);
    grid[`F${row}`] = String(harmonic);
  });

  const finalRowCount = Math.max(8, sampled.length);
  for (let row = sampled.length + 1; row <= finalRowCount; row++) {
    grid[`A${row}`] = '=A1';
    grid[`B${row}`] = '0';
    grid[`C${row}`] = '1.2';
    grid[`D${row}`] = '50';
    grid[`E${row}`] = '220';
    grid[`F${row}`] = '2';
  }

  return { grid, rowCount: finalRowCount };
}

export function exportStandaloneSvg(
  steps: EvaluatedRowStep[],
  title: string,
  artMode: ArtModeId = 'harmonograph',
  foundation: MathFoundationId = 'harmonic-sine',
  imperfection = 0,
): string {
  const { primaryPathD, secondaryPathD, haloPathD, vertices, symmetry } = computeVectorCurve(
    steps,
    artMode,
    foundation,
    imperfection,
  );
  const circles = vertices
    .map(
      (v) =>
        `<circle cx="${v.x.toFixed(1)}" cy="${v.y.toFixed(1)}" r="${v.gate > 0.05 ? 3.5 : 1.8}" fill="${
          v.gate > 0.05 ? '#00E5CC' : '#34466B'
        }" />`,
    )
    .join('\n  ');

  const octaveRings =
    artMode === 'pitch-spiral'
      ? `<circle cx="220" cy="140" r="46" fill="none" stroke="#1F2A40" stroke-width="0.7" stroke-dasharray="2 3" />
  <circle cx="220" cy="140" r="80" fill="none" stroke="#1F2A40" stroke-width="0.7" stroke-dasharray="2 3" />`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280" width="1320" height="840">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#111C2E" />
      <stop offset="100%" stop-color="#07090E" />
    </radialGradient>
  </defs>
  <rect width="440" height="280" fill="url(#bgGlow)" />
  <circle cx="220" cy="140" r="118" fill="none" stroke="#1F2A40" stroke-width="0.8" stroke-dasharray="3 4" />
  ${octaveRings}
  <line x1="220" y1="12" x2="220" y2="268" stroke="#1F2A40" stroke-width="0.8" />
  <line x1="12" y1="140" x2="428" y2="140" stroke="#1F2A40" stroke-width="0.8" />
  <path d="${haloPathD}" fill="none" stroke="#38BDF8" stroke-opacity="0.24" stroke-width="1.2" />
  <path d="${secondaryPathD}" fill="none" stroke="#F59E0B" stroke-opacity="0.55" stroke-width="1.35" stroke-linejoin="round" />
  <path d="${primaryPathD}" fill="none" stroke="#00E5CC" stroke-width="2.2" stroke-linejoin="round" />
  ${circles}
  <text x="18" y="264" fill="#8A99B8" font-family="monospace" font-size="10">${title} · ${symmetry.dominantRatio.p}:${symmetry.dominantRatio.q} (${symmetry.symmetryIndex}% symmetry) · ${artMode} · ${foundation}</text>
</svg>`;
}

export async function exportPosterPng(
  steps: EvaluatedRowStep[],
  title: string,
  bpm: number,
  voice: SynthVoiceId,
  artMode: ArtModeId,
  coverImageUrl?: string,
  foundation: MathFoundationId = 'harmonic-sine',
  imperfection = 0,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const width = 1200;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  const grad = ctx.createRadialGradient(600, 420, 40, 600, 420, 640);
  grad.addColorStop(0, '#121D30');
  grad.addColorStop(1, '#07090E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle cover art vignette if available
  if (coverImageUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = coverImageUrl;
      });
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();

      const scrim = ctx.createLinearGradient(0, 0, 0, height);
      scrim.addColorStop(0, 'rgba(7, 9, 14, 0.65)');
      scrim.addColorStop(0.55, 'rgba(7, 9, 14, 0.55)');
      scrim.addColorStop(1, 'rgba(7, 9, 14, 0.94)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, width, height);
    } catch {
      // Ignore image load failures and proceed with crisp vector poster
    }
  }

  // Framing reticle
  ctx.strokeStyle = 'rgba(31, 42, 64, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  ctx.beginPath();
  ctx.arc(600, 415, 270, 0, Math.PI * 2);
  ctx.setLineDash([6, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Render parametric geometry scaled to poster
  const artwork = computeVectorCurve(steps, artMode, foundation, imperfection);
  const scaleX = 2.4;
  const scaleY = 2.4;
  const offsetX = 600 - 220 * scaleX;
  const offsetY = 415 - 140 * scaleY;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scaleX, scaleY);

  const drawSvgPath = (d: string, stroke: string, lineWidth: number, alpha: number) => {
    if (!d) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(d));
    ctx.restore();
  };

  drawSvgPath(artwork.haloPathD, '#38BDF8', 1.4, 0.35);
  drawSvgPath(artwork.secondaryPathD, '#F59E0B', 1.5, 0.65);
  drawSvgPath(artwork.primaryPathD, '#00E5CC', 2.4, 0.98);

  for (const v of artwork.vertices) {
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.gate > 0.05 ? 3.4 : 1.6, 0, Math.PI * 2);
    ctx.fillStyle = v.gate > 0.05 ? '#00E5CC' : '#34466B';
    ctx.fill();
  }
  ctx.restore();

  // Footer Typography
  ctx.fillStyle = '#EDF2F9';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(title, 82, 795);

  ctx.fillStyle = '#00E5CC';
  ctx.font = '20px monospace';
  ctx.fillText(
    `${steps.length} steps  ·  ${artwork.symmetry.dominantRatio.p}:${artwork.symmetry.dominantRatio.q} ratio (${artwork.symmetry.symmetryIndex}% sym)  ·  ${foundation}  ·  ${artMode}`,
    82,
    832,
  );

  ctx.fillStyle = '#8A99B8';
  ctx.font = '18px monospace';
  ctx.fillText('Harmoglyph · Kiroween 2026', 840, 832);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
