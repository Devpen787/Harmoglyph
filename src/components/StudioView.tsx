import { PointerEvent as ReactPointerEvent, ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Download, FileMusic, GitMerge, Image as ImageIcon, LayoutGrid, Loader2, Music, PenTool, Sparkles, Upload, Wand2 } from 'lucide-react';
import {
  ArtModeId,
  COLUMN_META,
  ExperienceTierId,
  MathFoundationId,
  SHEET_COLS,
  SheetCol,
  SheetEvaluationResult,
  SheetPreset,
  SheetRawGrid,
  SynthVoiceId,
} from '../types/chimera';
import { makeCoord, parseCsvToSheet, serializeSheetToCsv } from '../engine/spreadsheetVm';
import { chimeraAudio, renderSheetToWavBytes, SYNTH_VOICES } from '../engine/audioSynth';
import {
  ComplexityEngine,
  getMathFoundationSpec,
  mapMathToSynthParams,
  MATH_FOUNDATIONS,
  SymmetrySuggestion,
} from '../engine/mathArtTheory';
import {
  ART_MODES,
  buildSymmetricPolygonPoints,
  computeVectorCurve,
  exportPosterPng,
  exportStandaloneSvg,
  geometryToFormulaGrid,
} from '../engine/vectorPlotter';
import {
  applyColumnMathGenerator,
  COLUMN_MATH_GENERATORS,
  ColumnMathGenerator,
  evaluateHarmonicQuests,
  explainFormulaAnatomy,
} from '../engine/harmonicCodex';
import { PRESET_ARTWORK_URLS } from '../data/presetArtworks';
import { GraftEditorView } from './GraftEditorView';
import { FormulaCellInput } from './FormulaCellInput';
import { HarmonicCodexPanel } from './HarmonicCodexPanel';
import { MathFormulaCatalog } from './MathFormulaCatalog';

interface StudioViewProps {
  presets: SheetPreset[];
  activePresetId: string;
  activeTitle: string;
  activeArtworkKey: SheetPreset['artworkKey'];
  rowCount: number;
  voice: SynthVoiceId;
  artMode: ArtModeId;
  foundation: MathFoundationId;
  imperfection?: number;
  grid: SheetRawGrid;
  evaluation: SheetEvaluationResult;
  bpm: number;
  isPlaying: boolean;
  activeRow: number;
  waveform: number[];
  initialSubView?: 'codex' | 'catalog' | 'console' | 'graft' | 'both';
  embeddedInDrawer?: boolean;
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
  onChangeImperfection?: (imperfection: number) => void;
  onSelectTier?: (tier: ExperienceTierId) => void;
}

