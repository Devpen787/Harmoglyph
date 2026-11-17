import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Columns,
  Grid,
  Play,
  Search,
  Sparkles,
  SquareDot,
} from 'lucide-react';
import {
  ArtModeId,
  COLUMN_META,
  MathFoundationId,
  SHEET_COLS,
  SheetCol,
  SheetRawGrid,
  SynthVoiceId,
} from '../types/chimera';
import { chimeraAudio } from '../engine/audioSynth';
import { getMathFoundationSpec, MATH_FOUNDATIONS } from '../engine/mathArtTheory';
import {
  FORMULA_CATALOG_ENTRIES,
  FormulaCatalogEntry,
  injectCatalogFormulaIntoGrid,
  previewCatalogEntryCurve,
} from '../engine/harmonicCodex';

interface MathFormulaCatalogProps {
  grid: SheetRawGrid;
  rootHz: number;
  rowCount: number;
  selectedCoord: string;
  activeFoundation: MathFoundationId;
  activeArtMode: ArtModeId;
  activeVoice: SynthVoiceId;
  imperfection: number;
  onInjectGrid: (
    nextGrid: SheetRawGrid,
    options: {
      primaryCoord: string;
      notice: string;
      foundation?: MathFoundationId;
      artMode?: ArtModeId;
      voice?: SynthVoiceId;
      rowCount?: number;
    },
  ) => void;
  onJumpToConsole: (coord?: string) => void;
}

const FOUNDATION_ACCENT: Record<MathFoundationId, string> = {
  pythagorean: 'text-[#00E5CC] border-[#00E5CC]/50',
  'harmonic-sine': 'text-[#38BDF8] border-[#38BDF8]/50',
  fibonacci: 'text-[#F59E0B] border-[#F59E0B]/50',
  'golden-ratio': 'text-[#A78BFA] border-[#A78BFA]/50',
};

