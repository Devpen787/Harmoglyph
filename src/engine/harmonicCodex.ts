import {
  type ArtModeId,
  type CodexCompatibilityStatus,
  type EvaluatedRowStep,
  type ExperienceTierId,
  type MathFoundationId,
  type SheetCol,
  type SheetEvaluationResult,
  type SheetRawGrid,
  type SynthVoiceId,
} from '../types/chimera.ts';
import {
  findFormulaHintByName,
  GOLDEN_ANGLE_RAD,
  INV_PHI,
  mapMathToSynthParams,
  PHI,
} from './mathArtTheory.ts';
import { evaluateSheet } from './spreadsheetVm.ts';
import {
  computeVectorCurve,
  type HarmonicSymmetryAnalysis,
  type StepSymmetryMetric,
  type VectorArtwork,
} from './vectorPlotter.ts';

export type CodexNatureTag = 'rational' | 'periodic' | 'recursive' | 'irrational' | 'organic';

export interface CodexPitchLaw {
  id: string;
  title: string;
  equation: string;
  formulaTemplate: string;
  musicalResult: string;
  shapeResult: string;
  nature: CodexNatureTag;
  preferredFoundation: MathFoundationId;
  buildColumnA: (rowCount: number, rootHz: number) => Record<string, string>;
}

export interface CodexModLaw {
  id: string;
  title: string;
  equation: string;
  musicalResult: string;
  shapeResult: string;
  nature: CodexNatureTag;
  suggestedVoice: SynthVoiceId;
  buildModColumns: (rowCount: number) => Record<string, string>;
}

export interface CodexGeometryForm {
  id: ArtModeId;
  sculptTitle: string;
  vectorTitle: string;
  equation: string;
  connectionNote: string;
  favoredNature: CodexNatureTag[];
}

export interface CodexCompatibilityDiagnosis {
  status: CodexCompatibilityStatus;
  badgeLabel: string;
  headline: string;
  explanation: string;
  recommendedImperfection: number;
}

export interface CodexExperimentPreset {
  id: string;
  title: string;
  subtitle: string;
  pitchId: string;
  modId: string;
  geoId: ArtModeId;
  imperfection: number;
  bpm: number;
}

export interface ColumnMathGenerator {
  id: string;
  col: SheetCol;
  label: string;
  equationPreview: string;
  description: string;
  buildCellFormula: (row: number) => string;
}

export interface FormulaAnatomyPart {
  token: string;
  meaning: string;
  role: 'anchor' | 'function' | 'constant' | 'math';
}

export interface FormulaAnatomyExplanation {
  summary: string;
  parts: FormulaAnatomyPart[];
}

export interface HarmonicQuestSpec {
  id: string;
  stepNumber: number;
  tier: ExperienceTierId;
  title: string;
  prompt: string;
  mathIdea: string;
  hint: string;
}

export interface HarmonicQuestProgress extends HarmonicQuestSpec {
  completed: boolean;
  progressText: string;
}

export const CODEX_PITCH_LAWS: CodexPitchLaw[] = [
  {
    id: 'pythagorean-fifths',
    title: 'Pythagorean 3:2 Fifths',
    equation: 'fₙ = A1 · (3/2)ᵐ mod 2',
    formulaTemplate: '=A1*POW(2,MOD(ROW()*7,12)/12)',
    musicalResult: 'Clean fifths & octave stacks with strong tonal anchor',
    shapeResult: 'Tight closed star knots & crystalline 3-lobe symmetry',
    nature: 'rational',
    preferredFoundation: 'pythagorean',
    buildColumnA: (rowCount, rootHz) => {
      const out: Record<string, string> = { A1: String(Math.round(rootHz * 100) / 100) };
      for (let r = 2; r <= rowCount; r++) {
        out[`A${r}`] = '=A1*POW(2,MOD((ROW()-1)*7,12)/12)';
      }
      return out;
    },
  },
  {
    id: 'harmonic-overtones',
    title: 'Fourier Sine Wave',
    equation: 'fₙ = A1 · (1 + 0.5·|sin(nπ/4)|)',
    formulaTemplate: '=A1*(1+0.5*ABS(SIN(ROW()*PI/4)))',
    musicalResult: 'Smooth rising-and-falling wave arpeggio',
    shapeResult: 'Symmetric 4-fold Lissajous orbits & smooth waves',
    nature: 'periodic',
    preferredFoundation: 'harmonic-sine',
    buildColumnA: (rowCount, rootHz) => {
      const out: Record<string, string> = { A1: String(Math.round(rootHz * 100) / 100) };
      for (let r = 2; r <= rowCount; r++) {
        out[`A${r}`] = '=A1*(1+0.5*ABS(SIN((ROW()-1)*PI/4)))';
      }
      return out;
    },
  },
  {
    id: 'fibonacci-growth',
    title: 'Fibonacci Modulo Spiral',
    equation: 'fₙ = A1 · 2^(mod(Fₙ, 12) / 12)',
    formulaTemplate: '=A1*POW(2,MOD(FIB(ROW()),12)/12)',
    musicalResult: 'Expanding recursive leaps that fold back rhythmically',
    shapeResult: 'Sunflower phyllotaxis petals (3, 5, 8) at 137.5° twist',
    nature: 'recursive',
    preferredFoundation: 'fibonacci',
    buildColumnA: (rowCount, rootHz) => {
      const out: Record<string, string> = { A1: String(Math.round(rootHz * 100) / 100) };
      for (let r = 2; r <= rowCount; r++) {
        out[`A${r}`] = '=A1*POW(2,MOD(FIB(ROW()),12)/12)';
      }
      return out;
    },
  },
  {
    id: 'golden-chimes',
    title: 'Golden Ratio φ Lattice',
    equation: 'fₙ = A1 · 2^(mod(n·φ, 12) / 12)',
    formulaTemplate: '=A1*POW(2,ROUND(MOD(ROW()*PHI,12))/12)',
    musicalResult: 'Non-repeating shimmering bells that avoid stale loops',
    shapeResult: 'Irrational precessing rosettes & nautilus spirals',
    nature: 'irrational',
    preferredFoundation: 'golden-ratio',
    buildColumnA: (rowCount, rootHz) => {
      const out: Record<string, string> = { A1: String(Math.round(rootHz * 100) / 100) };
      for (let r = 2; r <= rowCount; r++) {
        out[`A${r}`] = '=A1*POW(2,ROUND(MOD(ROW()*PHI,12))/12)';
      }
      return out;
    },
  },
];

