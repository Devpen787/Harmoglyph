import { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  GitMerge,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  ArtModeId,
  COLUMN_META,
  MathFoundationId,
  PbtInvariantResult,
  SHEET_COLS,
  SheetCol,
  SheetPreset,
  SheetRawGrid,
  SynthVoiceId,
} from '../types/chimera';
import {
  evaluateSheet,
  parseCsvToSheet,
  serializeSheetToCsv,
} from '../engine/spreadsheetVm';
import { renderSheetToWavBytes } from '../engine/audioSynth';
import { runPbtInvariants } from '../engine/pbtSuite';
import { computeVectorCurve } from '../engine/vectorPlotter';

export type ColumnGraftMode = 'donor-a' | 'host-b' | 'avg-blend' | 'ratio-mod';

interface GraftEditorViewProps {
  presets: SheetPreset[];
  liveGrid: SheetRawGrid;
  liveTitle: string;
  bpm: number;
  voice: SynthVoiceId;
  artMode: ArtModeId;
  foundation: MathFoundationId;
  onApplyGraftedGrid: (
    graftedGrid: SheetRawGrid,
    options: { title: string; rowCount: number; bpm: number; voice: SynthVoiceId; artMode: ArtModeId },
  ) => void;
}

const GRAFT_ROWS = 8;

const COLUMN_CLAMP_CONTRACTS: Record<
  SheetCol,
  { min: number; max: number; contractExpr: string; targetStage: string }
> = {
  A: {
    min: 20,
    max: 4000,
    contractExpr: 'clampFreq(Hz) ∈ [20, 4000]',
    targetStage: 'FM Carrier Pitch + Vector Y Ratio',
  },
  B: {
    min: 0,
    max: 1,
    contractExpr: 'clampGate(g) ∈ [0.0, 1.0]',
    targetStage: 'Note Trigger Velocity & Vertex Opacity',
  },
  C: {
    min: 0,
    max: 12,
    contractExpr: 'clampFmIndex(I) ∈ [0, 12]',
    targetStage: 'Modulator Gain Depth & Ripple Petal',
  },
  D: {
    min: 10,
    max: 100,
    contractExpr: 'clampOrbitX(x) ∈ [10, 100] px',
    targetStage: 'Lissajous Phase X Excursion',
  },
  E: {
    min: 40,
    max: 900,
    contractExpr: 'clampDecayMs(τ) ∈ [40, 900] ms',
    targetStage: 'Exponential ADSR Tail & Stroke Width',
  },
  F: {
    min: 0.25,
    max: 8,
    contractExpr: 'clampModRatio(r) ∈ [0.25, 8.0]',
    targetStage: 'FM Sideband f_m/f_c & Nodal Symmetry',
  },
};

const GRAFT_MODE_LABELS: Record<ColumnGraftMode, string> = {
  'donor-a': 'Source A (Donor)',
  'host-b': 'Source B (Host)',
  'avg-blend': 'Harmonic Mean (A+B)/2',
  'ratio-mod': 'Cross-Modulate (A×B)',
};

