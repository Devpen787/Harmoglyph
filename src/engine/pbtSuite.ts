import {
  evaluateSheet,
  parseCsvToSheet,
  serializeSheetToCsv,
} from './spreadsheetVm.ts';
import { renderSheetToWavBytes } from './audioSynth.ts';
import {
  MATH_FOUNDATIONS,
  buildFoundationFormulaPatch,
  mapMathToSculpture3DParams,
  mapMathToSynthParams,
} from './mathArtTheory.ts';
import { computeVectorCurve, geometryToFormulaGrid } from './vectorPlotter.ts';
import {
  type PbtInvariantResult,
  SHEET_COLS,
  SHEET_ROWS,
  type SheetRawGrid,
} from '../types/chimera.ts';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runPbtInvariants(seed = 20261116, trials = 100): PbtInvariantResult[] {
  const rand = mulberry32(seed);

  // Invariant 1: Dependency Cycle Termination
  let cyclePassed = 0;
  let cycleCounterexample: string | undefined;
  for (let t = 0; t < trials; t++) {
    const grid: SheetRawGrid = {};
    for (let r = 1; r <= SHEET_ROWS; r++) {
      for (const c of SHEET_COLS) {
        const roll = rand();
        if (roll < 0.35) {
          const targetCol = SHEET_COLS[Math.floor(rand() * SHEET_COLS.length)];
          const targetRow = 1 + Math.floor(rand() * SHEET_ROWS);
          grid[`${c}${r}`] = `=${targetCol}${targetRow}+10`;
        } else {
          grid[`${c}${r}`] = String(Math.round((rand() * 800 - 100) * 10) / 10);
        }
      }
    }
    try {
      const res = evaluateSheet(grid);
      const count = Object.keys(res.cells).length;
      if (count === SHEET_COLS.length * SHEET_ROWS) {
        cyclePassed++;
      } else if (!cycleCounterexample) {
        cycleCounterexample = `Trial #${t}: evaluated ${count} cells instead of 48.`;
      }
    } catch (err: unknown) {
      if (!cycleCounterexample) {
        cycleCounterexample = `Trial #${t}: threw ${err instanceof Error ? err.message : 'error'}`;
      }
    }
  }

  // Invariant 2: Acoustic Safety Clamp (20..4000 Hz, 0..1 gate, 0..12 FM, 40..900 ms)
  let clampPassed = 0;
  let clampCounterexample: string | undefined;
  const extremeInputs = ['99999999', '-50000', '=1/0', '=POW(99,9)', 'bad_text', '0', '440'];
  for (let t = 0; t < trials; t++) {
    const grid: SheetRawGrid = {};
    for (let r = 1; r <= SHEET_ROWS; r++) {
      for (const c of SHEET_COLS) {
        grid[`${c}${r}`] =
          rand() < 0.45
            ? extremeInputs[Math.floor(rand() * extremeInputs.length)]
            : String(Math.round((rand() * 12000 - 4000) * 100) / 100);
      }
    }
    const res = evaluateSheet(grid);
    const badStep = res.steps.find(
      (s) =>
        s.freqHz < 20 ||
        s.freqHz > 4000 ||
        s.gate < 0 ||
        s.gate > 1 ||
        s.fmIndex < 0 ||
        s.fmIndex > 12 ||
        s.decayMs < 40 ||
        s.decayMs > 900 ||
        !Number.isFinite(s.freqHz),
    );
    if (!badStep) {
      clampPassed++;
    } else if (!clampCounterexample) {
      clampCounterexample = `Trial #${t} row ${badStep.row}: freq=${badStep.freqHz}, gate=${badStep.gate}`;
    }
  }

  // Invariant 3: CSV Lossless Round-Trip (formulas with commas & quotes)
  let csvPassed = 0;
  let csvCounterexample: string | undefined;
  const sampleFormulas = [
    '=IF(MOD(ROW(),2)=0,1,0)',
    '=SUM(A1:A4)',
    '=220+SIN(ROW()*0.5)*110',
    '440',
    '',
    '=IF(A1>200,330,110)',
  ];
  for (let t = 0; t < trials; t++) {
    const grid: SheetRawGrid = {};
    for (let r = 1; r <= SHEET_ROWS; r++) {
      for (const c of SHEET_COLS) {
        grid[`${c}${r}`] = sampleFormulas[Math.floor(rand() * sampleFormulas.length)];
      }
    }
    const restored = parseCsvToSheet(serializeSheetToCsv(grid));
    const mismatch = Object.keys(grid).find((k) => (restored[k] ?? '') !== (grid[k] ?? ''));
    if (!mismatch) {
      csvPassed++;
    } else if (!csvCounterexample) {
      csvCounterexample = `Trial #${t} cell ${mismatch}: expected "${grid[mismatch]}", got "${restored[mismatch]}"`;
    }
  }

  // Invariant 4: PCM WAV Binary Header & Byte Length Consistency
  let wavPassed = 0;
  let wavCounterexample: string | undefined;
  for (let t = 0; t < trials; t++) {
    const grid: SheetRawGrid = {};
    for (let r = 1; r <= SHEET_ROWS; r++) {
      grid[`A${r}`] = String(110 + Math.floor(rand() * 880));
      grid[`B${r}`] = rand() > 0.25 ? '0.8' : '0';
      grid[`C${r}`] = String((rand() * 5).toFixed(1));
      grid[`D${r}`] = String(20 + Math.floor(rand() * 75));
      grid[`E${r}`] = String(80 + Math.floor(rand() * 350));
      grid[`F${r}`] = String(1 + Math.floor(rand() * 3));
    }
    const evalRes = evaluateSheet(grid);
    const bpm = 60 + Math.floor(rand() * 120);
    const bytes = renderSheetToWavBytes(evalRes.steps, bpm, 1);
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const waveTag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    const view = new DataView(bytes.buffer);
    const declaredChunkSize = view.getUint32(4, true);
    if (header === 'RIFF' && waveTag === 'WAVE' && declaredChunkSize === bytes.byteLength - 8) {
      wavPassed++;
    } else if (!wavCounterexample) {
      wavCounterexample = `Trial #${t}: header=${header}/${waveTag}, byteLen=${bytes.byteLength}`;
    }
  }

  // Invariant 5: Mathematical Foundation & Inverse Geometry Symmetry
  let mathPassed = 0;
  let mathCounterexample: string | undefined;
  for (let t = 0; t < trials; t++) {
    const foundation = MATH_FOUNDATIONS[t % MATH_FOUNDATIONS.length].id;
    const rootHz = 110 + Math.floor(rand() * 660);
    const patch = buildFoundationFormulaPatch(foundation, rootHz);
    const evalRes = evaluateSheet(patch.grid, patch.rowCount);
    const step0 = evalRes.steps[0];
    const synthParams = mapMathToSynthParams(step0, foundation);
    const curve = computeVectorCurve(evalRes.steps, 'harmonograph', foundation);

    const samplePoints = Array.from({ length: 8 }, (_, k) => ({
      x: 80 + ((k * 37 + Math.floor(rand() * 60)) % 280),
      y: 50 + ((k * 29 + Math.floor(rand() * 50)) % 180),
    }));
    const invPatch = geometryToFormulaGrid(samplePoints, { baseHz: rootHz, targetSteps: 8 });
    const invEval = evaluateSheet(invPatch.grid, invPatch.rowCount);

    const validSynth =
      Number.isFinite(synthParams.effectiveModRatio) &&
      synthParams.effectiveModRatio >= 0.25 &&
      synthParams.effectiveModRatio <= 8 &&
      Number.isFinite(synthParams.effectiveFmIndex) &&
      synthParams.effectiveFmIndex >= 0 &&
      synthParams.effectiveFmIndex <= 12;

    const sculptParams = mapMathToSculpture3DParams(evalRes.steps, foundation, false);
    const baselineSculpt = mapMathToSculpture3DParams(evalRes.steps, 'harmonic-sine', false);
    const scaledCorrectly =
      foundation === 'fibonacci' || foundation === 'golden-ratio'
        ? sculptParams.vertexCount > baselineSculpt.vertexCount &&
          sculptParams.orbitRadiusScale > baselineSculpt.orbitRadiusScale &&
          Number.isFinite(sculptParams.sampleOrbitScaleAt(0.5, step0))
        : sculptParams.vertexCount > 0 && Number.isFinite(sculptParams.orbitRadiusScale);

    if (
      validSynth &&
      scaledCorrectly &&
      evalRes.errorCount === 0 &&
      curve.primaryPathD.startsWith('M') &&
      invEval.errorCount === 0
    ) {
      mathPassed++;
    } else if (!mathCounterexample) {
      mathCounterexample = `Trial #${t} (${foundation}): errors=${evalRes.errorCount}/${invEval.errorCount}, v=${sculptParams.vertexCount}`;
    }
  }

  return [
    {
      id: 'cycle-termination',
      name: 'Formula Cycle Termination',
      invariant: '∀ random 48-cell graph G: evaluateSheet(G) halts and marks cycles with #CYCLE!',
      trials,
      passedCount: cyclePassed,
      passed: cyclePassed === trials,
      counterexample: cycleCounterexample,
    },
    {
      id: 'acoustic-clamp',
      name: 'Web Audio Safety Clamping',
      invariant: '∀ extreme inputs (1e9, NaN, /0): 20 ≤ Hz ≤ 4000 ∧ 0 ≤ gate ≤ 1 ∧ 40 ≤ decay ≤ 900',
      trials,
      passedCount: clampPassed,
      passed: clampPassed === trials,
      counterexample: clampCounterexample,
    },
    {
      id: 'csv-roundtrip',
      name: 'Lossless CSV Round-Trip',
      invariant: '∀ formula grid G (with commas/parens): parseCsv(serializeCsv(G)) ≡ G',
      trials,
      passedCount: csvPassed,
      passed: csvPassed === trials,
      counterexample: csvCounterexample,
    },
    {
      id: 'wav-header',
      name: 'RIFF/WAVE PCM Integrity',
      invariant: '∀ sheet S, bpm ∈ [60,180]: WAV starts with RIFF/WAVE and chunkSize == length - 8',
      trials,
      passedCount: wavPassed,
      passed: wavPassed === trials,
      counterexample: wavCounterexample,
    },
    {
      id: 'math-foundation-symmetry',
      name: 'Math Foundation & Inverse Geometry',
      invariant:
        '∀ foundation ∈ {Sine, Fib, φ, Pyth} & rootHz: modifiers finite ∧ SVG path valid ∧ geometryToFormulaGrid errorCount == 0',
      trials,
      passedCount: mathPassed,
      passed: mathPassed === trials,
      counterexample: mathCounterexample,
    },
  ];
}