export const CODEX_MOD_LAWS: CodexModLaw[] = [
  {
    id: 'crystal-octave',
    title: 'Locked Octave & Pulse',
    equation: 'F = 2 · I = 1.6 · Gate = 0.9',
    musicalResult: 'Pure beat-free octaves with crisp rhythmic downbeats',
    shapeResult: 'Clean stationary standing-wave contours',
    nature: 'rational',
    suggestedVoice: 'music-box',
    buildModColumns: (rowCount) => {
      const out: Record<string, string> = {};
      for (let r = 1; r <= rowCount; r++) {
        out[`B${r}`] = r % 4 === 0 ? '0.65' : '0.95';
        out[`C${r}`] = '1.6';
        out[`D${r}`] = `=${36 + ((r - 1) % 4) * 14}`;
        out[`E${r}`] = '280';
        out[`F${r}`] = r % 2 === 0 ? '2' : '1.5';
      }
      return out;
    },
  },
  {
    id: 'pisano-euclidean',
    title: 'Fibonacci Pisano Groove',
    equation: 'Gate = IF(MOD(FIB(ROW()),3)=0, 0, 0.95)',
    musicalResult: 'Organic syncopated rests & swelling harmonic brightness',
    shapeResult: '5- & 8-petal undulating rings with dynamic spokes',
    nature: 'recursive',
    suggestedVoice: 'analog-pluck',
    buildModColumns: (rowCount) => {
      const out: Record<string, string> = {};
      for (let r = 1; r <= rowCount; r++) {
        out[`B${r}`] = '=IF(MOD(FIB(ROW()),4)=0,0,0.94)';
        out[`C${r}`] = '=1.4+MOD(FIB(ROW()),5)*0.55';
        out[`D${r}`] = '=ROUND(50+SIN(ROW()*GOLDEN_ANGLE)*36)';
        out[`E${r}`] = '=220+MOD(ROW(),3)*85';
        out[`F${r}`] = r % 2 === 0 ? '1.5' : '2';
      }
      return out;
    },
  },
  {
    id: 'phi-bell-shimmer',
    title: 'Golden Bell Inharmonics',
    equation: 'F = PHI · D = 50 + COS(ROW()*PHI)*38',
    musicalResult: 'Luminous bronze-bell overtones with long ethereal tails',
    shapeResult: 'Dense nested filigree & irrational torus weaves',
    nature: 'irrational',
    suggestedVoice: 'celestial-chime',
    buildModColumns: (rowCount) => {
      const out: Record<string, string> = {};
      for (let r = 1; r <= rowCount; r++) {
        out[`B${r}`] = r % 5 === 0 ? '0.55' : '0.9';
        out[`C${r}`] = '=1.8+ABS(SIN(ROW()*INV_PHI))*2.4';
        out[`D${r}`] = '=ROUND(50+COS(ROW()*PHI)*38)';
        out[`E${r}`] = '420';
        out[`F${r}`] = String(Number(PHI.toFixed(3)));
      }
      return out;
    },
  },
  {
    id: 'organic-breath',
    title: 'Organic PERTURB Breath',
    equation: 'C = PERTURB(2.4, 0.28) · E = PERTURB(300, 0.2)',
    musicalResult: 'Humanized micro-variations that breathe like live strings',
    shapeResult: 'Asymmetric coral & fluid living distortion',
    nature: 'organic',
    suggestedVoice: 'haunted-organ',
    buildModColumns: (rowCount) => {
      const out: Record<string, string> = {};
      for (let r = 1; r <= rowCount; r++) {
        out[`B${r}`] = r % 6 === 0 ? '0' : '0.88';
        out[`C${r}`] = '=PERTURB(2.4+ABS(SIN(ROW()*0.5)),0.28)';
        out[`D${r}`] = '=ROUND(PERTURB(54,0.35))';
        out[`E${r}`] = '=ROUND(PERTURB(310,0.22))';
        out[`F${r}`] = '=PERTURB(2,0.18)';
      }
      return out;
    },
  },
];

export const CODEX_GEOMETRY_FORMS: CodexGeometryForm[] = [
  {
    id: 'harmonograph',
    sculptTitle: '3D Torus Knot',
    vectorTitle: 'Pendulum Harmonograph',
    equation: 'x=sin(p·ωt+φ), y=cos(q·ωt)',
    connectionNote: 'Frequency ratios p:q count the exact loops & crossings in 3D space.',
    favoredNature: ['rational', 'periodic'],
  },
  {
    id: 'mandala',
    sculptTitle: 'Cymatic Mandala',
    vectorTitle: 'Chladni Standing Plate',
    equation: 'r(θ) = R₀ + cos(nθ) − ½cos(mθ)',
    connectionNote: 'Harmonic steps carve standing nodal petals like sand vibrating on brass.',
    favoredNature: ['rational', 'recursive'],
  },
  {
    id: 'pitch-spiral',
    sculptTitle: 'Golden Vortex',
    vectorTitle: 'Euler Pitch Spiral',
    equation: 'z = r(f) · e^(i·2π·log₂(f/f₀))',
    connectionNote: 'Angles align musical octaves radially; Fibonacci & φ turn them into shells.',
    favoredNature: ['recursive', 'irrational', 'organic'],
  },
  {
    id: 'ribbon',
    sculptTitle: 'Helix Ribbon',
    vectorTitle: 'FM Wave Ribbon',
    equation: 'y(t) = sin(ω_c·t + I·sin(r·ω_c·t))',
    connectionNote: 'Shows the exact FM sound waveform unrolled directly as architectural geometry.',
    favoredNature: ['periodic', 'irrational', 'organic'],
  },
];

export const CODEX_EXPERIMENTS: CodexExperimentPreset[] = [
  {
    id: 'exp-crystal',
    title: 'Crystal 3:2 Symmetry',
    subtitle: 'Pure Pythagorean fifths locked into a tight closed mandala (0% imperfection)',
    pitchId: 'pythagorean-fifths',
    modId: 'crystal-octave',
    geoId: 'mandala',
    imperfection: 0,
    bpm: 118,
  },
  {
    id: 'exp-sunflower',
    title: 'Fibonacci Seed Vortex',
    subtitle: 'Recursive F_n intervals twisted along the 137.5° golden angle spiral',
    pitchId: 'fibonacci-growth',
    modId: 'pisano-euclidean',
    geoId: 'pitch-spiral',
    imperfection: 0.14,
    bpm: 126,
  },
  {
    id: 'exp-bell',
    title: 'Golden Ratio Chimes',
    subtitle: 'Irrational φ overtones that shimmer without mechanical repetition',
    pitchId: 'golden-chimes',
    modId: 'phi-bell-shimmer',
    geoId: 'harmonograph',
    imperfection: 0.22,
    bpm: 104,
  },
  {
    id: 'exp-living',
    title: 'Living Organic Coral',
    subtitle: 'Sine harmonics warped by PERTURB() algebra & 42% organic drift',
    pitchId: 'harmonic-overtones',
    modId: 'organic-breath',
    geoId: 'ribbon',
    imperfection: 0.42,
    bpm: 112,
  },
];