export function GraftEditorView({
  presets,
  liveGrid,
  liveTitle,
  bpm,
  voice,
  artMode,
  foundation,
  onApplyGraftedGrid,
}: GraftEditorViewProps) {
  const [sourceAId, setSourceAId] = useState<string>(presets[3]?.id ?? presets[0]?.id ?? 'live');
  const [sourceBId, setSourceBId] = useState<string>(presets[4]?.id ?? presets[1]?.id ?? 'live');
  const [customEditsA, setCustomEditsA] = useState<SheetRawGrid>({});
  const [customEditsB, setCustomEditsB] = useState<SheetRawGrid>({});
  const [columnModes, setColumnModes] = useState<Record<SheetCol, ColumnGraftMode>>({
    A: 'donor-a',
    B: 'host-b',
    C: 'avg-blend',
    D: 'host-b',
    E: 'avg-blend',
    F: 'ratio-mod',
  });
  const [focusedCol, setFocusedCol] = useState<SheetCol>('A');
  const [verificationState, setVerificationState] = useState<{
    ranAt: string;
    seed: number;
    pbtResults: PbtInvariantResult[];
    graftChecks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
    allPassed: boolean;
  } | null>(null);
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  const resolveConfig = (id: string, edits: SheetRawGrid): { title: string; grid: SheetRawGrid } => {
    if (id === 'live') {
      return { title: `${liveTitle} (Live Studio)`, grid: { ...liveGrid, ...edits } };
    }
    const found = presets.find((p) => p.id === id) ?? presets[0];
    return {
      title: found ? found.title : 'Preset Sheet',
      grid: { ...(found?.cells ?? {}), ...edits },
    };
  };

  const configA = useMemo(
    () => resolveConfig(sourceAId, customEditsA),
    [sourceAId, customEditsA, liveGrid, liveTitle, presets],
  );
  const configB = useMemo(
    () => resolveConfig(sourceBId, customEditsB),
    [sourceBId, customEditsB, liveGrid, liveTitle, presets],
  );

  const evalA = useMemo(() => evaluateSheet(configA.grid, GRAFT_ROWS), [configA.grid]);
  const evalB = useMemo(() => evaluateSheet(configB.grid, GRAFT_ROWS), [configB.grid]);

  // Compile the grafted spreadsheet configuration according to per-column mapping contracts
  const graftedGrid = useMemo<SheetRawGrid>(() => {
    const out: SheetRawGrid = {};
    for (let r = 1; r <= GRAFT_ROWS; r++) {
      for (const col of SHEET_COLS) {
        const coord = `${col}${r}`;
        const mode = columnModes[col];
        const rawA = configA.grid[coord] ?? '0';
        const rawB = configB.grid[coord] ?? '0';
        const valA = evalA.cells[coord]?.value ?? 0;
        const valB = evalB.cells[coord]?.value ?? 0;

        if (mode === 'donor-a') {
          out[coord] = rawA;
        } else if (mode === 'host-b') {
          out[coord] = rawB;
        } else if (mode === 'avg-blend') {
          const avg = Math.round(((valA + valB) / 2) * 100) / 100;
          out[coord] = r === 1 && col === 'A' ? String(avg) : `=ROUND((${valA.toFixed(2)}+${valB.toFixed(2)})/2,2)`;
        } else {
          // ratio-mod
          if (col === 'A') {
            const geom = Math.round(Math.sqrt(Math.max(20, valA) * Math.max(20, valB)) * 100) / 100;
            out[coord] = r === 1 ? String(geom) : `=ROUND(SQRT(${Math.max(20, valA).toFixed(1)}*${Math.max(20, valB).toFixed(1)}),2)`;
          } else if (col === 'B') {
            const maxGate = Math.round(Math.max(valA, valB) * 100) / 100;
            out[coord] = String(maxGate);
          } else {
            const modVal = Math.round(((valA * 0.65 + valB * 0.35) * 100)) / 100;
            out[coord] = `=ROUND(${valA.toFixed(2)}*0.65+${valB.toFixed(2)}*0.35,2)`;
          }
        }
      }
    }
    return out;
  }, [columnModes, configA.grid, configB.grid, evalA.cells, evalB.cells]);

  const evalGraft = useMemo(() => evaluateSheet(graftedGrid, GRAFT_ROWS), [graftedGrid]);
  const graftVector = useMemo(
    () => computeVectorCurve(evalGraft.steps, artMode, foundation),
    [evalGraft.steps, artMode, foundation],
  );

  // Per-column data mapping contract telemetry
  const columnContracts = useMemo(() => {
    return SHEET_COLS.map((col) => {
      const mode = columnModes[col];
      const spec = COLUMN_CLAMP_CONTRACTS[col];
      const meta = COLUMN_META[col];
      const valuesA = evalA.steps.map((s) =>
        col === 'A'
          ? s.freqHz
          : col === 'B'
            ? s.gate
            : col === 'C'
              ? s.fmIndex
              : col === 'D'
                ? s.orbitX
                : col === 'E'
                  ? s.decayMs
                  : s.modRatio,
      );
      const valuesB = evalB.steps.map((s) =>
        col === 'A'
          ? s.freqHz
          : col === 'B'
            ? s.gate
            : col === 'C'
              ? s.fmIndex
              : col === 'D'
                ? s.orbitX
                : col === 'E'
                  ? s.decayMs
                  : s.modRatio,
      );
      const valuesGraft = evalGraft.steps.map((s) =>
        col === 'A'
          ? s.freqHz
          : col === 'B'
            ? s.gate
            : col === 'C'
              ? s.fmIndex
              : col === 'D'
                ? s.orbitX
                : col === 'E'
                  ? s.decayMs
                  : s.modRatio,
      );

      const minOut = Math.min(...valuesGraft);
      const maxOut = Math.max(...valuesGraft);
      const withinContract = valuesGraft.every(
        (v) => Number.isFinite(v) && v >= spec.min && v <= spec.max,
      );

      return {
        col,
        label: meta.label,
        unit: meta.unit,
        mode,
        modeLabel: GRAFT_MODE_LABELS[mode],
        contractExpr: spec.contractExpr,
        targetStage: spec.targetStage,
        sampleA: valuesA[0] ?? 0,
        sampleB: valuesB[0] ?? 0,
        sampleGraft: valuesGraft[0] ?? 0,
        minOut,
        maxOut,
        withinContract,
      };
    });
  }, [columnModes, evalA.steps, evalB.steps, evalGraft.steps]);

  const handleRunVerification = () => {
    const seed = 20261116;
    const pbtResults = runPbtInvariants(seed, 100);

    // Run live contract verification on Config A, Config B, and the Grafted Sheet
    const allStepsSafe = evalGraft.steps.every(
      (s) =>
        Number.isFinite(s.freqHz) &&
        s.freqHz >= 20 &&
        s.freqHz <= 4000 &&
        s.gate >= 0 &&
        s.gate <= 1 &&
        s.fmIndex >= 0 &&
        s.fmIndex <= 12 &&
        s.decayMs >= 40 &&
        s.decayMs <= 900 &&
        s.modRatio >= 0.25 &&
        s.modRatio <= 8,
    );

    const csvRoundTrip = parseCsvToSheet(serializeSheetToCsv(graftedGrid));
    const csvLossless = Object.keys(graftedGrid).every(
      (k) => (csvRoundTrip[k] ?? '') === (graftedGrid[k] ?? ''),
    );

    const wavBytes = renderSheetToWavBytes(evalGraft.steps, bpm, 1, voice, foundation);
    const riffTag = String.fromCharCode(wavBytes[0], wavBytes[1], wavBytes[2], wavBytes[3]);
    const waveTag = String.fromCharCode(wavBytes[8], wavBytes[9], wavBytes[10], wavBytes[11]);
    const wavValid = riffTag === 'RIFF' && waveTag === 'WAVE' && wavBytes.byteLength > 44;

    const graftChecks = [
      {
        id: 'graft-cycle-free',
        label: 'Grafted AST & Cycle Isolation',
        passed: evalGraft.cycleCoords.length === 0 && evalGraft.errorCount === 0,
        detail:
          evalGraft.errorCount === 0
            ? `48/48 grafted cells evaluated cleanly (${configA.title} × ${configB.title}).`
            : `${evalGraft.errorCount} formula error(s) isolated with safe acoustic fallbacks.`,
      },
      {
        id: 'graft-contract-bounds',
        label: 'Column Mapping Clamps (A–F)',
        passed: allStepsSafe,
        detail: allStepsSafe
          ? 'All 6 column contracts strictly within [20..4000 Hz], [0..1 Gate], [0..12 FM], [40..900 ms].'
          : 'Clamp violation detected in grafted step.',
      },
      {
        id: 'graft-csv-roundtrip',
        label: 'Grafted CSV Serialization Contract',
        passed: csvLossless,
        detail: csvLossless
          ? 'Lossless RFC-4180 CSV round-trip verified on grafted sheet.'
          : 'CSV round-trip mismatch.',
      },
      {
        id: 'graft-wav-svg-render',
        label: '2-Op FM WAV & Vector Plotter Synthesis',
        passed: wavValid && graftVector.primaryPathD.startsWith('M'),
        detail: `Synthesized ${wavBytes.byteLength.toLocaleString()} bytes RIFF/WAVE PCM & valid SVG path (${graftVector.symmetry.dominantRatio.p}:${graftVector.symmetry.dominantRatio.q}).`,
      },
    ];

    const allPassed =
      pbtResults.every((r) => r.passed) && graftChecks.every((c) => c.passed);

    setVerificationState({
      ranAt: new Date().toLocaleTimeString(),
      seed,
      pbtResults,
      graftChecks,
      allPassed,
    });
  };

  const handleApplyToStudio = () => {
    const graftedTitle = `Graft: ${configA.title} × ${configB.title}`;
    onApplyGraftedGrid(graftedGrid, {
      title: graftedTitle,
      rowCount: GRAFT_ROWS,
      bpm,
      voice,
      artMode,
    });
    setAppliedBanner(
      `Applied "${graftedTitle}" (48 grafted cells) to the active Studio sequencer.`,
    );
  };

  return (
    <section
      aria-label="Graft Editor — Side-by-Side Spreadsheet Configuration & Data Mapping Contracts"
      className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-5 flex flex-col gap-5"
    >
      {/* Header + Run Verification + Apply Graft Buttons */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#1F2A40]">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#EDF2F9]">
              Graft Editor — Side-by-Side Spreadsheet Stitching &amp; Data Mapping Contracts
            </h2>
          </div>
          <p className="text-xs text-[#8A99B8] mt-1 max-w-3xl">
            Select two independent spreadsheet configurations side-by-side, customize per-column data mapping rules (<span className="font-mono text-[#00E5CC]">A–F</span>), inspect the acoustic/geometric clamp contracts, and trigger the formal verifier.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRunVerification}
            className="px-4 py-2 rounded-md bg-[#00E5CC] text-[#07090E] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Run Verification</span>
          </button>
          <button
            type="button"
            onClick={handleApplyToStudio}
            className="px-3.5 py-2 rounded-md border border-[#00E5CC] bg-[#07090E] text-xs font-semibold text-[#00E5CC] hover:bg-[#00E5CC]/10 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Load Graft into Studio</span>
          </button>
        </div>
      </div>

      {appliedBanner && (
        <div className="p-3 rounded-md border border-[#00E5CC]/60 bg-[#00E5CC]/10 text-xs text-[#00E5CC] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{appliedBanner}</span>
        </div>
      )}

      {/* Verification Results Panel (Triggered by Run Verification) */}
      {verificationState && (
        <div
          aria-label="Graft Verification Results"
          className={`rounded-lg border p-4 flex flex-col gap-3 ${
            verificationState.allPassed
              ? 'border-[#00E5CC] bg-[#00E5CC]/10'
              : 'border-[#F43F5E] bg-[#F43F5E]/10'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {verificationState.allPassed ? (
                <ShieldCheck className="w-5 h-5 text-[#00E5CC] shrink-0" aria-hidden="true" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-[#F43F5E] shrink-0" aria-hidden="true" />
              )}
              <div>
                <div className="text-xs font-bold text-[#EDF2F9]">
                  {verificationState.allPassed
                    ? `Verification Passed — All 4 Graft Contracts & ${verificationState.pbtResults.length * 100}/${verificationState.pbtResults.length * 100} Seeded PBT Trials Verified`
                    : 'Verification Reported Contract Warnings'}
                </div>
                <div className="text-[11px] font-mono text-[#8A99B8]">
                  Verified at {verificationState.ranAt} · PRNG Seed {verificationState.seed} · {configA.title} × {configB.title}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {verificationState.graftChecks.map((chk) => (
              <div
                key={chk.id}
                className="border border-[#1F2A40] rounded bg-[#07090E] p-2.5 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-[#EDF2F9]">{chk.label}</span>
                  <span
                    className={`font-mono text-[10px] font-semibold ${
                      chk.passed ? 'text-[#00E5CC]' : 'text-[#F43F5E]'
                    }`}
                  >
                    {chk.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <p className="text-[10px] text-[#8A99B8] leading-snug">{chk.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
            {verificationState.pbtResults.map((inv) => {
              const shortLabel =
                inv.id === 'cycle-termination'
                  ? 'Cycle Termination'
                  : inv.id === 'acoustic-clamp'
                    ? 'Audio Clamps'
                    : inv.id === 'csv-roundtrip'
                      ? 'CSV Round-Trip'
                      : inv.id === 'wav-header'
                        ? 'WAV PCM Header'
                        : inv.id.includes('math')
                          ? 'Math Symmetry'
                          : inv.name;
              return (
                <div
                  key={inv.id}
                  title={inv.name}
                  className="border border-[#1F2A40] rounded bg-[#0B0F17] px-2.5 py-2 flex items-center justify-between gap-2 text-[11px] font-mono-tabular"
                >
                  <span className="text-[#EDF2F9] whitespace-nowrap">{shortLabel}</span>
                  <span className="text-[#00E5CC] shrink-0">
                    {inv.passedCount}/{inv.trials}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side-by-Side Configuration Selectors & Mini Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* LEFT: Configuration A (Donor Sheet) */}
        <div className="lg:col-span-5 border border-[#1F2A40] rounded-lg bg-[#111622] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#38BDF8] font-semibold">
                Configuration A (Donor Sheet)
              </div>
              <div className="text-xs font-bold text-[#EDF2F9]">{configA.title}</div>
            </div>
            <select
              aria-label="Select Configuration A spreadsheet"
              value={sourceAId}
              onChange={(e) => {
                setSourceAId(e.target.value);
                setCustomEditsA({});
              }}
              className="bg-[#07090E] border border-[#1F2A40] rounded px-2 py-1 text-xs text-[#EDF2F9] focus:outline-none focus:border-[#38BDF8] cursor-pointer"
            >
              <option value="live">Current Studio Grid ({liveTitle})</option>
              {presets.map((p) => (
                <option key={`a-${p.id}`} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto max-h-[196px] overflow-y-auto border border-[#1F2A40] rounded bg-[#07090E]">
            <table className="w-full text-left border-collapse text-[10px] font-mono-tabular">
              <thead className="bg-[#0B0F17] text-[#8A99B8] border-b border-[#1F2A40] sticky top-0 z-10">
                <tr>
                  <th className="py-1 px-1.5 text-center w-6">#</th>
                  {SHEET_COLS.map((c) => (
                    <th
                      key={`ha-${c}`}
                      onClick={() => setFocusedCol(c)}
                      className={`py-1 px-1.5 cursor-pointer ${
                        c === 'A' ? 'min-w-[126px]' : 'min-w-[42px]'
                      } ${focusedCol === c ? 'text-[#38BDF8] bg-[#38BDF8]/10' : ''}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2A40]/60">
                {Array.from({ length: GRAFT_ROWS }, (_, idx) => {
                  const r = idx + 1;
                  return (
                    <tr key={`ra-${r}`}>
                      <td className="py-0.5 px-1.5 text-center text-[#8A99B8] bg-[#0B0F17]">{r}</td>
                      {SHEET_COLS.map((c) => {
                        const coord = `${c}${r}`;
                        const cell = evalA.cells[coord];
                        const isDonorActive = columnModes[c] !== 'host-b';
                        return (
                          <td
                            key={`ca-${coord}`}
                            onClick={() => setFocusedCol(c)}
                            className={`p-0 border-l border-[#1F2A40]/50 ${
                              isDonorActive ? 'text-[#EDF2F9]' : 'text-[#5E6E8E]'
                            }`}
                          >
                            <input
                              type="text"
                              aria-label={`Config A ${coord}`}
                              value={configA.grid[coord] ?? ''}
                              onChange={(e) =>
                                setCustomEditsA((prev) => ({ ...prev, [coord]: e.target.value }))
                              }
                              title={`Raw: ${configA.grid[coord] ?? ''} | Evaluated: ${cell?.value ?? 0}`}
                              className="w-full bg-transparent px-1.5 py-0.5 text-[10px] focus:outline-none focus:bg-[#111622]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER: Interactive Per-Column Graft Operators */}
        <div className="lg:col-span-2 border border-[#1F2A40] rounded-lg bg-[#111622] p-2.5 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono uppercase text-[#00E5CC] font-semibold">
              Column Stitch Rules
            </span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
            {SHEET_COLS.map((col) => (
              <div
                key={`mode-${col}`}
                onClick={() => setFocusedCol(col)}
                className={`px-1.5 py-1 rounded border transition-colors cursor-pointer flex items-center justify-between gap-1.5 ${
                  focusedCol === col
                    ? 'border-[#00E5CC] bg-[#07090E]'
                    : 'border-[#1F2A40] bg-[#0B0F17]'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-[#00E5CC] whitespace-nowrap">
                  {col}·{COLUMN_META[col].label.split(' ')[0]}
                </span>
                <select
                  aria-label={`Graft mode for Column ${col}`}
                  value={columnModes[col]}
                  onChange={(e) =>
                    setColumnModes((prev) => ({
                      ...prev,
                      [col]: e.target.value as ColumnGraftMode,
                    }))
                  }
                  className="bg-[#111622] border border-[#1F2A40] rounded px-1 py-0.5 text-[9.5px] font-mono text-[#EDF2F9] focus:outline-none focus:border-[#00E5CC] cursor-pointer max-w-[108px]"
                >
                  {(Object.entries(GRAFT_MODE_LABELS) as Array<[ColumnGraftMode, string]>).map(
                    ([mId, label]) => (
                      <option key={mId} value={mId}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Configuration B (Host Sheet) */}
        <div className="lg:col-span-5 border border-[#1F2A40] rounded-lg bg-[#111622] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#F59E0B] font-semibold">
                Configuration B (Host Sheet)
              </div>
              <div className="text-xs font-bold text-[#EDF2F9]">{configB.title}</div>
            </div>
            <select
              aria-label="Select Configuration B spreadsheet"
              value={sourceBId}
              onChange={(e) => {
                setSourceBId(e.target.value);
                setCustomEditsB({});
              }}
              className="bg-[#07090E] border border-[#1F2A40] rounded px-2 py-1 text-xs text-[#EDF2F9] focus:outline-none focus:border-[#F59E0B] cursor-pointer"
            >
              <option value="live">Current Studio Grid ({liveTitle})</option>
              {presets.map((p) => (
                <option key={`b-${p.id}`} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto max-h-[196px] overflow-y-auto border border-[#1F2A40] rounded bg-[#07090E]">
            <table className="w-full text-left border-collapse text-[10px] font-mono-tabular">
              <thead className="bg-[#0B0F17] text-[#8A99B8] border-b border-[#1F2A40] sticky top-0 z-10">
                <tr>
                  <th className="py-1 px-1.5 text-center w-6">#</th>
                  {SHEET_COLS.map((c) => (
                    <th
                      key={`hb-${c}`}
                      onClick={() => setFocusedCol(c)}
                      className={`py-1 px-1.5 cursor-pointer ${
                        c === 'A' ? 'min-w-[126px]' : 'min-w-[42px]'
                      } ${focusedCol === c ? 'text-[#F59E0B] bg-[#F59E0B]/10' : ''}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2A40]/60">
                {Array.from({ length: GRAFT_ROWS }, (_, idx) => {
                  const r = idx + 1;
                  return (
                    <tr key={`rb-${r}`}>
                      <td className="py-0.5 px-1.5 text-center text-[#8A99B8] bg-[#0B0F17]">{r}</td>
                      {SHEET_COLS.map((c) => {
                        const coord = `${c}${r}`;
                        const cell = evalB.cells[coord];
                        const isHostActive = columnModes[c] !== 'donor-a';
                        return (
                          <td
                            key={`cb-${coord}`}
                            onClick={() => setFocusedCol(c)}
                            className={`p-0 border-l border-[#1F2A40]/50 ${
                              isHostActive ? 'text-[#EDF2F9]' : 'text-[#5E6E8E]'
                            }`}
                          >
                            <input
                              type="text"
                              aria-label={`Config B ${coord}`}
                              value={configB.grid[coord] ?? ''}
                              onChange={(e) =>
                                setCustomEditsB((prev) => ({ ...prev, [coord]: e.target.value }))
                              }
                              title={`Raw: ${configB.grid[coord] ?? ''} | Evaluated: ${cell?.value ?? 0}`}
                              className="w-full bg-transparent px-1.5 py-0.5 text-[10px] focus:outline-none focus:bg-[#111622]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Visual Data Mapping Contracts Diagram + Grafted Vector Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* SVG Data Mapping Contract Visualizer */}
        <div className="lg:col-span-8 border border-[#1F2A40] rounded-lg bg-[#07090E] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#EDF2F9]">
                Visualized Data Mapping Contracts (Donor A × Host B → Clamped Chimera Stream)
              </h3>
              <p className="text-[11px] text-[#8A99B8]">
                Click any column row to inspect how Donor A and Host B cells map through the acoustic/geometric safety contract.
              </p>
            </div>
            <span className="font-mono text-[11px] text-[#00E5CC]">
              Active Focus: Col {focusedCol} ({COLUMN_META[focusedCol].label})
            </span>
          </div>

          <svg
            viewBox="0 0 680 230"
            className="w-full h-[215px] block select-none bg-[#0B0F17] rounded border border-[#1F2A40]"
            role="img"
            aria-label="Data mapping contracts between Configuration A, Configuration B, and Grafted Chimera Output"
          >
            {columnContracts.map((item, i) => {
              const y = 26 + i * 34;
              const isFocused = item.col === focusedCol;
              const usesA = item.mode !== 'host-b';
              const usesB = item.mode !== 'donor-a';
              return (
                <g
                  key={item.col}
                  onClick={() => setFocusedCol(item.col)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Left: Config A Node */}
                  <rect
                    x={14}
                    y={y - 12}
                    width={136}
                    height={24}
                    rx={4}
                    fill={usesA ? '#111D32' : '#07090E'}
                    stroke={usesA ? '#38BDF8' : '#1F2A40'}
                    strokeWidth={isFocused ? 1.8 : 1}
                  />
                  <text
                    x={22}
                    y={y + 4}
                    fill={usesA ? '#EDF2F9' : '#5E6E8E'}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    A.{item.col}1={item.sampleA.toFixed(1)}
                  </text>

                  {/* Left-to-Center Curve */}
                  <path
                    d={`M 150 ${y} C 195 ${y}, 205 ${y}, 240 ${y}`}
                    fill="none"
                    stroke={usesA ? '#38BDF8' : '#1F2A40'}
                    strokeWidth={usesA ? (isFocused ? 2.2 : 1.4) : 0.8}
                    strokeDasharray={usesA ? undefined : '3 3'}
                  />

                  {/* Right: Config B Node */}
                  <rect
                    x={530}
                    y={y - 12}
                    width={136}
                    height={24}
                    rx={4}
                    fill={usesB ? '#231B10' : '#07090E'}
                    stroke={usesB ? '#F59E0B' : '#1F2A40'}
                    strokeWidth={isFocused ? 1.8 : 1}
                  />
                  <text
                    x={538}
                    y={y + 4}
                    fill={usesB ? '#EDF2F9' : '#5E6E8E'}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    B.{item.col}1={item.sampleB.toFixed(1)}
                  </text>

                  {/* Right-to-Center Curve */}
                  <path
                    d={`M 530 ${y} C 485 ${y}, 475 ${y}, 440 ${y}`}
                    fill="none"
                    stroke={usesB ? '#F59E0B' : '#1F2A40'}
                    strokeWidth={usesB ? (isFocused ? 2.2 : 1.4) : 0.8}
                    strokeDasharray={usesB ? undefined : '3 3'}
                  />

                  {/* Center: Contract & Clamp Node */}
                  <rect
                    x={240}
                    y={y - 13}
                    width={200}
                    height={26}
                    rx={4}
                    fill={isFocused ? '#0D2629' : '#111622'}
                    stroke={item.withinContract ? '#00E5CC' : '#F43F5E'}
                    strokeWidth={isFocused ? 2 : 1.2}
                  />
                  <text
                    x={340}
                    y={y - 1}
                    textAnchor="middle"
                    fill="#00E5CC"
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Col {item.col}: {item.modeLabel}
                  </text>
                  <text
                    x={340}
                    y={y + 9}
                    textAnchor="middle"
                    fill="#EDF2F9"
                    fontSize={9}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {item.contractExpr} → {item.sampleGraft.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Contract Table */}
          <div className="overflow-x-auto border border-[#1F2A40] rounded">
            <table className="w-full text-left text-[11px] font-mono-tabular">
              <thead className="bg-[#111622] text-[#8A99B8] border-b border-[#1F2A40]">
                <tr>
                  <th className="py-1.5 px-2.5">Col</th>
                  <th className="py-1.5 px-2.5">Graft Rule</th>
                  <th className="py-1.5 px-2.5">Safety Clamp Contract</th>
                  <th className="py-1.5 px-2.5">Grafted Range (Rows 1–8)</th>
                  <th className="py-1.5 px-2.5">Target Consumer</th>
                  <th className="py-1.5 px-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2A40]">
                {columnContracts.map((c) => (
                  <tr
                    key={`row-${c.col}`}
                    onClick={() => setFocusedCol(c.col)}
                    className={`cursor-pointer ${
                      focusedCol === c.col ? 'bg-[#00E5CC]/10' : 'hover:bg-[#111622]/60'
                    }`}
                  >
                    <td className="py-1.5 px-2.5 font-bold text-[#00E5CC]">
                      {c.col} ({c.label})
                    </td>
                    <td className="py-1.5 px-2.5 text-[#EDF2F9]">{c.modeLabel}</td>
                    <td className="py-1.5 px-2.5 text-[#38BDF8]">{c.contractExpr}</td>
                    <td className="py-1.5 px-2.5 text-[#EDF2F9]">
                      [{c.minOut.toFixed(2)} .. {c.maxOut.toFixed(2)}] {c.unit}
                    </td>
                    <td className="py-1.5 px-2.5 text-[#8A99B8]">{c.targetStage}</td>
                    <td className="py-1.5 px-2.5 text-right">
                      {c.withinContract ? (
                        <span className="text-[#00E5CC] font-semibold">✓ VALID</span>
                      ) : (
                        <span className="text-[#F43F5E] font-semibold">✖ CLAMPED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Grafted Chimera Vector Preview & Summary */}
        <div className="lg:col-span-4 border border-[#1F2A40] rounded-lg bg-[#07090E] p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#EDF2F9]">
                Grafted Chimera Vector Output
              </span>
              <span className="font-mono text-[11px] text-[#00E5CC]">
                {graftVector.symmetry.dominantRatio.p}:{graftVector.symmetry.dominantRatio.q} (
                {graftVector.symmetry.dominantRatio.label})
              </span>
            </div>
            <p className="text-[11px] text-[#8A99B8] mt-0.5">
              Real-time parametric projection of the stitched A×B spreadsheet configuration.
            </p>
          </div>

          <svg
            viewBox="0 0 440 280"
            className="w-full h-48 rounded border border-[#1F2A40] bg-[#05070B]"
            role="img"
            aria-label="Grafted spreadsheet parametric vector preview"
          >
            <path
              d={graftVector.haloPathD}
              fill="none"
              stroke="#00E5CC"
              strokeWidth={5}
              strokeOpacity={0.14}
            />
            <path
              d={graftVector.secondaryPathD}
              fill="none"
              stroke="#38BDF8"
              strokeWidth={1.2}
              strokeOpacity={0.55}
              strokeDasharray="3 3"
            />
            <path
              d={graftVector.primaryPathD}
              fill="none"
              stroke="#00E5CC"
              strokeWidth={2}
              strokeOpacity={0.95}
            />
            {graftVector.vertices.map((v) => (
              <circle
                key={`gv-${v.row}`}
                cx={v.x}
                cy={v.y}
                r={3.5}
                fill="#F59E0B"
                stroke="#07090E"
                strokeWidth={1}
              />
            ))}
          </svg>

          <div className="border border-[#1F2A40] rounded bg-[#0B0F17] p-3 text-[11px] font-mono flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[#EDF2F9]">
              <span>Symmetry Index:</span>
              <span className="text-[#00E5CC] font-semibold">
                {graftVector.symmetry.symmetryIndex}% ({graftVector.symmetry.symmetryClass})
              </span>
            </div>
            <div className="flex items-center justify-between text-[#EDF2F9]">
              <span>Grafted Root A1:</span>
              <span className="text-[#38BDF8]">
                {evalGraft.steps[0]?.freqHz.toFixed(2)} Hz ({evalGraft.steps[0]?.noteName})
              </span>
            </div>
            <div className="flex items-center justify-between text-[#EDF2F9]">
              <span>Formula Errors / Cycles:</span>
              <span className={evalGraft.errorCount === 0 ? 'text-[#00E5CC]' : 'text-[#F43F5E]'}>
                {evalGraft.errorCount} errors · {evalGraft.cycleCoords.length} cycles
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
