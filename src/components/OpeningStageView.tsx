import { useEffect, useMemo, useState } from 'react';
import {
  AudioWaveform,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Eye,
  EyeOff,
  GitMerge,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Play,
  Sparkles,
  Square,
  Target,
  Volume2,
} from 'lucide-react';
import {
  AppView,
  ArtModeId,
  ExperienceTierId,
  MathFoundationId,
  SheetEvaluationResult,
  SheetPreset,
  SheetRawGrid,
  SynthVoiceId,
} from '../types/chimera';
import { chimeraAudio, SYNTH_VOICES } from '../engine/audioSynth';
import { ComplexityEngine, getMathFoundationSpec, MATH_FOUNDATIONS } from '../engine/mathArtTheory';
import { analyzeHarmonicSymmetry, ART_MODES } from '../engine/vectorPlotter';
import { describeLivePhysics, evaluateHarmonicQuests } from '../engine/harmonicCodex';
import { HarmonicThreeStage } from './HarmonicThreeStage';
import { StudioView } from './StudioView';

interface OpeningStageViewProps {
  presets: SheetPreset[];
  activePresetId: string;
  activeTitle: string;
  activeArtworkKey: SheetPreset['artworkKey'];
  rowCount: number;
  voice: SynthVoiceId;
  artMode: ArtModeId;
  foundation: MathFoundationId;
  experienceTier: ExperienceTierId;
  imperfection: number;
  grid: SheetRawGrid;
  evaluation: SheetEvaluationResult;
  bpm: number;
  isPlaying: boolean;
  activeRow: number;
  waveform: number[];
  drawerOpen: boolean;
  drawerSubView: 'codex' | 'catalog' | 'console' | 'graft' | 'both';
  onToggleDrawer: (subView?: 'codex' | 'catalog' | 'console' | 'graft' | 'both') => void;
  onSelectTier: (tier: ExperienceTierId) => void;
  onChangeImperfection: (imperfection: number) => void;
  onSelectPreset: (presetId: string) => void;
  onChangeCell: (coord: string, value: string) => void;
  onReplaceGrid: (
    nextGrid: SheetRawGrid,
    options?: {
      bpm?: number;
      title?: string;
      rowCount?: number;
      voice?: SynthVoiceId;
      artMode?: ArtModeId;
      foundation?: MathFoundationId;
      imperfection?: number;
    },
  ) => void;
  onChangeBpm: (bpm: number) => void;
  onChangeVoice: (voice: SynthVoiceId) => void;
  onChangeArtMode: (artMode: ArtModeId) => void;
  onChangeFoundation: (foundation: MathFoundationId) => void;
  onTogglePlay: () => void;
  onSelectRow: (row: number) => void;
  onSelectView: (view: AppView) => void;
}

const SCULPT_LABELS: Record<ArtModeId, string> = {
  harmonograph: '3D Torus Knot',
  mandala: 'Cymatic Mandala',
  ribbon: 'Helix Ribbon',
  'pitch-spiral': 'Golden Vortex',
};