export function evaluateCodexCompatibility(
  pitchId: string,
  modId: string,
  geoId: ArtModeId,
  imperfection = 0,
): CodexCompatibilityDiagnosis {
  const pitch = CODEX_PITCH_LAWS.find((p) => p.id === pitchId) ?? CODEX_PITCH_LAWS[0];
  const mod = CODEX_MOD_LAWS.find((m) => m.id === modId) ?? CODEX_MOD_LAWS[0];
  const geo = CODEX_GEOMETRY_FORMS.find((g) => g.id === geoId) ?? CODEX_GEOMETRY_FORMS[0];

  const sameNature = pitch.nature === mod.nature;
  const geoMatchesPitch = geo.favoredNature.includes(pitch.nature);
  const isRationalVsIrrational =
    (pitch.nature === 'rational' && (mod.nature === 'irrational' || mod.nature === 'organic')) ||
    (mod.nature === 'rational' && pitch.nature === 'irrational');

  if (isRationalVsIrrational || (!geoMatchesPitch && imperfection > 0.45)) {
    return {
      status: 'tension',
      badgeLabel: 'Creative Tension',
      headline: `${pitch.title} × ${mod.title} creates shimmering friction`,
      explanation: `Pairing ${pitch.nature} intervals with ${mod.nature} modulation breaks rigid locking—producing beating FM partials and asymmetric spirals on ${geo.sculptTitle}.`,
      recommendedImperfection: 0.34,
    };
  }

  if (
    pitch.nature === 'recursive' ||
    pitch.nature === 'irrational' ||
    mod.nature === 'organic' ||
    imperfection >= 0.2
  ) {
    return {
      status: 'organic',
      badgeLabel: 'Living Spiral',
      headline: `Self-similar growth unfolds ${geo.sculptTitle}`,
      explanation: `${pitch.title} and ${mod.title} balance recognizable phrasing with non-repeating golden-angle variation so neither the ear nor the eye gets fatigued.`,
      recommendedImperfection: pitch.nature === 'recursive' ? 0.16 : 0.28,
    };
  }

  if (sameNature || geoMatchesPitch) {
    return {
      status: 'resonant',
      badgeLabel: 'Harmonic Lock',
      headline: `Phase-locked ratios sculpt pure ${geo.sculptTitle} symmetry`,
      explanation: `${pitch.title} reinforces ${mod.title} cleanly—wave cycles line up at exact integer nodes for crystal-clear intervals and closed geometry.`,
      recommendedImperfection: 0.04,
    };
  }

  return {
    status: 'organic',
    badgeLabel: 'Balanced Blend',
    headline: `${pitch.title} + ${mod.title} maps cleanly to ${geo.sculptTitle}`,
    explanation: `Periodic phrasing keeps the melody grounded while ${mod.title} enriches overtone density and 3D curvature.`,
    recommendedImperfection: 0.18,
  };
}

export function compileCodexMix(
  pitchId: string,
  modId: string,
  geoId: ArtModeId,
  options?: { rootHz?: number; rowCount?: number; bpm?: number; imperfection?: number },
): {
  grid: SheetRawGrid;
  rowCount: number;
  title: string;
  artMode: ArtModeId;
  foundation: MathFoundationId;
  voice: SynthVoiceId;
  bpm: number;
  imperfection: number;
} {
  const pitch = CODEX_PITCH_LAWS.find((p) => p.id === pitchId) ?? CODEX_PITCH_LAWS[0];
  const mod = CODEX_MOD_LAWS.find((m) => m.id === modId) ?? CODEX_MOD_LAWS[0];
  const geo = CODEX_GEOMETRY_FORMS.find((g) => g.id === geoId) ?? CODEX_GEOMETRY_FORMS[0];
  const rowCount = options?.rowCount ?? 12;
  const rootHz = options?.rootHz ?? 261.63;
  const diag = evaluateCodexCompatibility(pitch.id, mod.id, geo.id, options?.imperfection ?? 0);

  const colA = pitch.buildColumnA(rowCount, rootHz);
  const colsBF = mod.buildModColumns(rowCount);

  return {
    grid: { ...colA, ...colsBF },
    rowCount,
    title: `${pitch.title.split(' ')[0]} × ${geo.sculptTitle}`,
    artMode: geo.id,
    foundation: pitch.preferredFoundation,
    voice: mod.suggestedVoice,
    bpm: options?.bpm ?? 116,
    imperfection: options?.imperfection ?? diag.recommendedImperfection,
  };
}