export function MathFormulaCatalog({
  grid,
  rootHz,
  rowCount,
  selectedCoord,
  activeFoundation,
  imperfection,
  onInjectGrid,
  onJumpToConsole,
}: MathFormulaCatalogProps) {
  const [foundationFilter, setFoundationFilter] = useState<'all' | MathFoundationId>('all');
  const [colFilter, setColFilter] = useState<'all' | SheetCol>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [injectMode, setInjectMode] = useState<'cell' | 'column' | 'range'>('cell');
  const [useExactSelectedCell, setUseExactSelectedCell] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(Math.max(8, Math.min(48, rowCount)));
  const [syncFoundationOnInject, setSyncFoundationOnInject] = useState<boolean>(true);
  const [lastInjectedId, setLastInjectedId] = useState<string | null>(null);
  const [lastNotice, setLastNotice] = useState<string | null>(null);

  const parsedSelected = /^([A-F])(\d+)$/i.exec(selectedCoord.trim());
  const selectedCol = (parsedSelected ? parsedSelected[1].toUpperCase() : 'A') as SheetCol;
  const selectedRow = parsedSelected ? Math.max(1, Math.min(48, Number(parsedSelected[2]))) : 2;

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FORMULA_CATALOG_ENTRIES.filter((entry) => {
      if (foundationFilter !== 'all' && entry.foundation !== foundationFilter) return false;
      if (colFilter !== 'all' && entry.targetCol !== colFilter) return false;
      if (!q) return true;
      const foundationLabel = getMathFoundationSpec(entry.foundation).label.toLowerCase();
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.formula.toLowerCase().includes(q) ||
        entry.shapeLabel.toLowerCase().includes(q) ||
        entry.frequencyProfileLabel.toLowerCase().includes(q) ||
        foundationLabel.includes(q)
      );
    });
  }, [foundationFilter, colFilter, searchQuery]);

  const previewsById = useMemo(() => {
    const map: Record<string, ReturnType<typeof previewCatalogEntryCurve>> = {};
    for (const entry of filteredEntries) {
      map[entry.id] = previewCatalogEntryCurve(entry, rootHz, imperfection);
    }
    return map;
  }, [filteredEntries, rootHz, imperfection]);

  const resolveCellTargetLabel = (entry: FormulaCatalogEntry): string => {
    const col = useExactSelectedCell ? selectedCol : entry.targetCol;
    const row = col === 'A' && selectedRow === 1 && /\bA1\b/i.test(entry.formula) ? 2 : selectedRow;
    return `${col}${row}`;
  };

  const resolveRangeTargetLabel = (entry: FormulaCatalogEntry): string => {
    const start =
      injectMode === 'range'
        ? Math.max(1, Math.min(48, rangeStart))
        : entry.targetCol === 'A' && /\bA1\b/i.test(entry.formula)
          ? 2
          : 1;
    const end =
      injectMode === 'range'
        ? Math.max(start, Math.min(48, rangeEnd))
        : Math.max(1, Math.min(48, rowCount));
    return `${entry.targetCol}${start}:${entry.targetCol}${end}`;
  };

  const handleInject = (entry: FormulaCatalogEntry, explicitMode?: 'cell' | 'column' | 'range') => {
    const mode = explicitMode ?? injectMode;
    const targetRowCount =
      mode === 'range' ? Math.max(rowCount, Math.min(48, Math.max(rangeStart, rangeEnd))) : rowCount;
    const result = injectCatalogFormulaIntoGrid(grid, entry, {
      mode,
      selectedCoord,
      rowCount: targetRowCount,
      startRow: rangeStart,
      endRow: rangeEnd,
      useExactSelectedCell,
    });

    setLastInjectedId(entry.id);
    setLastNotice(result.notice);

    onInjectGrid(result.nextGrid, {
      primaryCoord: result.primaryCoord,
      notice: result.notice,
      foundation: syncFoundationOnInject ? entry.foundation : undefined,
      artMode: syncFoundationOnInject ? entry.artMode : undefined,
      rowCount: targetRowCount,
    });

    // Audition the first active step from the newly evaluated formula
    const preview = previewsById[entry.id];
    const stepToPlay = preview?.vectorArt.vertices.find((v) => v.gate > 0.05);
    if (stepToPlay) {
      chimeraAudio.triggerStep(
        {
          row: stepToPlay.row,
          freqHz: stepToPlay.freqHz,
          gate: stepToPlay.gate,
          fmIndex: 2.0,
          orbitX: 50,
          decayMs: 280,
          modRatio: 2,
          noteName: stepToPlay.noteName,
          hasError: false,
        },
        entry.suggestedVoice,
        syncFoundationOnInject ? entry.foundation : activeFoundation,
        imperfection,
      );
    }
  };

  const handleAudition = (entry: FormulaCatalogEntry) => {
    const preview = previewsById[entry.id];
    const vertices = preview?.vectorArt.vertices.filter((v) => v.gate > 0.05) ?? [];
    if (vertices.length === 0) return;
    // Play a quick 3-step harmonic arpeggio preview so users hear the frequency profile
    vertices.slice(0, 3).forEach((v, idx) => {
      window.setTimeout(() => {
        chimeraAudio.triggerStep(
          {
            row: v.row,
            freqHz: v.freqHz,
            gate: v.gate,
            fmIndex: preview.fmProfile[v.row - 1] ?? 2.0,
            orbitX: 50,
            decayMs: 260,
            modRatio: entry.foundation === 'golden-ratio' ? 1.618 : 1.5,
            noteName: v.noteName,
            hasError: false,
          },
          entry.suggestedVoice,
          entry.foundation,
          imperfection,
        );
      }, idx * 140);
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Sticky Catalog Header & A1:F48 Injection Controls */}
      <section
        aria-label="Math Foundation Formula Catalog Controls"
        className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-3.5 flex flex-col gap-3"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div>
            <h2 className="font-display text-sm font-bold text-[#EDF2F9] flex items-center gap-2">
              <Grid className="w-4 h-4 text-[#00E5CC]" aria-hidden="true" />
              <span>Math ↔ Shape ↔ Frequency Profile Catalog (A1:F48)</span>
            </h2>
            <p className="text-xs text-[#8A99B8] mt-0.5">
              Compare how each mathematical formula creates specific geometric shapes and harmonic frequency profiles, then click to inject directly into your A1:F48 cells.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-xs font-mono-tabular flex items-center gap-1.5">
              <span className="text-[#8A99B8]">Active Cell:</span>
              <strong className="text-[#00E5CC]">{selectedCoord}</strong>
              <span className="text-[#8A99B8]">({COLUMN_META[selectedCol].label})</span>
            </div>

            <button
              type="button"
              onClick={() => onJumpToConsole(selectedCoord)}
              className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#111622] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
            >
              <span>Inspect Grid</span>
              <ArrowRight className="w-3 h-3 text-[#00E5CC]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Filters + Target Scope Row */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-center pt-2 border-t border-[#1F2A40]">
          {/* Foundation Filter */}
          <div className="xl:col-span-5 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setFoundationFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                foundationFilter === 'all'
                  ? 'border-[#00E5CC] bg-[#111622] text-[#00E5CC] font-semibold'
                  : 'border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9]'
              }`}
            >
              All Laws ({FORMULA_CATALOG_ENTRIES.length})
            </button>
            {MATH_FOUNDATIONS.map((f) => {
              const active = foundationFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFoundationFilter(f.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                    active
                      ? 'border-[#00E5CC] bg-[#111622] text-[#00E5CC] font-semibold'
                      : 'border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Column Filter & Search */}
          <div className="xl:col-span-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-xs">
              <Columns className="w-3 h-3 text-[#8A99B8]" aria-hidden="true" />
              <select
                aria-label="Filter catalog by spreadsheet column"
                value={colFilter}
                onChange={(e) => setColFilter(e.target.value as 'all' | SheetCol)}
                className="bg-transparent text-[#EDF2F9] text-[11px] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#0B0F17]">All Cols (A–F)</option>
                {SHEET_COLS.map((c) => (
                  <option key={c} value={c} className="bg-[#0B0F17]">
                    Col {c}: {COLUMN_META[c].label}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative flex-1 min-w-[150px]">
              <Search
                className="w-3.5 h-3.5 text-[#8A99B8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search formula, shape, interval..."
                aria-label="Search formula catalog"
                className="w-full pl-8 pr-2.5 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-xs text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none focus:border-[#00E5CC]"
              />
            </div>
          </div>

          {/* Injection Mode & A1:F48 Range */}
          <div className="xl:col-span-3 flex flex-wrap items-center justify-end gap-2">
            <div
              role="group"
              aria-label="Catalog cell injection scope"
              className="flex items-center rounded border border-[#1F2A40] bg-[#07090E] p-0.5 text-[11px]"
            >
              {(
                [
                  { id: 'cell', label: 'Cell' },
                  { id: 'column', label: `Col (1–${rowCount})` },
                  { id: 'range', label: 'Range' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setInjectMode(m.id)}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                    injectMode === m.id
                      ? 'bg-[#00E5CC] text-[#07090E] font-semibold'
                      : 'text-[#8A99B8] hover:text-[#EDF2F9]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {injectMode === 'range' && (
              <div className="flex items-center gap-1 text-[11px] font-mono-tabular">
                <span className="text-[#8A99B8]">Rows</span>
                <input
                  type="number"
                  aria-label="Start row (1-48)"
                  min={1}
                  max={48}
                  value={rangeStart}
                  onChange={(e) =>
                    setRangeStart(Math.max(1, Math.min(48, Number(e.target.value) || 1)))
                  }
                  className="w-11 px-1.5 py-0.5 rounded border border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] text-center"
                />
                <span className="text-[#8A99B8]">–</span>
                <input
                  type="number"
                  aria-label="End row (1-48)"
                  min={1}
                  max={48}
                  value={rangeEnd}
                  onChange={(e) =>
                    setRangeEnd(Math.max(1, Math.min(48, Number(e.target.value) || 8)))
                  }
                  className="w-11 px-1.5 py-0.5 rounded border border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] text-center"
                />
              </div>
            )}
          </div>
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8A99B8]">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncFoundationOnInject}
                onChange={(e) => setSyncFoundationOnInject(e.target.checked)}
                className="accent-[#00E5CC] cursor-pointer"
              />
              <span>
                Align active Math Foundation &amp; 3D Shape topology on inject
              </span>
            </label>

            {injectMode === 'cell' && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useExactSelectedCell}
                  onChange={(e) => setUseExactSelectedCell(e.target.checked)}
                  className="accent-[#F59E0B] cursor-pointer"
                />
                <span>
                  Force exact selected cell (<strong className="font-mono text-[#EDF2F9]">{selectedCoord}</strong>) instead of formula column
                </span>
              </label>
            )}
          </div>

          <span className="font-mono-tabular">
            Showing {filteredEntries.length} of {FORMULA_CATALOG_ENTRIES.length} formulas · Root A1 ={' '}
            <strong className="text-[#EDF2F9]">{rootHz.toFixed(1)} Hz</strong>
          </span>
        </div>

        {lastNotice && (
          <div className="rounded-md border border-[#00E5CC]/50 bg-[#00E5CC]/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#EDF2F9]">
              <Check className="w-3.5 h-3.5 text-[#00E5CC] shrink-0" aria-hidden="true" />
              <span>{lastNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => onJumpToConsole(selectedCoord)}
              className="font-semibold text-[#00E5CC] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Edit in Formula Console</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      {/* Catalog Grid */}
      {filteredEntries.length === 0 ? (
        <div className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-8 text-center text-xs text-[#8A99B8]">
          No formulas match that filter. Clear the search query or switch foundation filter back to All Laws.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filteredEntries.map((entry) => {
            const preview = previewsById[entry.id];
            const foundationSpec = getMathFoundationSpec(entry.foundation);
            const cellTarget = resolveCellTargetLabel(entry);
            const rangeTarget = resolveRangeTargetLabel(entry);
            const isRecentlyInjected = lastInjectedId === entry.id;
            const fmMax = Math.max(4.5, ...(preview?.fmProfile ?? [3]));

            return (
              <article
                key={entry.id}
                className={`border rounded-lg bg-[#0B0F17] p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                  isRecentlyInjected
                    ? 'border-[#00E5CC]'
                    : 'border-[#1F2A40] hover:border-[#34466B]'
                }`}
              >
                {/* Card Header: Title + Foundation + Target Column */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
                      <span
                        className={`px-1.5 py-0.5 rounded border bg-[#07090E] font-semibold ${FOUNDATION_ACCENT[entry.foundation]}`}
                      >
                        {foundationSpec.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded border border-[#1F2A40] bg-[#07090E] text-[#8A99B8]">
                        Col {entry.targetCol} · {COLUMN_META[entry.targetCol].label}
                      </span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-[#EDF2F9] mt-1.5">
                      {entry.title}
                    </h3>
                    <div className="font-mono text-[11px] text-[#8A99B8] mt-0.5">
                      {entry.equation}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAudition(entry)}
                    title={`Audition ${entry.title} frequency profile`}
                    className="px-2.5 py-1.5 rounded border border-[#1F2A40] bg-[#111622] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] hover:text-[#00E5CC] flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current text-[#00E5CC]" aria-hidden="true" />
                    <span>Hear</span>
                  </button>
                </div>

                {/* Clickable Spreadsheet Formula Strip + Evaluated Outputs */}
                <div className="rounded-md border border-[#1F2A40] bg-[#07090E] p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs text-[#00E5CC] break-all">
                      {entry.formula}
                    </code>
                    <span className="text-[10px] font-mono text-[#8A99B8] shrink-0">
                      {COLUMN_META[entry.targetCol].unit}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-mono-tabular text-[#8A99B8] pt-1 border-t border-[#1F2A40]/70">
                    {preview?.sampleOutputs.map((sample) => (
                      <span key={sample.coord}>
                        <span className="text-[#38BDF8]">{sample.coord}</span>=
                        <span className="text-[#EDF2F9]">
                          {Number.isInteger(sample.value)
                            ? sample.value
                            : sample.value.toFixed(1)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Coupled Visual Geometry + Frequency Profile Split */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-stretch">
                  {/* Left: Generated Shape Preview (Live Vector Curve) */}
                  <div className="sm:col-span-5 rounded-md border border-[#1F2A40] bg-[#07090E] p-2 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                      <span className="text-[#38BDF8] font-semibold truncate">
                        {entry.shapeLabel}
                      </span>
                      <span className="text-[#8A99B8] shrink-0">
                        Sym {preview?.vectorArt.symmetry.symmetryIndex ?? 0}%
                      </span>
                    </div>

                    <svg
                      viewBox="0 0 440 280"
                      className="w-full h-28 bg-[#05070B] rounded border border-[#1F2A40]/60"
                      role="img"
                      aria-label={`Generated shape preview for ${entry.title}`}
                    >
                      <circle
                        cx="220"
                        cy="140"
                        r="108"
                        fill="none"
                        stroke="#1F2A40"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />
                      <line x1="220" y1="18" x2="220" y2="262" stroke="#1F2A40" strokeWidth="0.9" />
                      <line x1="28" y1="140" x2="412" y2="140" stroke="#1F2A40" strokeWidth="0.9" />
                      {preview && (
                        <>
                          <path
                            d={preview.vectorArt.haloPathD}
                            fill="none"
                            stroke="#38BDF8"
                            strokeOpacity="0.35"
                            strokeWidth="2"
                          />
                          <path
                            d={preview.vectorArt.secondaryPathD}
                            fill="none"
                            stroke="#F59E0B"
                            strokeOpacity="0.65"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          <path
                            d={preview.vectorArt.primaryPathD}
                            fill="none"
                            stroke="#00E5CC"
                            strokeWidth="2.6"
                            strokeLinejoin="round"
                          />
                          {preview.vectorArt.vertices.map((v) => (
                            <circle
                              key={v.row}
                              cx={v.x}
                              cy={v.y}
                              r={v.gate > 0.05 ? 4 : 2}
                              fill={v.gate > 0.05 ? '#F59E0B' : '#34466B'}
                            />
                          ))}
                        </>
                      )}
                    </svg>

                    <p className="text-[11px] text-[#8A99B8] leading-snug">
                      {entry.shapeSummary}
                    </p>
                  </div>

                  {/* Right: Musical Frequency Profile */}
                  <div className="sm:col-span-7 rounded-md border border-[#1F2A40] bg-[#07090E] p-2.5 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="text-[#F59E0B] font-semibold">
                          FREQUENCY PROFILE
                        </span>
                        <span className="font-mono-tabular text-[#EDF2F9]">
                          {preview ? `${preview.minHz.toFixed(0)}–${preview.maxHz.toFixed(0)} Hz` : ''}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#EDF2F9] mt-0.5">
                        {entry.frequencyProfileLabel}
                      </div>
                      <p className="text-[11px] text-[#8A99B8] mt-1 leading-snug">
                        {entry.frequencySummary}
                      </p>
                    </div>

                    {/* Step Frequency & FM Partial Bar Graph */}
                    <div className="rounded border border-[#1F2A40]/70 bg-[#05070B] px-2 py-1.5 flex flex-col gap-1">
                      <div className="flex items-end justify-between gap-1 h-10">
                        {(preview?.vectorArt.vertices ?? []).map((v, idx) => {
                          const normalizedPitch = Math.max(
                            0.18,
                            Math.min(1, (v.freqHz - 130) / 560),
                          );
                          const fmRatio = Math.max(
                            0.2,
                            Math.min(1, (preview?.fmProfile[idx] ?? 1.8) / fmMax),
                          );
                          const isRest = v.gate <= 0.02;
                          return (
                            <div
                              key={v.row}
                              title={`Step ${v.row}: ${isRest ? 'REST' : `${v.noteName} (${v.freqHz.toFixed(1)} Hz)`}`}
                              className="flex-1 flex flex-col items-center justify-end h-full gap-0.5"
                            >
                              <div
                                style={{ height: `${Math.round((isRest ? 0.12 : normalizedPitch) * 100)}%` }}
                                className={`w-full rounded-t-sm ${
                                  isRest ? 'bg-[#34466B]/45' : 'bg-[#00E5CC]/85'
                                }`}
                              />
                              <div
                                style={{ height: `${Math.round(fmRatio * 8)}px` }}
                                className="w-full rounded-b-sm bg-[#F59E0B]/70"
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#8A99B8]">
                        <span className="truncate text-[#00E5CC]">
                          {preview?.notesPreview.join(' · ')}
                        </span>
                        <span className="shrink-0 ml-2 text-[#38BDF8]">
                          {preview?.ratioLabels.slice(0, 3).join(' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Click-to-Inject Footer */}
                <div className="pt-2 border-t border-[#1F2A40] flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleInject(entry, injectMode === 'cell' ? 'cell' : injectMode)}
                    className="flex-1 min-w-[160px] px-3 py-1.5 rounded-md bg-[#00E5CC] text-[#07090E] text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {injectMode === 'cell'
                        ? `Inject into Cell ${cellTarget}`
                        : `Inject into ${rangeTarget}`}
                    </span>
                  </button>

                  {injectMode === 'cell' ? (
                    <button
                      type="button"
                      onClick={() => handleInject(entry, 'column')}
                      className="px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#111622] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <SquareDot className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
                      <span>Fill {rangeTarget}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInject(entry, 'cell')}
                      className="px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#111622] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>Single Cell {cellTarget}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
