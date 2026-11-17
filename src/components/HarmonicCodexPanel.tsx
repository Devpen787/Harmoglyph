import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Sliders,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  ArtModeId,
  ExperienceTierId,
  MathFoundationId,
  SheetRawGrid,
  SynthVoiceId,
} from '../types/chimera';
import {
  CODEX_EXPERIMENTS,
  CODEX_GEOMETRY_FORMS,
  CODEX_MOD_LAWS,
  CODEX_PITCH_LAWS,
  compileCodexMix,
  evaluateCodexCompatibility,
  HarmonicQuestProgress,
} from '../engine/harmonicCodex';

interface HarmonicCodexPanelProps {
  rootHz: number;
  artMode: ArtModeId;
  foundation: MathFoundationId;
  imperfection: number;
  bpm: number;
  quests: HarmonicQuestProgress[];
  onChangeImperfection: (value: number) => void;
  onApplyMix: (payload: {
    grid: SheetRawGrid;
    rowCount: number;
    title: string;
    artMode: ArtModeId;
    foundation: MathFoundationId;
    voice: SynthVoiceId;
    bpm: number;
    imperfection: number;
  }) => void;
  onJumpToAlgebra: () => void;
  onSelectTier: (tier: ExperienceTierId) => void;
}

export function HarmonicCodexPanel({
  rootHz,
  artMode,
  imperfection,
  bpm,
  quests,
  onChangeImperfection,
  onApplyMix,
  onJumpToAlgebra,
  onSelectTier,
}: HarmonicCodexPanelProps) {
  const [selectedPitchId, setSelectedPitchId] = useState<string>(CODEX_PITCH_LAWS[2].id);
  const [selectedModId, setSelectedModId] = useState<string>(CODEX_MOD_LAWS[1].id);
  const [selectedGeoId, setSelectedGeoId] = useState<ArtModeId>(artMode);

  const compatibility = useMemo(
    () => evaluateCodexCompatibility(selectedPitchId, selectedModId, selectedGeoId, imperfection),
    [selectedPitchId, selectedModId, selectedGeoId, imperfection],
  );

  const handleApplyCurrentMix = () => {
    const compiled = compileCodexMix(selectedPitchId, selectedModId, selectedGeoId, {
      rootHz,
      rowCount: 12,
      bpm,
      imperfection,
    });
    onApplyMix(compiled);
  };

  const handleRunExperiment = (expId: string) => {
    const exp = CODEX_EXPERIMENTS.find((e) => e.id === expId);
    if (!exp) return;
    setSelectedPitchId(exp.pitchId);
    setSelectedModId(exp.modId);
    setSelectedGeoId(exp.geoId);
    const compiled = compileCodexMix(exp.pitchId, exp.modId, exp.geoId, {
      rootHz,
      rowCount: 12,
      bpm: exp.bpm,
      imperfection: exp.imperfection,
    });
    onApplyMix({ ...compiled, title: exp.title });
  };

  const completedCount = quests.filter((q) => q.completed).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 1-Click Starter Experiments: Perfection vs Living Imperfection */}
      <section className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div>
            <h2 className="font-display text-sm font-bold text-[#EDF2F9] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#00E5CC]" aria-hidden="true" />
              <span>01. Compare Math Laws Instantly</span>
            </h2>
            <p className="text-xs text-[#8A99B8] mt-0.5">
              Hear and watch how crystal integer ratios, Fibonacci spirals, golden ratios, and organic imperfection sculpt new shapes.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#8A99B8]">
            Pick an experiment or mix your own below
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {CODEX_EXPERIMENTS.map((exp) => (
            <button
              key={exp.id}
              type="button"
              onClick={() => handleRunExperiment(exp.id)}
              className="text-left p-3 rounded-md border border-[#1F2A40] bg-[#07090E] hover:border-[#00E5CC] transition-colors flex flex-col justify-between gap-2 cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-[#EDF2F9]">{exp.title}</div>
                <p className="text-[11px] text-[#8A99B8] mt-1 leading-snug">{exp.subtitle}</p>
              </div>
              <div className="flex items-center justify-between text-[10.5px] font-mono text-[#00E5CC] pt-1 border-t border-[#1F2A40]/70">
                <span>δ {Math.round(exp.imperfection * 100)}%</span>
                <span>Load &amp; Play</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Mix & Match Codex Matrix */}
      <section className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-[#EDF2F9] flex items-center gap-2">
              <Waves className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
              <span>02. Mix &amp; Match Codex (Math → Music → Shape)</span>
            </h2>
            <p className="text-xs text-[#8A99B8] mt-0.5">
              Combine a Pitch Law, Modulation/Rhythm rule, and Geometry form. Compatible laws lock cleanly; contrasting laws create living tension.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Lane 1: Pitch Law */}
          <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-mono text-[#00E5CC] font-semibold pb-1 border-b border-[#1F2A40]">
              A. Pitch Law (Column A Frequency)
            </div>
            {CODEX_PITCH_LAWS.map((p) => {
              const active = p.id === selectedPitchId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPitchId(p.id)}
                  className={`text-left p-2 rounded border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#00E5CC] bg-[#111622]'
                      : 'border-transparent hover:border-[#34466B] bg-[#0B0F17]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#EDF2F9]">{p.title}</span>
                    <span className="text-[10px] font-mono text-[#8A99B8]">{p.nature}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-[#38BDF8] mt-0.5 truncate">
                    {p.equation}
                  </div>
                  <div className="text-[11px] text-[#8A99B8] mt-1 leading-snug">
                    {p.musicalResult}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lane 2: Rhythm & FM Law */}
          <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-mono text-[#F59E0B] font-semibold pb-1 border-b border-[#1F2A40]">
              B–F. Rhythm &amp; Texture Law
            </div>
            {CODEX_MOD_LAWS.map((m) => {
              const active = m.id === selectedModId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModId(m.id)}
                  className={`text-left p-2 rounded border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#F59E0B] bg-[#111622]'
                      : 'border-transparent hover:border-[#34466B] bg-[#0B0F17]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#EDF2F9]">{m.title}</span>
                    <span className="text-[10px] font-mono text-[#8A99B8]">{m.nature}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-[#F59E0B] mt-0.5 truncate">
                    {m.equation}
                  </div>
                  <div className="text-[11px] text-[#8A99B8] mt-1 leading-snug">
                    {m.shapeResult}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lane 3: Geometry Topology */}
          <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-2.5 flex flex-col gap-2">
            <div className="text-[11px] font-mono text-[#38BDF8] font-semibold pb-1 border-b border-[#1F2A40]">
              3D / 2D Shape Projection
            </div>
            {CODEX_GEOMETRY_FORMS.map((g) => {
              const active = g.id === selectedGeoId;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGeoId(g.id)}
                  className={`text-left p-2 rounded border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#38BDF8] bg-[#111622]'
                      : 'border-transparent hover:border-[#34466B] bg-[#0B0F17]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#EDF2F9]">
                      {g.sculptTitle}
                    </span>
                    <span className="text-[10px] font-mono text-[#8A99B8]">
                      {g.vectorTitle}
                    </span>
                  </div>
                  <div className="font-mono text-[10.5px] text-[#00E5CC] mt-0.5 truncate">
                    {g.equation}
                  </div>
                  <div className="text-[11px] text-[#8A99B8] mt-1 leading-snug">
                    {g.connectionNote}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compatibility Diagnosis & Apply Bar */}
        <div className="border border-[#1F2A40] rounded-md bg-[#111622] p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`font-mono font-semibold ${
                  compatibility.status === 'resonant'
                    ? 'text-[#00E5CC]'
                    : compatibility.status === 'organic'
                      ? 'text-[#F59E0B]'
                      : 'text-[#F43F5E]'
                }`}
              >
                {compatibility.badgeLabel.toUpperCase()}
              </span>
              <span className="text-[#8A99B8]" aria-hidden="true">·</span>
              <span className="font-semibold text-[#EDF2F9]">{compatibility.headline}</span>
            </div>
            <p className="text-xs text-[#8A99B8] leading-snug">
              {compatibility.explanation}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs">
              <Sliders className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
              <span className="text-[#8A99B8]">Imperfection δ</span>
              <input
                type="range"
                aria-label="Organic Imperfection Delta"
                min={0}
                max={100}
                value={Math.round(imperfection * 100)}
                onChange={(e) => onChangeImperfection(Number(e.target.value) / 100)}
                className="w-20 accent-[#F59E0B] cursor-pointer"
              />
              <span className="font-mono-tabular text-[#EDF2F9] w-9 text-right">
                {Math.round(imperfection * 100)}%
              </span>
            </label>

            <button
              type="button"
              onClick={handleApplyCurrentMix}
              className="px-4 py-2 rounded-md bg-[#00E5CC] text-[#07090E] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Apply Mix to Instrument</span>
            </button>

            <button
              type="button"
              onClick={onJumpToAlgebra}
              className="px-3 py-2 rounded-md border border-[#1F2A40] bg-[#07090E] text-[#EDF2F9] text-xs font-medium flex items-center gap-1.5 hover:border-[#00E5CC] cursor-pointer whitespace-nowrap"
            >
              <span>Inspect Formulas</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Progressive Harmonic Quests (Simplest Discovery -> Deep Algebra) */}
      <section className="border border-[#1F2A40] rounded-lg bg-[#0B0F17] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div>
            <h2 className="font-display text-sm font-bold text-[#EDF2F9]">
              03. Progressive Mastery Quests
            </h2>
            <p className="text-xs text-[#8A99B8] mt-0.5">
              Start with crystal ratios, break them with living imperfection, then compose original equations.
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-semibold text-[#00E5CC]">
            {completedCount}/{quests.length} Mastered
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {quests.map((q) => (
            <div
              key={q.id}
              className={`rounded-md border p-2.5 flex flex-col justify-between gap-2 ${
                q.completed
                  ? 'border-[#00E5CC]/60 bg-[#00E5CC]/8'
                  : 'border-[#1F2A40] bg-[#07090E]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 text-[10.5px] font-mono">
                  <span className={q.completed ? 'text-[#00E5CC] font-semibold' : 'text-[#8A99B8]'}>
                    Q{q.stepNumber} · {q.tier.toUpperCase()}
                  </span>
                  {q.completed && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5CC] shrink-0" aria-hidden="true" />
                  )}
                </div>
                <div className="text-xs font-semibold text-[#EDF2F9] mt-1">{q.title}</div>
                <p className="text-[11px] text-[#8A99B8] mt-1 leading-snug">{q.prompt}</p>
              </div>

              <div className="pt-1.5 border-t border-[#1F2A40]/70 flex items-center justify-between gap-1 text-[10px] font-mono">
                <span className="text-[#38BDF8] truncate">{q.progressText}</span>
                {!q.completed && (
                  <button
                    type="button"
                    onClick={() => onSelectTier(q.tier)}
                    className="text-[#00E5CC] hover:underline shrink-0 cursor-pointer"
                  >
                    Try
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