export function OpeningStageView({
  presets,
  activePresetId,
  activeTitle,
  activeArtworkKey,
  rowCount,
  voice,
  artMode,
  foundation,
  experienceTier,
  imperfection,
  grid,
  evaluation,
  bpm,
  isPlaying,
  activeRow,
  waveform,
  drawerOpen,
  drawerSubView,
  onToggleDrawer,
  onSelectTier,
  onChangeImperfection,
  onSelectPreset,
  onChangeCell,
  onReplaceGrid,
  onChangeBpm,
  onChangeVoice,
  onChangeArtMode,
  onChangeFoundation,
  onTogglePlay,
  onSelectRow,
  onSelectView,
}: OpeningStageViewProps) {
  const [hudMinimized, setHudMinimized] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [drawerMaximized, setDrawerMaximized] = useState<boolean>(false);

  const activeStep = evaluation.steps[activeRow - 1] ?? evaluation.steps[0];
  const rootCell = evaluation.cells.A1;
  const rootHz = Math.round(rootCell?.value || 261.63);
  const foundationSpec = getMathFoundationSpec(foundation);

  const symmetry = useMemo(
    () => analyzeHarmonicSymmetry(evaluation.steps, artMode, foundation),
    [evaluation.steps, artMode, foundation],
  );

  const activeRatioMetric =
    symmetry.stepRatios[activeRow - 1] ?? symmetry.stepRatios[0];

  const livePhysicsLine = useMemo(
    () =>
      describeLivePhysics(
        activeStep,
        activeRatioMetric,
        symmetry,
        foundation,
        imperfection,
      ),
    [activeStep, activeRatioMetric, symmetry, foundation, imperfection],
  );

  const quests = useMemo(
    () =>
      evaluateHarmonicQuests({
        grid,
        evaluation,
        symmetry,
        foundation,
        imperfection,
        rowCount,
      }),
    [grid, evaluation, symmetry, foundation, imperfection, rowCount],
  );

  const complexityReport = useMemo(
    () =>
      ComplexityEngine.analyze({
        grid,
        evaluation,
        artMode,
        foundation,
        imperfection,
        rowCount,
      }),
    [grid, evaluation, artMode, foundation, imperfection, rowCount],
  );

  const completedQuestCount = quests.filter((q) => q.completed).length;
  const activeQuest = quests.find((q) => !q.completed) ?? quests[quests.length - 1];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditing) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'Escape') {
        if (drawerOpen) {
          onToggleDrawer();
        } else if (dockCollapsed || hudMinimized) {
          setDockCollapsed(false);
          setHudMinimized(false);
        }
      } else if (e.key === 'h' || e.key === 'H') {
        if (!drawerOpen) {
          setDockCollapsed((v) => !v);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, dockCollapsed, hudMinimized, onTogglePlay, onToggleDrawer]);

  const handleTriggerNodeRow = (rowNum: number) => {
    onSelectRow(rowNum);
    const step = evaluation.steps[rowNum - 1];
    if (step) {
      chimeraAudio.triggerStep(step, voice, foundation, imperfection);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col w-full h-full bg-[#07090E] overflow-hidden">
      {/* TOP / FULL VIEWPORT: Interactive 3D Three.js Harmonic Sculpture Stage */}
      <div
        className={`relative w-full transition-all duration-300 ease-out ${
          drawerOpen
            ? drawerMaximized
              ? 'h-[18%] min-h-[120px]'
              : 'h-[45%] min-h-[250px]'
            : 'flex-1 h-full'
        }`}
      >
        <HarmonicThreeStage
          steps={evaluation.steps}
          activeRow={activeRow}
          isPlaying={isPlaying}
          bpm={bpm}
          artMode={artMode}
          foundation={foundation}
          imperfection={imperfection}
          waveform={waveform}
          onSelectRow={handleTriggerNodeRow}
        />

        {/* Top-Center Guided Tier Switcher */}
        {!drawerMaximized && (
          <nav
            aria-label="Guided Learning Tiers"
            className="hidden md:flex items-center gap-1 absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-lg border border-[#1E293B] bg-[#0B0F17] p-1 shadow-xl"
          >
            {(
              [
                { id: 'discovery', label: '1. Discovery', hint: 'Pure play & physics' },
                { id: 'explorer', label: '2. Explorer (Codex)', hint: 'Mix & match laws' },
                { id: 'algebra', label: '3. Algebra Lab', hint: 'Formulas & sheet' },
              ] as const
            ).map((item) => {
              const active = experienceTier === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  onClick={() => onSelectTier(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#00E5CC] text-[#07090E]'
                      : 'text-[#8A99B8] hover:text-[#EDF2F9] hover:bg-[#111622]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Discreet Top-Left Floating Instrument HUD (Zero backdrop-filter over WebGL) */}
        {!hudMinimized && !drawerMaximized && (
          <aside
            aria-label="Live 3D Harmonic Instrument Readout"
            className="absolute top-4 left-4 z-10 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3.5 shadow-xl flex flex-col gap-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <AudioWaveform className="w-3.5 h-3.5 text-[#00E5CC] shrink-0" aria-hidden="true" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#00E5CC] font-semibold">
                    {SCULPT_LABELS[artMode]} · {foundationSpec.label}
                  </span>
                </div>
                <h1 className="font-display text-base font-bold text-[#EDF2F9] truncate mt-0.5">
                  {activeTitle}
                </h1>
              </div>

              <button
                type="button"
                onClick={() => setHudMinimized(true)}
                title="Hide overlay for unobstructed 3D view"
                className="p-1 rounded border border-[#1E293B] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] cursor-pointer shrink-0"
              >
                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Live Active Node Step Readout + Symmetry */}
            <div className="grid grid-cols-4 gap-1.5 rounded-md border border-[#1E293B] bg-[#07090E] px-2.5 py-2 text-xs font-mono-tabular">
              <div>
                <div className="text-[10px] text-[#8A99B8]">STEP</div>
                <div className="font-semibold text-[#EDF2F9]">
                  {activeRow}/{rowCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#8A99B8]">NOTE</div>
                <div className="font-semibold text-[#00E5CC]">
                  {activeStep?.gate <= 0.02 ? 'REST' : activeStep?.noteName}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#8A99B8]">FREQ</div>
                <div className="font-semibold text-[#EDF2F9]">
                  {(activeStep?.freqHz ?? 261.6).toFixed(0)}Hz
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#8A99B8]">RATIO</div>
                <div className="font-semibold text-[#F59E0B]">
                  {activeRatioMetric ? `${activeRatioMetric.p}:${activeRatioMetric.q}` : '1:1'}
                </div>
              </div>
            </div>

            {/* Live Physics Bridge + ComplexityEngine Harmony Score */}
            <div className="rounded-md border border-[#1E293B] bg-[#07090E]/80 px-2.5 py-2 text-[11px] leading-snug text-[#CBD5E1]">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#8A99B8] mb-0.5">
                <span>
                  Harmony{' '}
                  <strong className="text-[#00E5CC]">
                    {complexityReport.harmonyScore}/100
                  </strong>{' '}
                  ({complexityReport.formulaCount}:{complexityReport.visualVertexCount})
                </span>
                <span className="text-[#38BDF8] font-semibold">
                  Symmetry {symmetry.symmetryIndex}%
                </span>
              </div>
              <p>{livePhysicsLine}</p>
              {complexityReport.suggestions[0] && (
                <p className="text-[10px] text-[#F59E0B] mt-1 truncate" title={complexityReport.suggestions[0].detail}>
                  Tip: {complexityReport.suggestions[0].title}
                </p>
              )}
            </div>

            {/* Doherty Threshold (<1ms) Root Cell A1 Live Transpose Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#8A99B8]">
                  Cell <strong className="text-[#00E5CC]">A1</strong> Root Pitch
                </span>
                <span className="font-mono-tabular font-semibold text-[#EDF2F9]">
                  {rootHz} Hz ({activeStep?.noteName ?? 'C4'})
                </span>
              </div>
              <input
                type="range"
                aria-label="Transpose Root Cell A1 Frequency (Hz)"
                min={110}
                max={523}
                value={rootHz}
                onChange={(e) => onChangeCell('A1', e.target.value)}
                className="w-full accent-[#00E5CC] cursor-pointer"
              />
            </div>

            {/* Organic Imperfection (δ) Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-[#8A99B8]">
                  Organic Imperfection (<strong className="text-[#F59E0B]">δ</strong>)
                </span>
                <span className="font-mono-tabular font-semibold text-[#F59E0B]">
                  {Math.round(imperfection * 100)}%{' '}
                  {imperfection <= 0.05 ? 'Crystal' : imperfection <= 0.3 ? 'Subtle' : 'Living'}
                </span>
              </div>
              <input
                type="range"
                aria-label="Organic Imperfection (δ)"
                min={0}
                max={100}
                value={Math.round(imperfection * 100)}
                onChange={(e) => onChangeImperfection(Number(e.target.value) / 100)}
                className="w-full accent-[#F59E0B] cursor-pointer"
              />
            </div>

            {/* Active Progressive Quest Strip */}
            {activeQuest && (
              <div className="rounded-md border border-[#1E293B] bg-[#07090E] px-2.5 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
                    {completedQuestCount === quests.length ? (
                      <CheckCircle2 className="w-3 h-3 text-[#10B981] shrink-0" aria-hidden="true" />
                    ) : (
                      <Target className="w-3 h-3 text-[#00E5CC] shrink-0" aria-hidden="true" />
                    )}
                    <span className="text-[#00E5CC] font-semibold">
                      Quest {activeQuest.stepNumber}/5 · {completedQuestCount}/5 Done
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-[#EDF2F9] truncate mt-0.5">
                    {activeQuest.title}
                  </div>
                  <div className="text-[10px] font-mono text-[#8A99B8] truncate">
                    {activeQuest.progressText}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onSelectTier(activeQuest.tier === 'discovery' ? 'explorer' : activeQuest.tier)
                  }
                  className="px-2 py-1 rounded border border-[#1E293B] bg-[#111622] text-[10px] font-semibold text-[#EDF2F9] hover:border-[#00E5CC] hover:text-[#00E5CC] shrink-0 cursor-pointer"
                >
                  {activeQuest.tier === 'discovery' ? 'Codex' : activeQuest.tier === 'explorer' ? 'Explorer' : 'Algebra'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-[10.5px] font-mono text-[#8A99B8] border-t border-[#1E293B] pt-2">
              <span className="truncate">{foundationSpec.equation}</span>
              <span className="text-[#38BDF8] shrink-0 ml-2">Drag 3D to Orbit</span>
            </div>
          </aside>
        )}

        {/* Restore HUD button when minimized */}
        {hudMinimized && (
          <button
            type="button"
            onClick={() => setHudMinimized(false)}
            className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-md border border-[#1E293B] bg-[#0B0F17] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <Eye className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
            <span>Show Instrument HUD</span>
          </button>
        )}

        {/* FLOATING BOTTOM CONTROL DOCK (Collapsible Zen Mode + Single Sleek Row) */}
        {!drawerOpen && (
          <div className="absolute bottom-5 inset-x-4 z-20 mx-auto max-w-5xl flex flex-col items-center pointer-events-none">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-lg border border-[#1E293B] bg-[#0B0F17] text-[11px] font-mono text-[#8A99B8] hover:text-[#00E5CC] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
                  <span>Show Controls (H)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
                  <span>Hide Controls (H)</span>
                </>
              )}
            </button>

            {!dockCollapsed && (
              <div className="
                pointer-events-auto w-full rounded-xl border border-[#1E293B] bg-[#0B0F17] px-4 py-2.5 shadow-2xl
                flex flex-wrap items-center justify-between gap-2.5
              ">
            {/* Chunk 1: Clean Composition Preset Selector */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs">
                <span className="text-[#8A99B8] font-mono text-[11px]">Preset</span>
                <select
                  aria-label="Composition Preset"
                  value={activePresetId}
                  onChange={(e) => onSelectPreset(e.target.value)}
                  className="bg-transparent text-[#00E5CC] font-semibold focus:outline-none cursor-pointer"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0B0F17] text-[#EDF2F9]">
                      {p.title} ({p.rowCount} steps)
                    </option>
                  ))}
                  {activePresetId === 'custom' && (
                    <option value="custom" className="bg-[#0B0F17] text-[#F59E0B]">
                      Custom: {activeTitle}
                    </option>
                  )}
                </select>
              </label>
            </div>

            {/* Chunk 2: Transport, BPM & 3D Topology Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlay}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isPlaying
                    ? 'bg-[#F43F5E] text-white'
                    : 'bg-[#00E5CC] text-[#07090E]'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs">
                <span className="text-[#8A99B8] font-mono text-[11px]">BPM</span>
                <input
                  type="range"
                  min={60}
                  max={180}
                  value={bpm}
                  onChange={(e) => onChangeBpm(Number(e.target.value))}
                  className="w-16 accent-[#00E5CC] cursor-pointer"
                />
                <span className="font-mono-tabular text-[#EDF2F9] w-6 text-right">{bpm}</span>
              </label>

              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs">
                <span className="text-[#8A99B8] text-[11px]">3D Form</span>
                <select
                  aria-label="3D Sculpture Geometry Mode"
                  value={artMode}
                  onChange={(e) => onChangeArtMode(e.target.value as ArtModeId)}
                  className="bg-transparent text-[#EDF2F9] font-medium focus:outline-none cursor-pointer"
                >
                  {ART_MODES.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0B0F17] text-[#EDF2F9]">
                      {SCULPT_LABELS[m.id] ?? m.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs">
                <Volume2 className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
                <select
                  aria-label="Synthesizer Voice"
                  value={voice}
                  onChange={(e) => onChangeVoice(e.target.value as SynthVoiceId)}
                  className="bg-transparent text-[#EDF2F9] font-medium focus:outline-none cursor-pointer"
                >
                  {SYNTH_VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0B0F17] text-[#EDF2F9]">
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs">
                <span className="text-[#8A99B8] text-[11px]">Tuning</span>
                <select
                  aria-label="Mathematical Tuning Law"
                  value={foundation}
                  onChange={(e) => onChangeFoundation(e.target.value as MathFoundationId)}
                  className="bg-transparent text-[#00E5CC] font-medium focus:outline-none cursor-pointer"
                >
                  {MATH_FOUNDATIONS.map((f) => (
                    <option key={f.id} value={f.id} className="bg-[#0B0F17] text-[#EDF2F9]">
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Chunk 3: Progressive Disclosure Triggers (Tesler's Law) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleDrawer('codex')}
                className="px-3 py-1.5 rounded-lg border border-[#F59E0B]/70 bg-[#111622] text-xs font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#07090E] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Harmonic Codex</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleDrawer('catalog')}
                title="Open Interactive Math -> Shape -> Frequency Formula Catalog"
                className="px-3 py-1.5 rounded-lg border border-[#38BDF8]/70 bg-[#111622] text-xs font-semibold text-[#38BDF8] hover:bg-[#38BDF8] hover:text-[#07090E] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Catalog</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleDrawer('console')}
                className="px-3.5 py-1.5 rounded-lg border border-[#00E5CC] bg-[#111622] text-xs font-semibold text-[#00E5CC] hover:bg-[#00E5CC] hover:text-[#07090E] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Algebra Lab</span>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onToggleDrawer('graft')}
                title="Open Side-by-Side Spreadsheet Graft Editor"
                className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
                <span className="hidden sm:inline">Graft</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectView('kiroween')}
                title="Open One-Card Submission Summary"
                className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs font-medium text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
                <span className="hidden xl:inline">Submission</span>
              </button>
            </div>
          </div>
            )}
          </div>
        )}
      </div>

      {/* PROGRESSIVE DISCLOSURE: Slide-Up Formula & Graft Studio Drawer */}
      {drawerOpen && (
        <section
          aria-label="Expandable Formula and Graft Studio Drawer"
          className="flex-1 flex flex-col border-t-2 border-[#00E5CC]/60 bg-[#0B0F17] overflow-hidden z-20"
        >
          {/* Drawer Handle Header */}
          <div className="px-5 py-2 border-b border-[#1E293B] bg-[#111622] flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <Code2 className="w-3.5 h-3.5 text-[#00E5CC] shrink-0" aria-hidden="true" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[#EDF2F9]">
                Progressive Studio Drawer — Live A1:F{rowCount} Formulas &amp; Graft Contracts
              </span>
              <span className="hidden md:inline text-[11px] font-mono text-[#8A99B8]">
                (Edits sculpt the 3D harmonic manifold above in &lt;1ms)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawerMaximized((v) => !v)}
                className="px-2.5 py-1 rounded border border-[#1E293B] bg-[#07090E] text-xs text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
              >
                {drawerMaximized ? (
                  <>
                    <Minimize2 className="w-3 h-3 text-[#00E5CC]" aria-hidden="true" />
                    <span>Split 3D + Sheet</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3 text-[#00E5CC]" aria-hidden="true" />
                    <span>Maximize Drawer</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onToggleDrawer()}
                className="px-3 py-1 rounded bg-[#00E5CC] text-[#07090E] text-xs font-semibold flex items-center gap-1 hover:opacity-90 cursor-pointer"
              >
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Collapse to Full 3D</span>
              </button>
            </div>
          </div>

          {/* Embedded Studio Console & Graft Editor */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <StudioView
              presets={presets}
              activePresetId={activePresetId}
              activeTitle={activeTitle}
              activeArtworkKey={activeArtworkKey}
              rowCount={rowCount}
              voice={voice}
              artMode={artMode}
              foundation={foundation}
              imperfection={imperfection}
              grid={grid}
              evaluation={evaluation}
              bpm={bpm}
              isPlaying={isPlaying}
              activeRow={activeRow}
              waveform={waveform}
              initialSubView={drawerSubView}
              embeddedInDrawer
              onSelectPreset={onSelectPreset}
              onChangeCell={onChangeCell}
              onReplaceGrid={onReplaceGrid}
              onChangeBpm={onChangeBpm}
              onChangeVoice={onChangeVoice}
              onChangeArtMode={onChangeArtMode}
              onChangeFoundation={onChangeFoundation}
              onChangeImperfection={onChangeImperfection}
              onSelectTier={onSelectTier}
            />
          </div>
        </section>
      )}
    </div>
  );
}
