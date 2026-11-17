import { Code2, Play, Sparkles, Square } from 'lucide-react';
import { AppView } from '../types/chimera';

interface TopBarProps {
  activeView: AppView;
  studioDrawerOpen?: boolean;
  onSelectView: (view: AppView) => void;
  onToggleStudioDrawer?: () => void;
  isPlaying: boolean;
  bpm?: number;
  onTogglePlay: () => void;
}

export function TopBar({
  activeView,
  studioDrawerOpen = false,
  onSelectView,
  onToggleStudioDrawer,
  isPlaying,
  bpm = 116,
  onTogglePlay,
}: TopBarProps) {
  const isInstrumentActive = activeView === 'stage' || activeView === 'studio';
  const isSubmissionActive = activeView === 'kiroween' || activeView === 'verify';

  return (
    <header className="h-13 px-5 border-b border-[#1E293B] bg-[#07090E] flex items-center justify-between gap-4 shrink-0 z-30">
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onSelectView('stage')}
          className="font-display text-base font-bold tracking-tight text-[#EDF2F9] hover:text-[#00E5CC] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#00E5CC]"
        >
          <span className="w-2 h-2 rounded-full bg-[#00E5CC]" aria-hidden="true" />
          <span>Harmoglyph</span>
        </button>
        <span className="hidden sm:inline-block text-[11px] font-mono text-[#8A99B8] border-l border-[#1E293B] pl-3">
          3D Harmonic Spreadsheet Instrument
        </span>
      </div>

      {/* Center: Laws of UX (Hick's Law) — 2 Primary Modes + Progressive Studio Trigger */}
      <nav
        className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#0B0F17] p-1"
        aria-label="Primary navigation"
      >
        <button
          type="button"
          onClick={() => onSelectView('stage')}
          className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            isInstrumentActive && !studioDrawerOpen
              ? 'bg-[#00E5CC] text-[#07090E]'
              : isInstrumentActive
                ? 'bg-[#111622] text-[#00E5CC] border border-[#00E5CC]/40'
                : 'text-[#8A99B8] hover:text-[#EDF2F9]'
          }`}
        >
          3D Instrument
        </button>

        {onToggleStudioDrawer && (
          <button
            type="button"
            onClick={onToggleStudioDrawer}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              studioDrawerOpen || activeView === 'studio'
                ? 'bg-[#00E5CC] text-[#07090E] font-semibold'
                : 'text-[#8A99B8] hover:text-[#EDF2F9]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Formula &amp; Graft Drawer</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectView('kiroween')}
          className={`px-3.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
            isSubmissionActive
              ? 'bg-[#00E5CC] text-[#07090E]'
              : 'text-[#8A99B8] hover:text-[#EDF2F9]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Submission</span>
        </button>
      </nav>

      {/* Right: Von Restorff Isolated Primary Audio Transport CTA */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlay}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00E5CC] ${
            isPlaying
              ? 'bg-[#F43F5E] text-white hover:opacity-90'
              : 'bg-[#00E5CC] text-[#07090E] hover:opacity-90'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Stop · {bpm} BPM</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Play · {bpm} BPM</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