export const COLUMN_MATH_GENERATORS: Record<SheetCol, ColumnMathGenerator[]> = {
  A: [
    {
      id: 'col-a-fifths',
      col: 'A',
      label: 'Pythagorean Fifths Stack',
      equationPreview: '=A1*POW(2,MOD((ROW()-1)*7,12)/12)',
      description: 'Steps around the circle of fifths from root A1',
      buildCellFormula: (r) => (r === 1 ? '261.63' : '=A1*POW(2,MOD((ROW()-1)*7,12)/12)'),
    },
    {
      id: 'col-a-fib',
      col: 'A',
      label: 'Fibonacci Chromatic Arpeggio',
      equationPreview: '=A1*POW(2,MOD(FIB(ROW()),12)/12)',
      description: 'Maps Fibonacci numbers onto 12-tone intervals',
      buildCellFormula: (r) => (r === 1 ? '261.63' : '=A1*POW(2,MOD(FIB(ROW()),12)/12)'),
    },
    {
      id: 'col-a-sine',
      col: 'A',
      label: 'Harmonic Sine Wave',
      equationPreview: '=A1*(1+0.5*ABS(SIN(ROW()*PI/4)))',
      description: 'Smoothly rises and falls like a vibrating string',
      buildCellFormula: (r) => (r === 1 ? '261.63' : '=A1*(1+0.5*ABS(SIN((ROW()-1)*PI/4)))'),
    },
    {
      id: 'col-a-phi',
      col: 'A',
      label: 'Golden Ratio φ Drift',
      equationPreview: '=A1*POW(2,ROUND(MOD(ROW()*PHI,12))/12)',
      description: 'Irrational φ steps that stay melodic without repeating',
      buildCellFormula: (r) => (r === 1 ? '261.63' : '=A1*POW(2,ROUND(MOD(ROW()*PHI,12))/12)'),
    },
  ],
  B: [
    {
      id: 'col-b-euclidean',
      col: 'B',
      label: 'Euclidean Beat (3-on-8)',
      equationPreview: '=IF(MOD(ROW()*3,8)<3,0.95,0)',
      description: 'Classic syncopated groove using modulo division',
      buildCellFormula: () => '=IF(MOD(ROW()*3,8)<3,0.95,0)',
    },
    {
      id: 'col-b-fib',
      col: 'B',
      label: 'Fibonacci Accent Pattern',
      equationPreview: '=IF(MOD(FIB(ROW()),3)=0,0,0.92)',
      description: 'Places rests naturally on multiples of 3 in F_n',
      buildCellFormula: () => '=IF(MOD(FIB(ROW()),3)=0,0,0.92)',
    },
    {
      id: 'col-b-pulse',
      col: 'B',
      label: 'Constant Downbeat Pulse',
      equationPreview: '=0.65+0.3*ABS(COS(ROW()*PI/2))',
      description: 'No rests; accents every second beat smoothly',
      buildCellFormula: () => '=0.65+0.3*ABS(COS(ROW()*PI/2))',
    },
  ],
  C: [
    {
      id: 'col-c-swell',
      col: 'C',
      label: 'Sine Harmonic Swell',
      equationPreview: '=1.2+ABS(SIN(ROW()*0.65))*3.2',
      description: 'Sweeps timbre from warm sine to bright bell',
      buildCellFormula: () => '=1.2+ABS(SIN(ROW()*0.65))*3.2',
    },
    {
      id: 'col-c-perturb',
      col: 'C',
      label: 'Organic PERTURB Shimmer',
      equationPreview: '=PERTURB(2.4,0.35)',
      description: 'Adds living golden-angle brightness flutter',
      buildCellFormula: () => '=PERTURB(2.4,0.35)',
    },
  ],
  D: [
    {
      id: 'col-d-golden',
      col: 'D',
      label: 'Phyllotaxis Orbit Spiral',
      equationPreview: '=ROUND(50+SIN(ROW()*GOLDEN_ANGLE)*38)',
      description: 'Rotates 2D/3D phase by 137.5° every step',
      buildCellFormula: () => '=ROUND(50+SIN(ROW()*GOLDEN_ANGLE)*38)',
    },
    {
      id: 'col-d-pendulum',
      col: 'D',
      label: 'Pendulum Sweep',
      equationPreview: '=ROUND(50+COS(ROW()*PI/4)*40)',
      description: 'Classic harmonic X-axis Lissajous swing',
      buildCellFormula: () => '=ROUND(50+COS(ROW()*PI/4)*40)',
    },
  ],
  E: [
    {
      id: 'col-e-bloom',
      col: 'E',
      label: 'Fibonacci Decay Breath',
      equationPreview: '=180+MOD(FIB(ROW()),7)*65',
      description: 'Alternates crisp staccato & long ambient tails',
      buildCellFormula: () => '=180+MOD(FIB(ROW()),7)*65',
    },
    {
      id: 'col-e-steady',
      col: 'E',
      label: 'Crisp Pluck Envelope',
      equationPreview: '240',
      description: 'Uniform 240 ms percussion decay',
      buildCellFormula: () => '240',
    },
  ],
  F: [
    {
      id: 'col-f-pure',
      col: 'F',
      label: 'Pure Fifth / Octave Flip',
      equationPreview: '=IF(MOD(ROW(),2)=0,2,1.5)',
      description: 'Alternates 2:1 octave & 3:2 fifth overtones',
      buildCellFormula: () => '=IF(MOD(ROW(),2)=0,2,1.5)',
    },
    {
      id: 'col-f-phi',
      col: 'F',
      label: 'Irrational φ Bell Ratio',
      equationPreview: '=PHI',
      description: 'Metallic bell partials aligned to 1.618',
      buildCellFormula: () => '=PHI',
    },
  ],
};

export function applyColumnMathGenerator(
  currentGrid: SheetRawGrid,
  generator: ColumnMathGenerator,
  rowCount: number,
): SheetRawGrid {
  const next = { ...currentGrid };
  for (let r = 1; r <= rowCount; r++) {
    // Keep A1 root frequency intact if already numeric when applying non-A1 or preserves root key
    if (generator.col === 'A' && r === 1 && currentGrid.A1 && !currentGrid.A1.startsWith('=')) {
      const existing = Number(currentGrid.A1);
      if (Number.isFinite(existing) && existing >= 40 && existing <= 2000) {
        next.A1 = currentGrid.A1;
        continue;
      }
    }
    next[`${generator.col}${r}`] = generator.buildCellFormula(r);
  }
  return next;
}