function triggerDownload(filename: string, data: BlobPart | Blob, mime?: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StudioView({
  presets,
  activePresetId,
  activeTitle,
  activeArtworkKey,
  rowCount,
  voice,
  artMode,
  foundation,
  imperfection = 0,
  grid,
  evaluation,
  bpm,
  isPlaying,
  activeRow,
  waveform,
  initialSubView = 'console',
  embeddedInDrawer = false,
  onSelectPreset,
  onChangeCell,
  onReplaceGrid,
  onChangeBpm,
  onChangeVoice,
  onChangeArtMode,
  onChangeFoundation,
  onChangeImperfection,
  onSelectTier,
}: StudioViewProps) {
  const [selectedCoord, setSelectedCoord] = useState<string>('A1');
  const [focusCellTarget, setFocusCellTarget] = useState<string | null>(null);
  const [studioSubView, setStudioSubView] = useState<'codex' | 'catalog' | 'both' | 'console' | 'graft'>(initialSubView);
  const [activeColumnMenu, setActiveColumnMenu] = useState<SheetCol | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [transcribedInfo, setTranscribedInfo] = useState<{
    fileName: string;
    keySignature: string;
    timeSignature: string;
    rootHz: number;
    detectedNotes: string[];
    previewUrl?: string;
  } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [isDrawMode, setIsDrawMode] = useState<boolean>(false);
  const [drawnStroke, setDrawnStroke] = useState<Array<{ x: number; y: number }>>([]);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const scoreInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const artSvgRef = useRef<SVGSVGElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  useEffect(() => {
    setStudioSubView(initialSubView);
  }, [initialSubView]);

  useEffect(() => {
    if (!isPlaying) return;
    const rowEl = rowRefs.current[activeRow];
    rowEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeRow, isPlaying]);

  const selectedCell = evaluation.cells[selectedCoord];
  const selectedCol = selectedCoord[0] as keyof typeof COLUMN_META;
  const colInfo = COLUMN_META[selectedCol] ?? COLUMN_META.A;

  const vectorArt = useMemo(
    () => computeVectorCurve(evaluation.steps, artMode, foundation, imperfection),
    [evaluation.steps, artMode, foundation, imperfection],
  );

  const foundationSpec = useMemo(() => getMathFoundationSpec(foundation), [foundation]);
  const activeStep = evaluation.steps[activeRow - 1] ?? evaluation.steps[0];
  const activeSynthMod = useMemo(
    () => (activeStep ? mapMathToSynthParams(activeStep, foundation, imperfection) : null),
    [activeStep, foundation, imperfection],
  );
  const formulaAnatomy = useMemo(
    () => explainFormulaAnatomy(grid[selectedCoord] ?? ''),
    [grid, selectedCoord],
  );
  const quests = useMemo(
    () =>
      evaluateHarmonicQuests({
        grid,
        evaluation,
        symmetry: vectorArt.symmetry,
        foundation,
        imperfection,
        rowCount,
      }),
    [grid, evaluation, vectorArt.symmetry, foundation, imperfection, rowCount],
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
  const activeStepRatio =
    vectorArt.symmetry.stepRatios[activeRow - 1] ?? vectorArt.symmetry.stepRatios[0];
  const activeVertex = vectorArt.vertices[activeRow - 1] ?? vectorArt.vertices[0];
  const activeCoverUrl = PRESET_ARTWORK_URLS[activeArtworkKey];

  const getSvgCoords = (e: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const svg = artSvgRef.current;
    if (!svg) return { x: 220, y: 140 };
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const mapped = pt.matrixTransform(ctm.inverse());
      return {
        x: Math.max(12, Math.min(428, mapped.x)),
        y: Math.max(12, Math.min(268, mapped.y)),
      };
    }
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 440;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 280;
    return {
      x: Math.max(12, Math.min(428, x)),
      y: Math.max(12, Math.min(268, y)),
    };
  };

  const applyGeometryToSheet = (
    points: Array<{ x: number; y: number }>,
    label: string,
    preferredMode: ArtModeId = 'pitch-spiral',
  ) => {
    if (points.length < 2) return;
    const { grid: compiledGrid, rowCount: compiledRows } = geometryToFormulaGrid(points, {
      baseHz: 261.63,
    });
    onReplaceGrid(compiledGrid, {
      title: label,
      rowCount: compiledRows,
      artMode: preferredMode,
      bpm,
      voice,
    });
    setTranscribedInfo(null);
    setExportNotice(
      `Mapped ${label} (${compiledRows} geometric vertices) -> live A1:F${compiledRows} math formulas.`,
    );
  };

  const handleApplyPolygon = (sides: number, starStep: number, label: string) => {
    const pts = buildSymmetricPolygonPoints(sides, starStep);
    setDrawnStroke(pts);
    applyGeometryToSheet(pts, label, 'pitch-spiral');
    window.setTimeout(() => setDrawnStroke([]), 650);
  };

  const handleArtPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!isDrawMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getSvgCoords(e);
    setDrawnStroke([pt]);
  };

  const handleArtPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!isDrawMode || !isDrawingRef.current) return;
    const pt = getSvgCoords(e);
    setDrawnStroke((prev) => {
      const last = prev[prev.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 10) {
        return [...prev, pt];
      }
      return prev;
    });
  };

  const handleArtPointerUp = () => {
    if (!isDrawMode || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (drawnStroke.length >= 3) {
      applyGeometryToSheet(drawnStroke, 'Drawn Geometry', artMode);
    }
    setDrawnStroke([]);
  };

  const wavePoints = waveform
    .map((val, idx) => {
      const x = (idx / Math.max(1, waveform.length - 1)) * 320;
      const y = 26 - val * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const handleCompose = async () => {
    if (!aiPrompt.trim()) return;
    setIsComposing(true);
    setComposeError(null);
    try {
      const res = await fetch('/api/formula/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI formula compose failed.');

      const nextGrid: SheetRawGrid = {};
      let highestRow = 8;
      for (const item of data.cells ?? []) {
        if (item?.coord && typeof item.formula === 'string') {
          const coord = String(item.coord).toUpperCase();
          nextGrid[coord] = item.formula;
          const m = /^[A-F](\d+)$/.exec(coord);
          if (m) highestRow = Math.max(highestRow, Math.min(48, Number(m[1])));
        }
      }
      onReplaceGrid(nextGrid, {
        bpm: typeof data.bpm === 'number' ? Math.max(60, Math.min(180, data.bpm)) : bpm,
        title: data.title || 'AI Formula Song',
        rowCount: highestRow,
        voice: SYNTH_VOICES.some((v) => v.id === data.voice) ? data.voice : voice,
        artMode: ART_MODES.some((m) => m.id === data.artMode) ? data.artMode : artMode,
      });
    } catch (err: unknown) {
      setComposeError(err instanceof Error ? err.message : 'Unable to generate formula patch.');
    } finally {
      setIsComposing(false);
    }
  };

  const optimizeImageForUpload = async (
    file: File,
  ): Promise<{ mimeType: string; base64Data: string; previewUrl: string }> => {
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });

    if (file.size > 800_000) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = rawDataUrl;
        });
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const optimizedUrl = canvas.toDataURL('image/jpeg', 0.88);
          const commaIdx = optimizedUrl.indexOf(',');
          return {
            mimeType: 'image/jpeg',
            base64Data: commaIdx >= 0 ? optimizedUrl.slice(commaIdx + 1) : optimizedUrl,
            previewUrl: optimizedUrl,
          };
        }
      } catch {
        // Fallback to original data URL if canvas conversion fails
      }
    }

    const commaIdx = rawDataUrl.indexOf(',');
    return {
      mimeType: file.type || 'image/png',
      base64Data: commaIdx >= 0 ? rawDataUrl.slice(commaIdx + 1) : rawDataUrl,
      previewUrl: rawDataUrl,
    };
  };

  const processMusicSheetFile = async (file: File) => {
    setComposeError(null);
    setExportNotice(null);

    if (/\.csv$/i.test(file.name)) {
      try {
        const text = await file.text();
        const imported = parseCsvToSheet(text);
        const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0).length;
        onReplaceGrid(imported, {
          bpm,
          title: file.name.replace(/\.csv$/i, ''),
          rowCount: Math.max(8, Math.min(48, lines)),
        });
        setTranscribedInfo(null);
        setExportNotice(`Loaded "${file.name}" into formula grid.`);
      } catch (err: unknown) {
        setComposeError(err instanceof Error ? err.message : 'Unable to read CSV file.');
      }
      return;
    }

    const sizeKb = Math.max(1, Math.round(file.size / 1024));
    setIsTranscribing(true);
    setUploadStatus(`Reading "${file.name}" (${sizeKb} KB) and translating notes into A1:F48 math formulas...`);

    try {
      const isTextScore =
        /\.(abc|xml|musicxml|txt)$/i.test(file.name) ||
        (file.type.startsWith('text/') && !file.type.includes('csv'));

      let payload: {
        fileName: string;
        mimeType?: string;
        base64Data?: string;
        textContent?: string;
      };
      let previewUrl: string | undefined;

      if (isTextScore) {
        const textContent = await file.text();
        payload = { fileName: file.name, textContent };
      } else if (
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
      ) {
        const opt = await optimizeImageForUpload(file);
        previewUrl = opt.previewUrl;
        payload = { fileName: file.name, mimeType: opt.mimeType, base64Data: opt.base64Data };
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ''));
          reader.onerror = () => reject(new Error('Failed to read uploaded music sheet.'));
          reader.readAsDataURL(file);
        });
        const commaIdx = dataUrl.indexOf(',');
        const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        const mimeType =
          file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png');
        payload = { fileName: file.name, mimeType, base64Data };
      }

      const res = await fetch('/api/sheet-music/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          res.ok
            ? 'Received unexpected non-JSON response from transcription server.'
            : `Upload failed (HTTP ${res.status}): ${rawText.slice(0, 140)}`,
        );
      }

      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : `Sheet music transcription failed (${res.status}).`,
        );
      }

      const nextGrid: SheetRawGrid = {};
      let highestRow = 8;
      const cells = Array.isArray(data.cells) ? data.cells : [];
      for (const item of cells) {
        if (item?.coord && typeof item.formula === 'string') {
          const coord = String(item.coord).toUpperCase();
          nextGrid[coord] = item.formula;
          const m = /^[A-F](\d+)$/.exec(coord);
          if (m) highestRow = Math.max(highestRow, Math.min(48, Number(m[1])));
        }
      }

      if (Object.keys(nextGrid).length === 0) {
        throw new Error('No playable notes were detected in that file. Try a clearer image, PDF, or ABC/MusicXML score.');
      }

      onReplaceGrid(nextGrid, {
        bpm: typeof data.bpm === 'number' ? Math.max(60, Math.min(180, data.bpm)) : bpm,
        title: typeof data.title === 'string' && data.title ? data.title : file.name.replace(/\.[^.]+$/, ''),
        rowCount: highestRow,
        voice: SYNTH_VOICES.some((v) => v.id === data.voice) ? (data.voice as SynthVoiceId) : voice,
        artMode: ART_MODES.some((m) => m.id === data.artMode) ? (data.artMode as ArtModeId) : artMode,
      });

      setTranscribedInfo({
        fileName: file.name,
        keySignature: typeof data.keySignature === 'string' ? data.keySignature : 'Detected Key',
        timeSignature: typeof data.timeSignature === 'string' ? data.timeSignature : '4/4',
        rootHz: typeof data.rootHz === 'number' ? data.rootHz : 261.63,
        detectedNotes: Array.isArray(data.detectedNotes) ? (data.detectedNotes as string[]).slice(0, 14) : [],
        previewUrl,
      });
      setExportNotice(`Translated "${file.name}" into ${highestRow} mathematical steps. Press Play Sheet to hear it!`);
    } catch (err: unknown) {
      setComposeError(err instanceof Error ? err.message : 'Unable to transcribe music sheet.');
    } finally {
      setIsTranscribing(false);
      setUploadStatus(null);
    }
  };

  const handleUploadMusicSheet = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await processMusicSheetFile(file);
    } finally {
      input.value = '';
    }
  };

  const handleDrop = async (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processMusicSheetFile(file);
    }
  };

  const fileSlug = activeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const handleApplyColumnGenerator = (gen: ColumnMathGenerator) => {
    const nextGrid = applyColumnMathGenerator(grid, gen, rowCount);
    onReplaceGrid(nextGrid, { title: activeTitle, rowCount, bpm, voice, artMode });
    setActiveColumnMenu(null);
    setExportNotice(`Applied "${gen.label}" math rule across Column ${gen.col} (1–${rowCount}).`);
  };

  const handleApplySymmetrySuggestion = (sug: SymmetrySuggestion) => {
    if (!sug.recommendedCol || !sug.recommendedFormula) return;
    const nextGrid: SheetRawGrid = { ...grid };
    const startRow = sug.recommendedCol === 'A' && /\bA1\b/i.test(sug.recommendedFormula) ? 2 : 1;
    if (startRow === 2 && (!nextGrid.A1 || nextGrid.A1.startsWith('='))) {
      nextGrid.A1 = '261.63';
    }
    for (let r = startRow; r <= rowCount; r++) {
      nextGrid[`${sug.recommendedCol}${r}`] = sug.recommendedFormula;
    }
    onReplaceGrid(nextGrid, { title: activeTitle, rowCount, bpm, voice, artMode });
    setSelectedCoord(`${sug.recommendedCol}${startRow}`);
    setExportNotice(
      `Applied ComplexityEngine suggestion across ${sug.recommendedCol}${startRow}:${sug.recommendedCol}${rowCount}.`,
    );
  };

  const handleExportWav = () => {
    const bytes = renderSheetToWavBytes(evaluation.steps, bpm, 1, voice, foundation, imperfection);
    triggerDownload(`${fileSlug}.wav`, bytes.buffer as ArrayBuffer, 'audio/wav');
    setExportNotice(
      `Exported ${activeTitle} (${voice} · ${foundationSpec.label}) as 16-bit PCM .wav audio.`,
    );
  };

  const handleExportSvg = () => {
    const svg = exportStandaloneSvg(evaluation.steps, activeTitle, artMode, foundation, imperfection);
    triggerDownload(`${fileSlug}.svg`, svg, 'image/svg+xml;charset=utf-8');
    setExportNotice(`Exported ${artMode} (${foundationSpec.label}) vector artwork as .svg.`);
  };

  const handleExportPng = async () => {
    const blob = await exportPosterPng(
      evaluation.steps,
      activeTitle,
      bpm,
      voice,
      artMode,
      activeCoverUrl,
      foundation,
      imperfection,
    );
    if (!blob) return;
    triggerDownload(`${fileSlug}-poster.png`, blob);
    setExportNotice(`Exported 1200x900 gallery poster as .png.`);
  };

  const handleExportCsv = () => {
    const csv = serializeSheetToCsv(grid, rowCount);
    triggerDownload(`${fileSlug}.csv`, csv, 'text/csv;charset=utf-8');
    setExportNotice(`Exported ${rowCount}-step formula spreadsheet .csv.`);
  };

  const handleImportCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseCsvToSheet(text);
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0).length;
      onReplaceGrid(imported, {
        bpm,
        title: file.name.replace(/\.csv$/i, ''),
        rowCount: Math.max(8, Math.min(48, lines)),
      });
      setTranscribedInfo(null);
      setExportNotice(`Loaded ${file.name} into formula grid.`);
    } finally {
      input.value = '';
    }
  };

  return (
    <main
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={handleDrop}
      className={`flex-1 overflow-y-auto bg-[#07090E] px-5 py-3.5 lg:px-6 lg:py-4 transition-colors ${
        isDragActive ? 'ring-2 ring-inset ring-[#00E5CC]' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        {/* Compact Single-Row Songbook & Workspace Mode Ribbon */}
        <section
          aria-label="Formula Songbook"
          className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto"
        >
          {embeddedInDrawer ? (
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs">
                <Music className="w-3 h-3 text-[#00E5CC] shrink-0" aria-hidden="true" />
                <select
                  aria-label="Active Preset Sheet"
                  value={activePresetId}
                  onChange={(e) => onSelectPreset(e.target.value)}
                  className="bg-transparent text-[#EDF2F9] font-semibold focus:outline-none cursor-pointer"
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
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto">
              {presets.map((p) => {
                const active = p.id === activePresetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPreset(p.id)}
                    title={`${p.title} (${p.rowCount} steps · ${p.bpm} BPM)`}
                    className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#00E5CC] bg-[#111622] text-[#EDF2F9]'
                        : 'border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#34466B]'
                    }`}
                  >
                    {active && <Music className="w-3 h-3 text-[#00E5CC] shrink-0" aria-hidden="true" />}
                    <span className="text-xs font-semibold">{p.title}</span>
                    <span className="text-[10px] font-mono-tabular text-[#8A99B8]">{p.rowCount}r</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Studio View Switcher: Harmonic Codex / Formula Catalog / Formula Console / Graft Editor / Split */}
          <div
            role="group"
            aria-label="Studio workspace view mode"
            className="flex items-center rounded-md border border-[#1F2A40] bg-[#07090E] p-0.5 shrink-0"
          >
            {(
              [
                { id: 'codex', label: 'Harmonic Codex' },
                { id: 'catalog', label: 'Formula Catalog' },
                { id: 'console', label: 'Formula Console' },
                { id: 'graft', label: 'Graft Editor' },
                { id: 'both', label: 'Split View' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStudioSubView(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  studioSubView === tab.id
                    ? 'bg-[#00E5CC] text-[#07090E] font-semibold'
                    : 'text-[#8A99B8] hover:text-[#EDF2F9]'
                }`}
              >
                {tab.id === 'codex' && <Compass className="w-3 h-3" aria-hidden="true" />}
                {tab.id === 'catalog' && <LayoutGrid className="w-3 h-3" aria-hidden="true" />}
                {tab.id === 'graft' && <GitMerge className="w-3 h-3" aria-hidden="true" />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Controls & AI Formula Bar */}
        <div className="border border-[#1F2A40] rounded-lg bg-[#111622] p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs">
              <span className="text-[#8A99B8]">BPM</span>
              <input
                type="range"
                min={60}
                max={180}
                value={bpm}
                onChange={(e) => onChangeBpm(Number(e.target.value))}
                className="w-16 accent-[#00E5CC]"
              />
              <span className="font-mono-tabular text-[#EDF2F9] w-7 text-right">{bpm}</span>
            </label>

            {onChangeImperfection && (
              <label
                title="Adjust organic imperfection (δ) between pure crystal ratios and living golden-angle drift"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs"
              >
                <span className="text-[#F59E0B] font-mono">δ</span>
                <input
                  type="range"
                  aria-label="Organic Imperfection"
                  min={0}
                  max={100}
                  value={Math.round(imperfection * 100)}
                  onChange={(e) => onChangeImperfection(Number(e.target.value) / 100)}
                  className="w-16 accent-[#F59E0B]"
                />
                <span className="font-mono-tabular text-[#EDF2F9] w-8 text-right">
                  {Math.round(imperfection * 100)}%
                </span>
              </label>
            )}

            <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs">
              <span className="text-[#8A99B8]">Voice</span>
              <select
                aria-label="Synthesizer voice"
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

            <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs">
              <span className="text-[#8A99B8]">Art</span>
              <select
                aria-label="Parametric art mode"
                value={artMode}
                onChange={(e) => onChangeArtMode(e.target.value as ArtModeId)}
                className="bg-transparent text-[#EDF2F9] font-medium focus:outline-none cursor-pointer"
              >
                {ART_MODES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0B0F17] text-[#EDF2F9]">
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCompose();
              }}
              placeholder="Describe a melody or song to compose formulas..."
              className="flex-1 min-w-[190px] bg-[#07090E] border border-[#1F2A40] rounded-md px-3 py-1.5 text-xs text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none focus:border-[#00E5CC]"
            />
            <button
              type="button"
              onClick={handleCompose}
              disabled={isComposing || isTranscribing || !aiPrompt.trim()}
              className="px-3.5 py-1.5 rounded-md border border-[#00E5CC] bg-[#07090E] text-[#00E5CC] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#00E5CC]/10 disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isComposing ? 'Composing...' : 'Compose Song'}</span>
            </button>

            <input
              ref={scoreInputRef}
              type="file"
              tabIndex={-1}
              aria-label="Choose music sheet file"
              accept="image/*,.pdf,.abc,.xml,.musicxml,.csv,.txt"
              onChange={handleUploadMusicSheet}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => scoreInputRef.current?.click()}
              disabled={isTranscribing}
              title="Upload sheet music image (PNG/JPG/WEBP), PDF, ABC, MusicXML, or CSV"
              className="px-3.5 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] text-xs font-semibold flex items-center gap-1.5 hover:border-[#00E5CC] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isTranscribing ? (
                <Loader2 className="w-3.5 h-3.5 text-[#00E5CC] animate-spin" aria-hidden="true" />
              ) : (
                <FileMusic className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
              )}
              <span>{isTranscribing ? 'Reading Score...' : 'Upload Music Sheet'}</span>
            </button>
          </div>
        </div>

        {isDragActive && (
          <div className="border border-[#00E5CC] rounded-lg bg-[#00E5CC]/15 p-3 text-xs font-medium text-[#00E5CC]">
            Drop your music sheet (PNG, JPG, PDF, ABC, MusicXML, or CSV) anywhere here to translate it into math formulas.
          </div>
        )}

        {uploadStatus && (
          <div className="border border-[#00E5CC] rounded-lg bg-[#00E5CC]/10 p-3 flex items-center gap-2.5 text-xs text-[#EDF2F9]">
            <Loader2 className="w-4 h-4 text-[#00E5CC] animate-spin shrink-0" aria-hidden="true" />
            <span>{uploadStatus}</span>
          </div>
        )}

        {transcribedInfo && (
          <div className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              {transcribedInfo.previewUrl && (
                <img
                  src={transcribedInfo.previewUrl}
                  alt={transcribedInfo.fileName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded object-cover border border-[#1F2A40] shrink-0"
                />
              )}
              <div className="min-w-0">
                <div className="font-semibold text-[#EDF2F9] truncate">
                  Translated Score: {transcribedInfo.fileName}
                </div>
                <div className="font-mono-tabular text-[#8A99B8] mt-0.5 truncate">
                  {transcribedInfo.keySignature} · {transcribedInfo.timeSignature} · Root A1 ={' '}
                  {transcribedInfo.rootHz.toFixed(2)} Hz
                </div>
              </div>
            </div>
            {transcribedInfo.detectedNotes.length > 0 && (
              <div className="font-mono-tabular text-[11px] text-[#00E5CC] truncate max-w-md">
                Notes: {transcribedInfo.detectedNotes.join(' → ')}
              </div>
            )}
          </div>
        )}

        {composeError && (
          <div className="p-3 rounded-md border border-[#F43F5E] bg-[#F43F5E]/10 text-xs text-[#FDA4AF]">
            {composeError}
          </div>
        )}

        {/* Interactive Harmonic Codex View (Explorer Tier) */}
        {studioSubView === 'codex' && (
          <HarmonicCodexPanel
            rootHz={evaluation.cells.A1?.value || 261.63}
            artMode={artMode}
            foundation={foundation}
            imperfection={imperfection}
            bpm={bpm}
            quests={quests}
            onChangeImperfection={(val) => onChangeImperfection?.(val)}
            onApplyMix={(mix) => {
              onReplaceGrid(mix.grid, {
                bpm: mix.bpm,
                title: mix.title,
                rowCount: mix.rowCount,
                voice: mix.voice,
                artMode: mix.artMode,
                foundation: mix.foundation,
                imperfection: mix.imperfection,
              });
              setTranscribedInfo(null);
              setExportNotice(`Loaded "${mix.title}" (${mix.foundation} · δ ${Math.round(mix.imperfection * 100)}%) into the live instrument.`);
            }}
            onJumpToAlgebra={() => setStudioSubView('console')}
            onSelectTier={(tier) => {
              if (onSelectTier) {
                onSelectTier(tier);
              } else {
                setStudioSubView(tier === 'algebra' ? 'console' : 'codex');
              }
            }}
          />
        )}

        {/* Interactive Math <-> Shape <-> Frequency Profile Catalog */}
        {studioSubView === 'catalog' && (
          <MathFormulaCatalog
            grid={grid}
            rootHz={evaluation.cells.A1?.value || 261.63}
            rowCount={rowCount}
            selectedCoord={selectedCoord}
            activeFoundation={foundation}
            activeArtMode={artMode}
            activeVoice={voice}
            imperfection={imperfection}
            onInjectGrid={(nextGrid, opts) => {
              onReplaceGrid(nextGrid, {
                title: activeTitle,
                rowCount: opts.rowCount ?? rowCount,
                bpm,
                voice: opts.voice ?? voice,
                artMode: opts.artMode ?? artMode,
                foundation: opts.foundation,
              });
              setSelectedCoord(opts.primaryCoord);
              setTranscribedInfo(null);
              setExportNotice(opts.notice);
            }}
            onJumpToConsole={(coord) => {
              if (coord) setSelectedCoord(coord);
              setStudioSubView('console');
            }}
          />
        )}

        {/* Asymmetric Split Console: Formula Spreadsheet (Left) + Artwork & Synth Stage (Right) */}
        {(studioSubView === 'console' || studioSubView === 'both') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* LEFT: Interactive Formula Spreadsheet */}
          <section className="lg:col-span-7 border border-[#1F2A40] rounded-lg bg-[#0B0F17] flex flex-col overflow-hidden">
            {/* Formula Bar */}
            <div className="px-4 py-2.5 border-b border-[#1F2A40] bg-[#111622] flex flex-wrap items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-[#07090E] border border-[#1F2A40] font-mono-tabular text-xs font-semibold text-[#00E5CC]">
                {selectedCoord}
              </span>
              <span className="text-xs font-mono text-[#8A99B8]">fx</span>
              <div className="flex-1 min-w-[180px] bg-[#07090E] border border-[#1F2A40] rounded focus-within:border-[#00E5CC]">
                <FormulaCellInput
                  variant="bar"
                  ariaLabel={`Formula for cell ${selectedCoord}`}
                  value={grid[selectedCoord] ?? ''}
                  onFocus={() => setFocusCellTarget(null)}
                  onChange={(nextVal) => onChangeCell(selectedCoord, nextVal)}
                  foundation={foundation}
                  hasError={Boolean(selectedCell?.error)}
                  placeholder="Enter number or =FORMULA(...)"
                />
              </div>
              <button
                type="button"
                onClick={() => setStudioSubView('catalog')}
                title={`Browse Math <-> Shape <-> Frequency Catalog to inject into ${selectedCoord}`}
                className="px-2 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[11px] font-medium text-[#00E5CC] hover:border-[#00E5CC] flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <LayoutGrid className="w-3 h-3" aria-hidden="true" />
                <span>Catalog</span>
              </button>
              <span className="text-[11px] text-[#8A99B8] whitespace-nowrap">
                {selectedCoord === 'A1'
                  ? 'Root Hz (edits transpose song)'
                  : `${colInfo.label} (${colInfo.unit})`}
              </span>
            </div>

            {/* Live Formula Anatomy Breakdown */}
            {formulaAnatomy && (
              <div className="px-4 py-1.5 border-b border-[#1F2A40] bg-[#07090E] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="text-[#00E5CC] font-medium">{formulaAnatomy.summary}</span>
                {formulaAnatomy.parts.slice(0, 3).map((part) => (
                  <span key={part.token} className="text-[#8A99B8] flex items-center gap-1">
                    <code
                      className={`font-mono ${
                        part.role === 'constant'
                          ? 'text-[#F59E0B]'
                          : part.role === 'anchor'
                            ? 'text-[#38BDF8]'
                            : 'text-[#00E5CC]'
                      }`}
                    >
                      {part.token}
                    </code>
                    <span>= {part.meaning.split('(')[0].trim()}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Scrollable Multi-Row Grid Table */}
            <div className="overflow-auto max-h-[430px] flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#111622] text-[#8A99B8] border-b border-[#1F2A40]">
                  <tr>
                    <th className="py-2 px-2.5 font-mono text-center w-10 border-r border-[#1F2A40]">
                      Step
                    </th>
                    {SHEET_COLS.map((col) => {
                      const gens = COLUMN_MATH_GENERATORS[col] ?? [];
                      const isMenuOpen = activeColumnMenu === col;
                      return (
                        <th
                          key={col}
                          title={COLUMN_META[col].hint}
                          className="relative py-2 px-2 font-medium border-r border-[#1F2A40] last:border-r-0"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>
                              <span className="font-mono text-[#00E5CC] mr-1">{col}</span>
                              <span>{COLUMN_META[col].label}</span>
                            </span>
                            {gens.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveColumnMenu(isMenuOpen ? null : col)}
                                title={`Apply a 1-click math generator to Column ${col}`}
                                className={`p-0.5 rounded border text-[10px] cursor-pointer transition-colors ${
                                  isMenuOpen
                                    ? 'border-[#00E5CC] text-[#00E5CC] bg-[#07090E]'
                                    : 'border-transparent text-[#8A99B8] hover:text-[#00E5CC] hover:border-[#1F2A40]'
                                }`}
                              >
                                <Wand2 className="w-3 h-3" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          {isMenuOpen && (
                            <div className="absolute left-0 top-full mt-0.5 z-30 w-64 rounded-md border border-[#1F2A40] bg-[#0B0F17] shadow-2xl p-1.5 flex flex-col gap-1 font-normal text-left">
                              <div className="px-2 py-1 text-[10px] font-mono text-[#8A99B8] border-b border-[#1F2A40]">
                                Fill Column {col} ({COLUMN_META[col].label})
                              </div>
                              {gens.map((gen) => (
                                <button
                                  key={gen.id}
                                  type="button"
                                  onClick={() => handleApplyColumnGenerator(gen)}
                                  className="text-left px-2 py-1.5 rounded hover:bg-[#111622] cursor-pointer flex flex-col gap-0.5"
                                >
                                  <span className="text-xs font-semibold text-[#EDF2F9]">
                                    {gen.label}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#00E5CC] truncate">
                                    {gen.equationPreview}
                                  </span>
                                  <span className="text-[10.5px] text-[#8A99B8] leading-snug">
                                    {gen.description}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </th>
                      );
                    })}
                    <th className="py-2 px-2.5 font-medium text-right">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2A40]">
                  {Array.from({ length: rowCount }, (_, rIdx) => {
                    const rowNum = rIdx + 1;
                    const step = evaluation.steps[rIdx];
                    const isActiveStep = isPlaying && activeRow === rowNum;
                    return (
                      <tr
                        key={rowNum}
                        ref={(el) => {
                          rowRefs.current[rowNum] = el;
                        }}
                        className={isActiveStep ? 'bg-[#00E5CC]/14' : 'hover:bg-[#111622]/50'}
                      >
                        <td
                          className={`py-1.5 px-2.5 text-center font-mono-tabular border-r border-[#1F2A40] ${
                            isActiveStep ? 'text-[#00E5CC] font-bold' : 'text-[#8A99B8]'
                          }`}
                        >
                          {rowNum}
                        </td>
                        {SHEET_COLS.map((col) => {
                          const coord = makeCoord(col, rowNum);
                          const cell = evaluation.cells[coord];
                          const isSelected = selectedCoord === coord;
                          const hasErr = Boolean(cell?.error);
                          const evaluatedDisplay = hasErr
                            ? cell!.error!
                            : Number.isInteger(cell?.value)
                              ? String(cell?.value)
                              : (cell?.value ?? 0).toFixed(1);
                          return (
                            <td
                              key={coord}
                              onClick={() => {
                                setSelectedCoord(coord);
                                setFocusCellTarget(coord);
                              }}
                              title={cell?.isFormula ? `${coord}: ${grid[coord] ?? ''}` : undefined}
                              className={`p-0 border-r border-[#1F2A40] last:border-r-0 cursor-pointer ${
                                isSelected ? 'ring-1 ring-inset ring-[#00E5CC] bg-[#111622]/75' : ''
                              }`}
                            >
                              <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                                {isSelected ? (
                                  <FormulaCellInput
                                    variant="cell"
                                    ariaLabel={`Cell ${coord}`}
                                    value={grid[coord] ?? ''}
                                    autoFocus={focusCellTarget === coord}
                                    onFocus={() => setSelectedCoord(coord)}
                                    onChange={(nextVal) => onChangeCell(coord, nextVal)}
                                    foundation={foundation}
                                    hasError={hasErr}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    readOnly
                                    aria-label={`Cell ${coord}`}
                                    value={evaluatedDisplay}
                                    onFocus={() => {
                                      setSelectedCoord(coord);
                                      setFocusCellTarget(coord);
                                    }}
                                    className={`w-full bg-transparent font-mono-tabular text-xs leading-[18px] focus:outline-none cursor-pointer ${
                                      hasErr
                                        ? 'text-[#F43F5E]'
                                        : cell?.isFormula
                                          ? 'text-[#38BDF8]'
                                          : 'text-[#EDF2F9]'
                                    }`}
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2.5 text-right font-mono-tabular text-[#8A99B8] whitespace-nowrap">
                          {step?.gate <= 0.02 ? 'REST' : step?.noteName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grid Footer */}
            <div className="px-4 py-2.5 border-t border-[#1F2A40] bg-[#111622] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-[#8A99B8]">
                {selectedCell?.error ? (
                  <span className="text-[#F43F5E]">
                    Error in {selectedCoord}: {selectedCell.error}
                  </span>
                ) : evaluation.errorCount > 0 ? (
                  <span className="text-[#F43F5E]">
                    {evaluation.errorCount} cell error(s) isolated — acoustic safety clamps active.
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>Type <code className="font-mono text-[#00E5CC]">=</code> for math autocomplete</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#00E5CC]">Fn</span>
                    <span className="text-[#F59E0B]">φ/π Const</span>
                    <span className="text-[#38BDF8]">Cell Ref</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={csvInputRef}
                  type="file"
                  tabIndex={-1}
                  aria-label="Choose CSV spreadsheet file"
                  accept=".csv,text/csv"
                  onChange={handleImportCsv}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3 h-3" aria-hidden="true" />
                  <span>Import CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3 h-3" aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT: Visual Art Canvas + Math Coupling + Oscilloscope + Exports */}
          <section className="lg:col-span-5 border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-3.5 flex flex-col justify-between gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-[#EDF2F9] truncate">
                  {activeTitle}
                </h2>
                <p className="text-xs text-[#8A99B8] mt-0.5">
                  {ART_MODES.find((m) => m.id === artMode)?.label ?? artMode} ·{' '}
                  {SYNTH_VOICES.find((v) => v.id === voice)?.label}
                </p>
              </div>
              <span className="font-mono-tabular text-xs text-[#00E5CC] whitespace-nowrap shrink-0">
                Step {activeRow}/{rowCount} · {activeStep?.gate <= 0.02 ? 'REST' : activeStep?.noteName}
              </span>
            </div>

            {/* Mathematical Foundations Toggle (Dynamic FM Synth + SVG Coupling) */}
            <div className="flex flex-col gap-1">
              <div
                role="group"
                aria-label="Mathematical foundation"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-md border border-[#1F2A40] bg-[#07090E]"
              >
                {MATH_FOUNDATIONS.map((item) => {
                  const active = item.id === foundation;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChangeFoundation(item.id)}
                      title={`${item.principle} — ${item.musicalEffect}`}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap truncate ${
                        active
                          ? 'bg-[#111622] text-[#00E5CC] border border-[#00E5CC]/60'
                          : 'text-[#8A99B8] hover:text-[#EDF2F9] border border-transparent'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10.5px] font-mono text-[#8A99B8] flex items-center justify-between gap-2 px-0.5">
                <span className="text-[#EDF2F9] truncate">{foundationSpec.equation}</span>
                <span className="text-[#38BDF8] whitespace-nowrap shrink-0">
                  {foundation === 'harmonic-sine'
                    ? '2π Harmonic Series'
                    : foundation === 'fibonacci'
                      ? 'F_n Mod Sidebands'
                      : foundation === 'golden-ratio'
                        ? 'φ = 1.618 Phyllotaxis'
                        : '3:2 Just Intonation'}
                </span>
              </div>
            </div>

            {/* Interactive Lines <-> Music Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setIsDrawMode((v) => !v)}
                className={`px-2.5 py-1 rounded border font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                  isDrawMode
                    ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                    : 'border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] hover:border-[#00E5CC]'
                }`}
              >
                <PenTool className="w-3 h-3" aria-hidden="true" />
                <span>{isDrawMode ? 'Drawing Line -> Formulas' : 'Draw Line -> Music'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleApplyPolygon(3, 1, 'Triangle (Augmented Triad)')}
                  title="3 symmetric vertices (120 deg = Major 3rds)"
                  className="px-2 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
                >
                  Triangle
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPolygon(4, 1, 'Square (Diminished Symmetry)')}
                  title="4 symmetric vertices (90 deg = Minor 3rds)"
                  className="px-2 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
                >
                  Square
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPolygon(6, 1, 'Hexagon (Whole-Tone Scale)')}
                  title="6 symmetric vertices (60 deg = Whole-tone scale)"
                  className="px-2 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
                >
                  Hexagon
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPolygon(12, 7, 'Circle of Fifths (3:2 Star)')}
                  title="12-pointed star stepping by 7 semitones (3:2 Fifths)"
                  className="px-2 py-1 rounded border border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
                >
                  5ths Star
                </button>
              </div>
            </div>

            {/* Clean Calibration Grid & Interactive Line->Music Canvas (Zero Cluttered JPG Overlay) */}
            <div
              className={`relative border rounded-md bg-[#07090E] overflow-hidden ${
                isDrawMode ? 'border-[#F59E0B]' : 'border-[#1F2A40]'
              }`}
            >
              <svg
                ref={artSvgRef}
                viewBox="0 0 440 280"
                onPointerDown={handleArtPointerDown}
                onPointerMove={handleArtPointerMove}
                onPointerUp={handleArtPointerUp}
                className={`relative z-10 w-full h-[204px] block select-none ${
                  isDrawMode ? 'cursor-crosshair touch-none' : ''
                }`}
                role="img"
                aria-label="Interactive parametric artwork coupled mathematically to spreadsheet song formulas"
              >
                <circle
                  cx="220"
                  cy="140"
                  r="114"
                  fill="none"
                  stroke="#1F2A40"
                  strokeWidth="0.9"
                  strokeDasharray="3 4"
                />
                {artMode === 'pitch-spiral' && (
                  <>
                    <circle
                      cx="220"
                      cy="140"
                      r="46"
                      fill="none"
                      stroke="#1F2A40"
                      strokeWidth="0.7"
                      strokeDasharray="2 3"
                    />
                    <circle
                      cx="220"
                      cy="140"
                      r="80"
                      fill="none"
                      stroke="#1F2A40"
                      strokeWidth="0.7"
                      strokeDasharray="2 3"
                    />
                    {Array.from({ length: 12 }, (_, k) => {
                      const ang = (k / 12) * Math.PI * 2 - Math.PI / 2;
                      return (
                        <line
                          key={k}
                          x1={220 + Math.cos(ang) * 108}
                          y1={140 + Math.sin(ang) * 100}
                          x2={220 + Math.cos(ang) * 116}
                          y2={140 + Math.sin(ang) * 108}
                          stroke="#34466B"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </>
                )}
                <line x1="220" y1="12" x2="220" y2="268" stroke="#1F2A40" strokeWidth="0.8" />
                <line x1="12" y1="140" x2="428" y2="140" stroke="#1F2A40" strokeWidth="0.8" />

                <path
                  d={vectorArt.haloPathD}
                  fill="none"
                  stroke="#38BDF8"
                  strokeOpacity="0.3"
                  strokeWidth="1.2"
                />
                <path
                  d={vectorArt.secondaryPathD}
                  fill="none"
                  stroke="#F59E0B"
                  strokeOpacity="0.58"
                  strokeWidth="1.35"
                  strokeLinejoin="round"
                />
                <path
                  d={vectorArt.primaryPathD}
                  fill="none"
                  stroke="#00E5CC"
                  strokeWidth="2.1"
                  strokeLinejoin="round"
                />

                {drawnStroke.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={drawnStroke.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')}
                  />
                )}

                {vectorArt.vertices.map((v) => {
                  const isStep = v.row === activeRow;
                  const step = evaluation.steps[v.row - 1];
                  return (
                    <circle
                      key={v.row}
                      cx={v.x}
                      cy={v.y}
                      r={isStep ? 6 : v.gate > 0.05 ? 3.1 : 1.7}
                      fill={isStep ? '#F59E0B' : v.gate > 0.05 ? '#00E5CC' : '#34466B'}
                      stroke={isStep ? '#EDF2F9' : 'none'}
                      strokeWidth={1.6}
                      className={isDrawMode ? '' : 'cursor-pointer'}
                      onClick={() => {
                        if (isDrawMode) return;
                        setSelectedCoord(`A${v.row}`);
                        if (step) chimeraAudio.triggerStep(step, voice, foundation, imperfection);
                      }}
                    >
                      <title>
                        Step {v.row}: {v.noteName} ({v.freqHz.toFixed(1)} Hz · ratio {v.ratioLabel})
                      </title>
                    </circle>
                  );
                })}
                {activeVertex && (() => {
                  const labelText =
                    activeStep?.gate <= 0.02
                      ? 'REST'
                      : `${activeVertex.noteName} (${activeVertex.ratioLabel})`;
                  const boxWidth = Math.max(66, labelText.length * 6.8 + 14);
                  const boxX = Math.min(426 - boxWidth, Math.max(14, activeVertex.x + 10));
                  const boxY = Math.max(12, activeVertex.y - 26);
                  return (
                    <g pointerEvents="none">
                      <rect
                        x={boxX}
                        y={boxY}
                        width={boxWidth}
                        height={20}
                        rx={4}
                        fill="rgba(7, 9, 14, 0.88)"
                        stroke="rgba(245, 158, 11, 0.55)"
                        strokeWidth="1"
                      />
                      <text
                        x={boxX + 7}
                        y={boxY + 14}
                        fill="#F59E0B"
                        fontFamily="JetBrains Mono, monospace"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })()}
              </svg>
              {isDrawMode && (
                <div className="px-3 py-1.5 border-t border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[11px] text-[#F59E0B]">
                  Drag across the circle to turn drawn lines into =A1*POW(2,k/12) formulas (angle = note, radius = octave/FM).
                </div>
              )}
            </div>

            {/* Mathematical Ratio, ComplexityEngine Harmony Score & Real-Time Symmetry Advisor */}
            <div className="border border-[#1F2A40] rounded-md bg-[#07090E] px-3 py-2 text-[11px] flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular">
                <span className="text-[#00E5CC]">
                  Ratio {activeStepRatio?.p ?? 1}:{activeStepRatio?.q ?? 1} ({activeStepRatio?.label ?? 'Unison'})
                </span>
                <span className="text-[#8A99B8]">
                  Symmetry {vectorArt.symmetry.symmetryIndex}% · {vectorArt.symmetry.symmetryClass}
                </span>
              </div>
              <div className="font-mono text-[10px] text-[#8A99B8] flex items-center justify-between gap-2">
                <span>
                  x(t)=sin({activeStepRatio?.p ?? 1}ωt) · y(t)=sin({activeStepRatio?.q ?? 1}ωt+φ)
                </span>
                <span className="text-[#38BDF8]">
                  FM I={(activeSynthMod?.effectiveFmIndex ?? activeStep?.fmIndex ?? 0).toFixed(2)}
                </span>
              </div>

              {/* ComplexityEngine Readout */}
              <div className="pt-1.5 border-t border-[#1F2A40]/80 flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular">
                  <span className="text-[#EDF2F9] font-semibold">
                    Harmony{' '}
                    <span
                      className={
                        complexityReport.harmonyScore >= 75
                          ? 'text-[#00E5CC]'
                          : complexityReport.harmonyScore >= 55
                            ? 'text-[#F59E0B]'
                            : 'text-[#F43F5E]'
                      }
                    >
                      {complexityReport.harmonyScore}/100
                    </span>{' '}
                    <span className="text-[#8A99B8] font-normal">({complexityReport.grade})</span>
                  </span>
                  <span className="text-[10px] text-[#38BDF8]">
                    {complexityReport.formulaCount} formulas : {complexityReport.visualVertexCount} vertices (
                    {complexityReport.formulaToVertexRatio.toFixed(3)})
                  </span>
                </div>

                {complexityReport.suggestions.slice(0, 2).map((sug) => (
                  <div
                    key={sug.id}
                    className="flex items-center justify-between gap-2 rounded border border-[#1F2A40]/70 bg-[#0B0F17] px-2 py-1 text-[10.5px]"
                  >
                    <div className="min-w-0">
                      <span
                        className={`font-semibold ${
                          sug.priority === 'high'
                            ? 'text-[#F59E0B]'
                            : sug.priority === 'medium'
                              ? 'text-[#38BDF8]'
                              : 'text-[#00E5CC]'
                        }`}
                      >
                        {sug.title}:
                      </span>{' '}
                      <span className="text-[#8A99B8]">{sug.detail}</span>
                    </div>
                    {sug.recommendedFormula && sug.recommendedCol && (
                      <button
                        type="button"
                        onClick={() => handleApplySymmetrySuggestion(sug)}
                        className="px-2 py-0.5 rounded border border-[#00E5CC]/60 bg-[#07090E] text-[#00E5CC] text-[10px] font-semibold hover:bg-[#00E5CC] hover:text-[#07090E] shrink-0 cursor-pointer"
                      >
                        {sug.actionLabel ?? 'Apply'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Oscilloscope & Telemetry Readout */}
            <div className="border border-[#1F2A40] rounded-md bg-[#07090E] px-3 py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-[#8A99B8]">Synth Waveform</span>
                <span className="text-[#EDF2F9]">
                  {activeStep?.freqHz.toFixed(1)} Hz · FM {(activeSynthMod?.effectiveFmIndex ?? activeStep?.fmIndex ?? 0).toFixed(1)}{' '}
                  (×{(activeSynthMod?.effectiveModRatio ?? activeStep?.modRatio ?? 2).toFixed(2)}) ·{' '}
                  {(activeSynthMod?.effectiveDecayMs ?? activeStep?.decayMs ?? 220).toFixed(0)} ms
                </span>
              </div>
              <svg viewBox="0 0 320 52" className="w-full h-9">
                <line x1="0" y1="26" x2="320" y2="26" stroke="#1F2A40" strokeWidth="1" />
                <polyline fill="none" stroke="#38BDF8" strokeWidth="1.75" points={wavePoints} />
              </svg>
            </div>

            {/* 3 Concrete Exports */}
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleExportWav}
                  className="px-2.5 py-2 rounded-md bg-[#00E5CC] text-[#07090E] text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Audio .wav</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="px-2.5 py-2 rounded-md border border-[#1F2A40] bg-[#111622] text-[#EDF2F9] text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Vector .svg</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="px-2.5 py-2 rounded-md border border-[#1F2A40] bg-[#111622] text-[#EDF2F9] text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Poster .png</span>
                </button>
              </div>
              {exportNotice && (
                <div className="text-xs text-[#00E5CC] font-medium">{exportNotice}</div>
              )}
            </div>
          </section>
        </div>
        )}

        {/* Graft Editor View: Side-by-Side Spreadsheet Configurations, Data Mapping Contracts & Verifier */}
        {(studioSubView === 'graft' || studioSubView === 'both') && (
          <GraftEditorView
            presets={presets}
            liveGrid={grid}
            liveTitle={activeTitle}
            bpm={bpm}
            voice={voice}
            artMode={artMode}
            foundation={foundation}
            onApplyGraftedGrid={(graftedGrid, opts) => {
              onReplaceGrid(graftedGrid, opts);
              setTranscribedInfo(null);
            }}
          />
        )}
      </div>
    </main>
  );
}
