import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { OpeningStageView } from './components/OpeningStageView';
import { StudioView } from './components/StudioView';
import { VerifyView } from './components/VerifyView';
import { KiroweenKitView } from './components/KiroweenKitView';
import { SHEET_PRESETS } from './data/presets';
import { chimeraAudio } from './engine/audioSynth';
import { evaluateSheet } from './engine/spreadsheetVm';
import {
  AppView,
  ArtModeId,
  ExperienceTierId,
  MathFoundationId,
  SheetPreset,
  SheetRawGrid,
  SynthVoiceId,
} from './types/chimera';

export default function App() {
  const initialPreset = SHEET_PRESETS[0];

  const [activeView, setActiveView] = useState<AppView>('stage');
  const [experienceTier, setExperienceTier] = useState<ExperienceTierId>('discovery');
  const [studioDrawerOpen, setStudioDrawerOpen] = useState<boolean>(false);
  const [studioInitialSubView, setStudioInitialSubView] = useState<
    'codex' | 'catalog' | 'console' | 'graft' | 'both'
  >('console');
  const [activePresetId, setActivePresetId] = useState<string>(initialPreset.id);
  const [activeTitle, setActiveTitle] = useState<string>(initialPreset.title);
  const [activeArtworkKey, setActiveArtworkKey] = useState<SheetPreset['artworkKey']>(
    initialPreset.artworkKey,
  );
  const [rowCount, setRowCount] = useState<number>(initialPreset.rowCount);
  const [voice, setVoice] = useState<SynthVoiceId>(initialPreset.voice);
  const [artMode, setArtMode] = useState<ArtModeId>(initialPreset.artMode);
  const [foundation, setFoundation] = useState<MathFoundationId>('harmonic-sine');
  const [imperfection, setImperfection] = useState<number>(0);
  const [grid, setGrid] = useState<SheetRawGrid>(() => ({ ...initialPreset.cells }));
  const [bpm, setBpm] = useState<number>(initialPreset.bpm);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeRow, setActiveRow] = useState<number>(1);

  const evaluation = useMemo(() => evaluateSheet(grid, rowCount), [grid, rowCount]);
  const stepsRef = useRef(evaluation.steps);
  stepsRef.current = evaluation.steps;

  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const foundationRef = useRef(foundation);
  foundationRef.current = foundation;

  const imperfectionRef = useRef(imperfection);
  imperfectionRef.current = imperfection;

  const rowCountRef = useRef(rowCount);
  rowCountRef.current = rowCount;

  const [waveform, setWaveform] = useState<number[]>(() =>
    chimeraAudio.readWaveform(evaluation.steps[0], 'harmonic-sine', 0),
  );

  const stepIndexRef = useRef<number>(0);

  const handleSelectPreset = useCallback((presetId: string) => {
    const preset = SHEET_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(preset.id);
    setActiveTitle(preset.title);
    setActiveArtworkKey(preset.artworkKey);
    setRowCount(preset.rowCount);
    setVoice(preset.voice);
    setArtMode(preset.artMode);
    setGrid({ ...preset.cells });
    setBpm(preset.bpm);
    setActiveRow(1);
    stepIndexRef.current = 0;
  }, []);

  const handleChangeCell = useCallback((coord: string, value: string) => {
    setActivePresetId('custom');
    setGrid((prev) => ({
      ...prev,
      [coord]: value,
    }));
  }, []);

  const handleReplaceGrid = useCallback(
    (
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
    ) => {
      setActivePresetId('custom');
      setGrid({ ...nextGrid });
      if (typeof options?.bpm === 'number') setBpm(options.bpm);
      if (options?.title) setActiveTitle(options.title);
      if (typeof options?.rowCount === 'number') setRowCount(options.rowCount);
      if (options?.voice) setVoice(options.voice);
      if (options?.artMode) setArtMode(options.artMode);
      if (options?.foundation) setFoundation(options.foundation);
      if (typeof options?.imperfection === 'number') {
        setImperfection(Math.max(0, Math.min(1, options.imperfection)));
      }
      setActiveRow(1);
      stepIndexRef.current = 0;
    },
    [],
  );

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        stepIndexRef.current = 0;
        const firstStep = stepsRef.current[0];
        setActiveRow(1);
        if (firstStep) {
          chimeraAudio.triggerStep(
            firstStep,
            voiceRef.current,
            foundationRef.current,
            imperfectionRef.current,
          );
          setWaveform(
            chimeraAudio.readWaveform(firstStep, foundationRef.current, imperfectionRef.current),
          );
        }
      }
      return next;
    });
  }, []);

  const handleSelectView = useCallback((view: AppView) => {
    if (view === 'stage') {
      setStudioDrawerOpen(false);
    }
    setActiveView(view);
  }, []);

  const handleToggleStudioDrawer = useCallback(
    (subView?: 'codex' | 'catalog' | 'console' | 'graft' | 'both') => {
      if (subView) {
        setStudioInitialSubView(subView);
        if (subView === 'codex' || subView === 'catalog') {
          setExperienceTier('explorer');
        } else if (subView === 'console' || subView === 'both' || subView === 'graft') {
          setExperienceTier('algebra');
        }
        setActiveView('stage');
        setStudioDrawerOpen(true);
        return;
      }
      setActiveView('stage');
      setStudioDrawerOpen((prev) => !prev);
    },
    [],
  );

  const handleSelectTier = useCallback((tier: ExperienceTierId) => {
    setExperienceTier(tier);
    setActiveView('stage');
    if (tier === 'discovery') {
      setStudioDrawerOpen(false);
    } else if (tier === 'explorer') {
      setStudioInitialSubView('codex');
      setStudioDrawerOpen(true);
    } else {
      setStudioInitialSubView('console');
      setStudioDrawerOpen(true);
    }
  }, []);

  const handleSelectRow = useCallback((rowNum: number) => {
    setActiveRow(rowNum);
    stepIndexRef.current = Math.max(0, rowNum - 1);
  }, []);

  useEffect(() => {
    if (isPlaying) return;
    const idleStep = evaluation.steps[activeRow - 1] ?? evaluation.steps[0];
    setWaveform(chimeraAudio.readWaveform(idleStep, foundation, imperfection));
  }, [isPlaying, evaluation.steps, activeRow, foundation, imperfection]);

  useEffect(() => {
    if (!isPlaying) return;

    const stepMs = Math.max(80, Math.round(60000 / Math.max(40, Math.min(240, bpm)) / 2));
    const timer = window.setInterval(() => {
      const total = Math.max(1, rowCountRef.current);
      stepIndexRef.current = (stepIndexRef.current + 1) % total;
      const rowNum = stepIndexRef.current + 1;
      const step = stepsRef.current[stepIndexRef.current];
      setActiveRow(rowNum);
      if (step) {
        chimeraAudio.triggerStep(
          step,
          voiceRef.current,
          foundationRef.current,
          imperfectionRef.current,
        );
        setWaveform(
          chimeraAudio.readWaveform(step, foundationRef.current, imperfectionRef.current),
        );
      }
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, bpm]);

  return (
    <div className="h-screen flex flex-col bg-[#07090E] text-[#EDF2F9] overflow-hidden">
      <TopBar
        activeView={activeView}
        studioDrawerOpen={studioDrawerOpen}
        onSelectView={handleSelectView}
        onToggleStudioDrawer={() => handleToggleStudioDrawer()}
        isPlaying={isPlaying}
        bpm={bpm}
        onTogglePlay={handleTogglePlay}
      />

      {activeView === 'stage' && (
        <OpeningStageView
          presets={SHEET_PRESETS}
          activePresetId={activePresetId}
          activeTitle={activeTitle}
          activeArtworkKey={activeArtworkKey}
          rowCount={rowCount}
          voice={voice}
          artMode={artMode}
          foundation={foundation}
          experienceTier={experienceTier}
          imperfection={imperfection}
          grid={grid}
          evaluation={evaluation}
          bpm={bpm}
          isPlaying={isPlaying}
          activeRow={activeRow}
          waveform={waveform}
          drawerOpen={studioDrawerOpen}
          drawerSubView={studioInitialSubView}
          onToggleDrawer={handleToggleStudioDrawer}
          onSelectTier={handleSelectTier}
          onChangeImperfection={setImperfection}
          onSelectPreset={handleSelectPreset}
          onChangeCell={handleChangeCell}
          onReplaceGrid={handleReplaceGrid}
          onChangeBpm={setBpm}
          onChangeVoice={setVoice}
          onChangeArtMode={setArtMode}
          onChangeFoundation={setFoundation}
          onTogglePlay={handleTogglePlay}
          onSelectRow={handleSelectRow}
          onSelectView={handleSelectView}
        />
      )}

      {activeView === 'studio' && (
        <StudioView
          presets={SHEET_PRESETS}
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
          initialSubView={studioInitialSubView}
          onSelectPreset={handleSelectPreset}
          onChangeCell={handleChangeCell}
          onReplaceGrid={handleReplaceGrid}
          onChangeBpm={setBpm}
          onChangeVoice={setVoice}
          onChangeArtMode={setArtMode}
          onChangeFoundation={setFoundation}
          onChangeImperfection={setImperfection}
          onSelectTier={handleSelectTier}
        />
      )}

      {activeView === 'verify' && <VerifyView />}

      {activeView === 'kiroween' && <KiroweenKitView activeTitle={activeTitle} />}
    </div>
  );
}