export function explainFormulaAnatomy(formula: string): FormulaAnatomyExplanation | null {
  const trimmed = formula.trim();
  if (!trimmed.startsWith('=')) return null;

  const parts: FormulaAnatomyPart[] = [];
  const seen = new Set<string>();
  const tokenRe = /([A-Za-z_][A-Za-z0-9_]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(trimmed)) !== null) {
    const word = match[1].toUpperCase();
    if (seen.has(word)) continue;
    seen.add(word);

    if (/^[A-F]([1-9]|[1-3][0-9]|4[0-8])$/.test(word)) {
      parts.push({
        token: word,
        meaning:
          word === 'A1'
            ? 'Root pitch anchor (Hz) — edits transpose linked rows'
            : `Live value from cell ${word}`,
        role: 'anchor',
      });
      continue;
    }

    const hint = findFormulaHintByName(word);
    if (hint) {
      parts.push({
        token: hint.signature,
        meaning: hint.summary,
        role: hint.kind === 'constant' ? 'constant' : 'function',
      });
    }
  }

  let summary = 'Evaluates a live numeric expression mapped directly into synth & geometry.';
  if (/POW\s*\(\s*2\s*,/.test(trimmed.toUpperCase())) {
    summary =
      'Uses base-2 exponential pitch scaling (each +1 in exponent doubles pitch by 1 octave).';
  } else if (/FIB|GOLDEN_ANGLE/.test(trimmed.toUpperCase())) {
    summary =
      'Generates organic phyllotaxis progression using Fibonacci recursion / golden angle.';
  } else if (/PHI|INV_PHI/.test(trimmed.toUpperCase())) {
    summary =
      'Uses the irrational golden ratio (1.618) so patterns evolve without stale looping.';
  } else if (/PERTURB|WARP/.test(trimmed.toUpperCase())) {
    summary =
      'Applies controlled golden-angle imperfection so mechanical symmetry breathes naturally.';
  } else if (/SIN|COS/.test(trimmed.toUpperCase())) {
    summary = 'Modulates parameter smoothly along a periodic trigonometric wave.';
  } else if (/IF\s*\(/.test(trimmed.toUpperCase())) {
    summary = 'Applies algebraic conditional logic to switch between notes, rests, or ratios.';
  }

  return { summary, parts };
}

export function describeLivePhysics(
  step: EvaluatedRowStep | undefined,
  ratioMetric: StepSymmetryMetric | undefined,
  symmetry: HarmonicSymmetryAnalysis | undefined,
  foundation: MathFoundationId,
  imperfection: number,
): string {
  const ratioText = ratioMetric ? `${ratioMetric.p}:${ratioMetric.q} ${ratioMetric.label}` : '1:1 Unison';
  if (imperfection >= 0.32) {
    return `${Math.round(imperfection * 100)}% Organic Drift · Imperfection bends ${ratioText} into an asymmetric living spiral.`;
  }
  if (foundation === 'fibonacci') {
    return `${ratioText} · Fibonacci Fₙ ratios twist phase by 137.5° like sunflower seed spirals.`;
  }
  if (foundation === 'golden-ratio') {
    return `${ratioText} · Irrational φ (1.618) keeps sound & shape evolving without exact repetition.`;
  }
  if (foundation === 'pythagorean') {
    return `${ratioText} · Whole-number waves align cleanly (${symmetry?.symmetryIndex ?? 80}% symmetry) for closed geometric knots.`;
  }
  if (step && step.gate <= 0.02) {
    return `Rest Step · Silence creates contrast so surrounding harmonic peaks stand out in 3D space.`;
  }
  return `${ratioText} · Periodic sine waves balance carrier pitch & FM overtones into clean nodal petals.`;
}

export const HARMONIC_QUESTS: HarmonicQuestSpec[] = [
  {
    id: 'quest-pure-ratio',
    stepNumber: 1,
    tier: 'discovery',
    title: 'Lock Pure Crystal Symmetry',
    prompt: 'Keep Organic Imperfection low (<= 15%) and achieve >= 70% harmonic symmetry (try Pythagorean tuning).',
    mathIdea: 'Small integer ratios (2:1, 3:2, 4:3) align wave crests cleanly into closed geometry.',
    hint: 'In Discovery mode, set Tuning to Pythagorean and slide Imperfection below 15%.',
  },
  {
    id: 'quest-living-imperfection',
    stepNumber: 2,
    tier: 'discovery',
    title: 'Awaken Organic Imperfection',
    prompt: 'Raise Organic Imperfection >= 25% (or switch to Fibonacci / Golden Ratio φ) to break rigid symmetry.',
    mathIdea: 'Living forms in nature combine clear rhythm with irrational golden-angle variation.',
    hint: 'Drag the Imperfection (δ) slider past 25% and watch the 3D sculpture twist.',
  },
  {
    id: 'quest-codex-mix',
    stepNumber: 3,
    tier: 'explorer',
    title: 'Mix & Match a Harmonic Bloom',
    prompt: 'In Explorer, apply a multi-step patch with >= 6 active notes and varied FM brightness.',
    mathIdea: 'Combining pitch scaling with independent modulation creates dynamic expressive timbres.',
    hint: 'Switch to Explorer, mix any Pitch + Modulation + Shape card, and click Apply Mix.',
  },
  {
    id: 'quest-algebra-formula',
    stepNumber: 4,
    tier: 'algebra',
    title: 'Compose With Living Algebra',
    prompt: 'Use at least 2 dynamic math functions (SIN, COS, FIB, PHI, MOD, or PERTURB) with 0 errors.',
    mathIdea: 'One compact formula replaces dozens of static numbers and responds globally to Root A1.',
    hint: 'Open Algebra Lab and edit a cell with = or apply a Column Math Generator.',
  },
  {
    id: 'quest-octave-architecture',
    stepNumber: 5,
    tier: 'algebra',
    title: 'Multi-Octave Geometric Architecture',
    prompt: 'Span >= 1.45x pitch range across >= 6 active steps while holding >= 58% symmetry.',
    mathIdea: 'Balanced octave expansion pairs wide spiral geometry with strong tonal consonance.',
    hint: 'Use =A1*POW(2, ...) or Draw Line -> Music across outer & inner rings.',
  },
];

const DYNAMIC_FN_RE = /\b(SIN|COS|FIB|FIBONACCI|PHI|INV_PHI|GOLDEN_ANGLE|MOD|PERTURB|WARP)\b/i;

export function evaluateHarmonicQuests(params: {
  grid: SheetRawGrid;
  evaluation: SheetEvaluationResult;
  symmetry: HarmonicSymmetryAnalysis;
  foundation: MathFoundationId;
  imperfection: number;
  rowCount: number;
}): HarmonicQuestProgress[] {
  const { grid, evaluation, symmetry, foundation, imperfection, rowCount } = params;

  const activeSteps = evaluation.steps
    .slice(0, rowCount)
    .filter((s) => s.gate > 0.02 && !s.hasError);

  const fmValues = activeSteps.map((s) => Math.round(s.fmIndex * 10));
  const distinctFm = new Set(fmValues).size;

  let minHz = Infinity;
  let maxHz = 0;
  for (const s of activeSteps) {
    if (s.freqHz < minHz) minHz = s.freqHz;
    if (s.freqHz > maxHz) maxHz = s.freqHz;
  }
  const pitchSpan = activeSteps.length > 0 && minHz > 0 ? maxHz / minHz : 1;

  let dynamicFormulaCount = 0;
  for (let r = 1; r <= rowCount; r++) {
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
      const raw = grid[`${c}${r}`] ?? '';
      if (raw.startsWith('=') && DYNAMIC_FN_RE.test(raw)) {
        dynamicFormulaCount++;
      }
    }
  }

  return HARMONIC_QUESTS.map((q) => {
    if (q.id === 'quest-pure-ratio') {
      const ok = imperfection <= 0.15 && symmetry.symmetryIndex >= 70 && evaluation.errorCount === 0;
      return {
        ...q,
        completed: ok,
        progressText: `δ ${Math.round(imperfection * 100)}% · Sym ${symmetry.symmetryIndex}%`,
      };
    }

    if (q.id === 'quest-living-imperfection') {
      const ok =
        imperfection >= 0.25 ||
        foundation === 'fibonacci' ||
        foundation === 'golden-ratio';
      return {
        ...q,
        completed: ok,
        progressText:
          ok ? `Organic active (${foundation} · δ ${Math.round(imperfection * 100)}%)` : `δ ${Math.round(imperfection * 100)}% / 25%`,
      };
    }

    if (q.id === 'quest-codex-mix') {
      const ok = activeSteps.length >= 6 && distinctFm >= 2 && evaluation.errorCount === 0;
      return {
        ...q,
        completed: ok,
        progressText: `${activeSteps.length}/6 notes · ${distinctFm}/2 FM textures`,
      };
    }

    if (q.id === 'quest-algebra-formula') {
      const ok = dynamicFormulaCount >= 2 && activeSteps.length >= 4 && evaluation.errorCount === 0;
      return {
        ...q,
        completed: ok,
        progressText: `${Math.min(2, dynamicFormulaCount)}/2 algebra cells · ${evaluation.errorCount} errs`,
      };
    }

    // quest-octave-architecture
    const ok =
      activeSteps.length >= 6 &&
      pitchSpan >= 1.45 &&
      symmetry.symmetryIndex >= 58 &&
      evaluation.errorCount === 0;
    return {
      ...q,
      completed: ok,
      progressText: `${pitchSpan.toFixed(2)}× span · Sym ${symmetry.symmetryIndex}%`,
    };
  });
}

// ============================================================================
// INTERACTIVE MATH <-> SHAPE <-> FREQUENCY PROFILE FORMULA CATALOG (A1:F48)
// ============================================================================

export interface FormulaCatalogEntry {
  id: string;
  title: string;
  foundation: MathFoundationId;
  targetCol: SheetCol;
  artMode: ArtModeId;
  formula: string;
  equation: string;
  shapeLabel: string;
  shapeSummary: string;
  frequencyProfileLabel: string;
  frequencySummary: string;
  suggestedVoice: SynthVoiceId;
  recommendedImperfection: number;
}

export const FORMULA_CATALOG_ENTRIES: FormulaCatalogEntry[] = [
  {
    id: 'cat-pyth-fifths',
    title: 'Pythagorean 3:2 Fifths Ladder',
    foundation: 'pythagorean',
    targetCol: 'A',
    artMode: 'harmonograph',
    formula: '=A1*POW(2,MOD((ROW()-1)*7,12)/12)',
    equation: 'fₙ = A1 · 2^(((n−1)·7 mod 12)/12)',
    shapeLabel: '3:2 Closed Torus Knot',
    shapeSummary: 'Whole-number frequency ratios lock orbits into clean symmetric knot crossings.',
    frequencyProfileLabel: 'Just Fifths & Octaves (1:1 · 3:2 · 9:8)',
    frequencySummary: 'Locks pitch steps onto 7-semitone fifth cycles with crisp zero-beat resonance.',
    suggestedVoice: 'music-box',
    recommendedImperfection: 0,
  },
  {
    id: 'cat-pyth-triad',
    title: 'Just-Intonation Sacred Triad',
    foundation: 'pythagorean',
    targetCol: 'A',
    artMode: 'mandala',
    formula: '=A1*IF(MOD(ROW(),3)=1,1,IF(MOD(ROW(),3)=2,5/4,3/2))',
    equation: 'fₙ ∈ {1, 5/4, 3/2} · A1',
    shapeLabel: '3-Fold Chladni Mandala',
    shapeSummary: 'Repeats exact triangular symmetry every 3 steps for a pure 3-lobe nodal rosette.',
    frequencyProfileLabel: 'Pure Major Triad (4:5:6)',
    frequencySummary: 'Cycles through root, pure major third (5:4), and pure fifth (3:2) with zero beating.',
    suggestedVoice: 'celestial-chime',
    recommendedImperfection: 0,
  },
  {
    id: 'cat-sine-wave',
    title: 'Fourier Sine Crest Arpeggio',
    foundation: 'harmonic-sine',
    targetCol: 'A',
    artMode: 'ribbon',
    formula: '=A1*(1+0.5*ABS(SIN((ROW()-1)*PI/4)))',
    equation: 'fₙ = A1 · (1 + 0.5·|sin((n−1)π/4)|)',
    shapeLabel: '2π Sinusoidal Wave Ribbon',
    shapeSummary: 'Traces smooth bilateral arches whose radius & crest repeat cleanly every 8 rows.',
    frequencyProfileLabel: 'Continuous Octave-Fifth Arc (1.0×–1.5×)',
    frequencySummary: 'Glides fluidly between unison and pure fifths along a smooth half-sine curve.',
    suggestedVoice: 'analog-pluck',
    recommendedImperfection: 0.05,
  },
  {
    id: 'cat-sine-orbit',
    title: 'Quad-Lobe Breathing Orbit',
    foundation: 'harmonic-sine',
    targetCol: 'D',
    artMode: 'mandala',
    formula: '=ROUND(50+38*SIN(ROW()*PI/2))',
    equation: 'Rₙ = 50 + 38·sin(nπ/2)',
    shapeLabel: '4-Fold Standing Wave Petals',
    shapeSummary: 'Alternates inner and outer ring radii cleanly at 90° phase steps.',
    frequencyProfileLabel: '4-Beat Filter & Stereo Breath',
    frequencySummary: 'Couples spatial filter bloom to a periodic 4-step sinusoidal amplitude cycle.',
    suggestedVoice: 'haunted-organ',
    recommendedImperfection: 0.08,
  },
  {
    id: 'cat-sine-fm',
    title: 'Harmonic Sideband Swell',
    foundation: 'harmonic-sine',
    targetCol: 'C',
    artMode: 'ribbon',
    formula: '=1.2+2.6*ABS(SIN(ROW()*PI/4))',
    equation: 'Iₙ = 1.2 + 2.6·|sin(nπ/4)|',
    shapeLabel: 'Rippling FM Ribbon Envelope',
    shapeSummary: 'Expands waveform filament depth on wave peaks and narrows back to pure arcs.',
    frequencyProfileLabel: 'Spectral Brightness Sweep (1.2–3.8 I)',
    frequencySummary: 'Modulates high-frequency FM sidebands smoothly from warm sine to bright brass.',
    suggestedVoice: 'analog-pluck',
    recommendedImperfection: 0.06,
  },
  {
    id: 'cat-fib-spiral',
    title: 'Fibonacci Pisano Pitch Spiral',
    foundation: 'fibonacci',
    targetCol: 'A',
    artMode: 'pitch-spiral',
    formula: '=A1*POW(2,MOD(FIB(ROW()),12)/12)',
    equation: 'fₙ = A1 · 2^((Fₙ mod 12)/12)',
    shapeLabel: '137.5° Phyllotaxis Vortex',
    shapeSummary: 'Pairs recursive Fibonacci intervals with golden-angle radial dispersion like seeds.',
    frequencyProfileLabel: 'Recursive Interval Leaps (1·1·2·3·5·8)',
    frequencySummary: 'Maps the integer Fibonacci sequence mod-12 into ascending octave-folded leaps.',
    suggestedVoice: 'analog-pluck',
    recommendedImperfection: 0.14,
  },
  {
    id: 'cat-fib-gate',
    title: 'Fibonacci Syncopated Rests',
    foundation: 'fibonacci',
    targetCol: 'B',
    artMode: 'mandala',
    formula: '=IF(MOD(FIB(ROW()),4)=0,0,0.92)',
    equation: 'Gateₙ = 0 if 4|Fₙ else 0.92',
    shapeLabel: 'Negative-Space Floral Ring',
    shapeSummary: 'Carves rhythmic breathing gaps into petals so active harmonic spokes stand out.',
    frequencyProfileLabel: 'Euclidean Fibonacci Pulse Gate',
    frequencySummary: 'Turns every Pisano divisible-by-4 Fibonacci step into a sharp percussive rest.',
    suggestedVoice: 'music-box',
    recommendedImperfection: 0.12,
  },
  {
    id: 'cat-fib-fm',
    title: 'Fibonacci Overtone Blossom',
    foundation: 'fibonacci',
    targetCol: 'C',
    artMode: 'pitch-spiral',
    formula: '=1.4+MOD(FIB(ROW()),6)*0.55',
    equation: 'Iₙ = 1.4 + 0.55·(Fₙ mod 6)',
    shapeLabel: 'Flaring Corona Spoke Burst',
    shapeSummary: 'Emphasizes recursive Fibonacci numbers with bright radial corona flares.',
    frequencyProfileLabel: 'Accented Partial Cascades (1.4–4.1 I)',
    frequencySummary: 'Injects spiky upper harmonics onto steps aligned with Fₙ mod 6 surges.',
    suggestedVoice: 'celestial-chime',
    recommendedImperfection: 0.16,
  },
  {
    id: 'cat-phi-chime',
    title: 'Golden Ratio φ Spiral Lattice',
    foundation: 'golden-ratio',
    targetCol: 'A',
    artMode: 'pitch-spiral',
    formula: '=A1*POW(2,ROUND(MOD(ROW()*PHI,12))/12)',
    equation: 'fₙ = A1 · 2^(round(n·φ mod 12)/12)',
    shapeLabel: 'Quasi-Periodic Nautilus Lattice',
    shapeSummary: 'Irrational φ spacing prevents spokes from colliding, packing infinite spiral steps.',
    frequencyProfileLabel: 'Non-Repeating φ Melody (1.618×)',
    frequencySummary: 'Generates ever-evolving crystalline pitches that avoid short-loop fatigue.',
    suggestedVoice: 'celestial-chime',
    recommendedImperfection: 0.22,
  },
  {
    id: 'cat-phi-modratio',
    title: 'Inharmonic φ Bronze Bell',
    foundation: 'golden-ratio',
    targetCol: 'F',
    artMode: 'ribbon',
    formula: '=IF(MOD(ROW(),2)=0,PHI,INV_PHI)',
    equation: 'rₙ ∈ {φ ≈ 1.618, φ⁻¹ ≈ 0.618}',
    shapeLabel: 'Precessing Irrational Torus Weave',
    shapeSummary: 'Bends torus crossings off integer axes into dense, iridescent filigree loops.',
    frequencyProfileLabel: 'Bell/Chime Irrational Partials (φ & 1/φ)',
    frequencySummary: 'Alternates metallic bronze-bell overtones (1.618×) with warm sub-tones (0.618×).',
    suggestedVoice: 'celestial-chime',
    recommendedImperfection: 0.2,
  },
  {
    id: 'cat-phi-orbit',
    title: 'Golden-Angle Spatial Packing',
    foundation: 'golden-ratio',
    targetCol: 'D',
    artMode: 'mandala',
    formula: '=ROUND(52+36*COS(ROW()*GOLDEN_ANGLE))',
    equation: 'Rₙ = 52 + 36·cos(n·137.508°)',
    shapeLabel: 'Phyllotaxis Sunburst Mandala',
    shapeSummary: 'Rotates vertices by 137.508° each row for maximally even radial coverage.',
    frequencyProfileLabel: 'Natural Stereo & Resonance Spread',
    frequencySummary: 'Prevents neighboring steps from clustering in the same timbral/spatial register.',
    suggestedVoice: 'music-box',
    recommendedImperfection: 0.18,
  },
  {
    id: 'cat-organic-decay',
    title: 'Perturbed Living Breath',
    foundation: 'golden-ratio',
    targetCol: 'E',
    artMode: 'harmonograph',
    formula: '=ROUND(PERTURB(280+SIN(ROW()*INV_PHI)*90,0.24))',
    equation: 'τₙ = PERTURB(280 + 90·sin(n/φ), 0.24)',
    shapeLabel: 'Organic Coral Drift Contours',
    shapeSummary: 'Introduces deterministic golden-angle micro-drift so symmetry breathes organically.',
    frequencyProfileLabel: 'Humanized Envelope Tails (180–400 ms)',
    frequencySummary: 'Replaces robotic uniform note lengths with subtle living acoustic tail variations.',
    suggestedVoice: 'haunted-organ',
    recommendedImperfection: 0.35,
  },
];

export interface CatalogPreviewResult {
  vectorArt: VectorArtwork;
  minHz: number;
  maxHz: number;
  notesPreview: string[];
  ratioLabels: string[];
  sampleOutputs: Array<{ row: number; coord: string; value: number }>;
  fmProfile: number[];
}

export function previewCatalogEntryCurve(
  entry: FormulaCatalogEntry,
  rootHz = 261.63,
  imperfectionOverride?: number,
): CatalogPreviewResult {
  const safeRoot = Math.max(55, Math.min(880, Number.isFinite(rootHz) ? rootHz : 261.63));
  const rowCount = 8;
  const previewGrid: SheetRawGrid = {};

  for (let r = 1; r <= rowCount; r++) {
    previewGrid[`A${r}`] =
      r === 1 ? String(Math.round(safeRoot * 100) / 100) : '=A1*POW(2,MOD((ROW()-1)*7,12)/12)';
    previewGrid[`B${r}`] = '0.92';
    previewGrid[`C${r}`] = '1.8';
    previewGrid[`D${r}`] = String(36 + ((r - 1) % 4) * 14);
    previewGrid[`E${r}`] = '280';
    previewGrid[`F${r}`] = r % 2 === 0 ? '2' : '1.5';
  }

  for (let r = 1; r <= rowCount; r++) {
    if (entry.targetCol === 'A' && r === 1) continue;
    previewGrid[`${entry.targetCol}${r}`] = entry.formula;
  }

  const evalRes = evaluateSheet(previewGrid, rowCount);
  const delta = imperfectionOverride ?? entry.recommendedImperfection;
  const vectorArt = computeVectorCurve(evalRes.steps, entry.artMode, entry.foundation, delta);

  let minHz = Infinity;
  let maxHz = 0;
  const notesPreview: string[] = [];
  const fmProfile: number[] = [];

  for (const s of evalRes.steps) {
    if (s.gate > 0.02) {
      if (s.freqHz < minHz) minHz = s.freqHz;
      if (s.freqHz > maxHz) maxHz = s.freqHz;
      notesPreview.push(s.noteName);
    } else {
      notesPreview.push('REST');
    }
    const synth = mapMathToSynthParams(s, entry.foundation, delta);
    fmProfile.push(synth.effectiveFmIndex);
  }

  const sampleOutputs: Array<{ row: number; coord: string; value: number }> = [];
  const startRow = entry.targetCol === 'A' ? 2 : 1;
  for (let r = startRow; r < startRow + 4 && r <= rowCount; r++) {
    const coord = `${entry.targetCol}${r}`;
    sampleOutputs.push({
      row: r,
      coord,
      value: evalRes.cells[coord]?.value ?? 0,
    });
  }

  return {
    vectorArt,
    minHz: Number.isFinite(minHz) ? minHz : safeRoot,
    maxHz: maxHz > 0 ? maxHz : safeRoot,
    notesPreview: notesPreview.slice(0, 6),
    ratioLabels: vectorArt.symmetry.stepRatios.slice(0, 4).map((m) => `${m.p}:${m.q}`),
    sampleOutputs,
    fmProfile,
  };
}

export interface CatalogInjectionResult {
  nextGrid: SheetRawGrid;
  injectedCoords: string[];
  notice: string;
  primaryCoord: string;
}

export function injectCatalogFormulaIntoGrid(
  currentGrid: SheetRawGrid,
  entry: FormulaCatalogEntry,
  options: {
    mode: 'cell' | 'column' | 'range';
    selectedCoord: string;
    rowCount: number;
    startRow?: number;
    endRow?: number;
    useExactSelectedCell?: boolean;
  },
): CatalogInjectionResult {
  const nextGrid: SheetRawGrid = { ...currentGrid };
  const parsed = /^([A-F])(\d+)$/i.exec(options.selectedCoord.trim());
  const selectedCol = (parsed ? parsed[1].toUpperCase() : entry.targetCol) as SheetCol;
  const selectedRow = parsed ? Math.max(1, Math.min(48, Number(parsed[2]))) : 2;
  const safeRowCount = Math.max(1, Math.min(48, options.rowCount));
  const injectedCoords: string[] = [];

  if (options.mode === 'cell') {
    const targetCol = options.useExactSelectedCell ? selectedCol : entry.targetCol;
    let targetRow = selectedRow;
    // Prevent A1 circular self-reference if formula depends on A1
    const dependsOnA1 = /\bA1\b/i.test(entry.formula);
    let skippedA1Anchor = false;
    if (targetCol === 'A' && targetRow === 1 && dependsOnA1) {
      targetRow = 2;
      skippedA1Anchor = true;
    }
    const coord = `${targetCol}${targetRow}`;
    nextGrid[coord] = entry.formula;
    injectedCoords.push(coord);
    return {
      nextGrid,
      injectedCoords,
      primaryCoord: coord,
      notice: skippedA1Anchor
        ? `Injected "${entry.title}" into ${coord} (preserved A1 as the numeric root frequency anchor).`
        : `Injected "${entry.title}" formula into cell ${coord}.`,
    };
  }

  const start =
    options.mode === 'range'
      ? Math.max(1, Math.min(48, options.startRow ?? 1))
      : entry.targetCol === 'A' && /\bA1\b/i.test(entry.formula)
        ? 2
        : 1;
  const end =
    options.mode === 'range'
      ? Math.max(start, Math.min(48, options.endRow ?? safeRowCount))
      : safeRowCount;

  const dependsOnA1 = /\bA1\b/i.test(entry.formula);
  for (let r = start; r <= end; r++) {
    if (entry.targetCol === 'A' && r === 1 && dependsOnA1) {
      if (!nextGrid.A1 || nextGrid.A1.startsWith('=')) {
        nextGrid.A1 = '261.63';
      }
      continue;
    }
    const coord = `${entry.targetCol}${r}`;
    nextGrid[coord] = entry.formula;
    injectedCoords.push(coord);
  }

  if (injectedCoords.length === 0) {
    const fallbackCoord = `${entry.targetCol}${entry.targetCol === 'A' ? 2 : 1}`;
    nextGrid[fallbackCoord] = entry.formula;
    injectedCoords.push(fallbackCoord);
  }

  const first = injectedCoords[0];
  const last = injectedCoords[injectedCoords.length - 1];
  return {
    nextGrid,
    injectedCoords,
    primaryCoord: first,
    notice: `Injected "${entry.title}" into ${first}${first !== last ? `:${last}` : ''} (${injectedCoords.length} cells).`,
  };
}

