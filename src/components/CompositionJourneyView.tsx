import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Eye, Music2, Pause, Play, Plus, RotateCcw, Sparkles, Trash2, WandSparkles } from 'lucide-react';
import { chimeraAudio } from '../engine/audioSynth';
import {
  COMPOSITION_PRESETS, MAX_COMPOSITION_BEATS, PHRASE_COLORS, canProjectToSpreadsheet,
  cloneComposition, deriveGeometry, midiToHz, noteAsSynthStep, noteName,
  projectToSpreadsheet, sortedNotes, totalBeats, validateComposition,
  type CompositionNote, type GeometryMark, type MusicalComposition,
} from '../engine/composition';
import { beatAtAudioTime, CompositionLookaheadCursor, planCompositionTimeline } from '../engine/compositionTimeline';
import { computeRibbonFrame, describeNoteMotion, overlappingNoteIds, ribbonSegments, RIBBON_MAPPINGS, type RibbonTrackFrame } from '../engine/compositionMotion';
import { buildLuminousLayer, LUMINOUS_MAPPINGS, type LuminousLayer } from '../engine/currentMaterial';
import { buildFilamentLayer, FILAMENT_MAPPINGS, FILAMENT_PALETTE, type FilamentLayer } from '../engine/filamentMaterial';
import { computeCurrentFrame, describeCurrentNote, CURRENT_MAPPINGS, DEFAULT_CURRENT_CONFIG, type CurrentCoupling } from '../engine/compositionCurrent';

type ArtGrammar = 'orbit' | 'bloom' | 'weave' | 'ribbon' | 'current' | 'luminous' | 'filament';
/** Flow grammars share the Current motion engine; 'luminous' is only a different visual material. */
const isFlowGrammar = (g: ArtGrammar) => g === 'current' || g === 'luminous' || g === 'filament';
const isMotionGrammar = (g: ArtGrammar) => g === 'ribbon' || isFlowGrammar(g);

interface Props {
  composition: MusicalComposition;
  onChange: (next: MusicalComposition) => void;
  onOpenInstrument: (composition: MusicalComposition, projection: ReturnType<typeof projectToSpreadsheet>) => void;
}

const format = (value: number, digits = 2) => value.toFixed(digits);
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const point = (radius: number, angle: number) => ({ x: 300 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius });
const polarArc = (radius: number, start: number, sweep: number) => {
  const a = point(radius, start);
  const b = point(radius, start + Math.max(.0001, sweep));
  return `M ${format(a.x)} ${format(a.y)} A ${format(radius)} ${format(radius)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${format(b.x)} ${format(b.y)}`;
};

// A closed leaf derived from a note's precise angular footprint; curvature is an explicit style choice.
const bloomPath = (mark: GeometryMark, sweep: number) => {
  const a = point(mark.radius, mark.startAngle);
  const b = point(mark.radius, mark.startAngle + sweep);
  const center = mark.startAngle + sweep / 2;
  const bloom = 11 + Math.min(28, Math.abs(Math.log2(mark.ratioToRoot)) * 11);
  const outer = point(Math.min(285, mark.radius + bloom), center);
  const inner = point(Math.max(30, mark.radius - bloom * .68), center);
  return `M ${format(a.x)} ${format(a.y)} Q ${format(outer.x)} ${format(outer.y)} ${format(b.x)} ${format(b.y)} Q ${format(inner.x)} ${format(inner.y)} ${format(a.x)} ${format(a.y)} Z`;
};

interface ActiveTransport {
  originAudioSeconds: number;
  fromBeat: number;
  cursor: CompositionLookaheadCursor;
}

const MIDI_OPTIONS = Array.from({ length: 37 }, (_, i) => 48 + i);
const durationOptions = [.5, 1, 1.5, 2, 3, 4];
const countLabel = (count: number) => String(count).padStart(2, '0');

export function CompositionJourneyView({ composition, onChange, onOpenInstrument }: Props) {
  const [selectedId, setSelectedId] = useState<string>(composition.notes[0]?.id ?? '');
  const [activeTrack, setActiveTrack] = useState<string>(composition.tracks[0]?.id ?? 'lead');
  const [addPitch, setAddPitch] = useState(67);
  const [addDuration, setAddDuration] = useState(1);
  const [grammar, setGrammar] = useState<ArtGrammar>('orbit');
  const [performing, setPerforming] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showComplete, setShowComplete] = useState(true);
  const [showMath, setShowMath] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const transportRef = useRef<ActiveTransport | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const notes = useMemo(() => sortedNotes(composition), [composition]);
  const marks = useMemo(() => deriveGeometry(composition), [composition]);
  const span = totalBeats(composition);
  const selected = notes.find((n) => n.id === selectedId) ?? notes[0];
  const selectedMark = marks.find((m) => m.noteId === selected?.id);
  const invalid = validateComposition(composition);
  const progress = showComplete ? span : playhead;
  const painted = notes.filter((note) => progress >= note.startBeat + note.durationBeats - .00001).length;
  const currentPhrase = Math.min(Math.ceil(span / composition.beatsPerBar), Math.floor(progress / composition.beatsPerBar) + 1);
  const barCount = Math.ceil(span / composition.beatsPerBar);
  const canOpen3d = canProjectToSpreadsheet(composition);
  // Motion grammars are pure functions of (score, beat): the audio-clock playhead drives them, nothing else.
  const motion = useMemo(() => {
    if (!isMotionGrammar(grammar) || invalid.length) return null;
    let tracks: RibbonTrackFrame[];
    let annotations: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; title: string }> = [];
    let threads: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; strength: number }> = [];
    let couplings: CurrentCoupling[] = [];
    let luminous: LuminousLayer | null = null;
    let filament: FilamentLayer | null = null;
    if (grammar === 'ribbon') {
      const frame = computeRibbonFrame(composition, progress);
      tracks = frame.tracks;
      annotations = frame.relationships.map((rel) => ({ key: rel.noteIds.join('-'), x1: rel.from.x, y1: rel.from.y, x2: rel.to.x, y2: rel.to.y,
        title: `Annotation only: ${rel.noteIds.join(' + ')} start together, ${Math.abs(rel.semitones)} semitones apart. The voices do not affect each other in Ribbon.` }));
    } else {
      const frame = computeCurrentFrame(composition, progress);
      tracks = frame.tracks;
      couplings = frame.couplings;
      if (grammar === 'luminous') luminous = buildLuminousLayer(composition, frame, computeCurrentFrame(composition, span));
      if (grammar === 'filament') filament = buildFilamentLayer(composition, frame, computeCurrentFrame(composition, span));
      // Draw the real coupling λ as faint threads from each pulled voice to the melody at the same beat.
      const lead = frame.tracks[0];
      const byBeat = new Map(lead.samples.map((x) => [x.beat, x]));
      for (const t of frame.tracks.slice(1)) {
        frame.pull[t.trackId].forEach((l, i) => {
          const q = t.samples[i];
          const p = byBeat.get(q.beat);
          if (!luminous && !filament && p && l > 0.02 && i % 4 === 0) threads.push({ key: `${t.trackId}-${i}`, x1: q.x, y1: q.y, x2: p.x, y2: p.y, strength: l / DEFAULT_CURRENT_CONFIG.couplingMax });
        });
      }
    }
    const segments = tracks.flatMap((track) => ribbonSegments(track).map((seg) => ({ ...seg, trackIndex: track.trackIndex })));
    return { tracks, segments, annotations, threads, couplings, luminous, filament };
  }, [grammar, composition, progress, invalid.length, span]);
  const alsoSounding = useMemo(() => (selected && isMotionGrammar(grammar) ? overlappingNoteIds(composition, selected.id) : []), [grammar, composition, selected]);
  const selectedMotion = useMemo(() => {
    if (grammar !== 'ribbon' || invalid.length || !selected) return null;
    try { return describeNoteMotion(composition, selected.id); } catch { return null; }
  }, [grammar, composition, selected, invalid.length]);
  const selectedCurrent = useMemo(() => {
    if (!isFlowGrammar(grammar) || invalid.length || !selected) return null;
    try { return describeCurrentNote(composition, selected.id); } catch { return null; }
  }, [grammar, composition, selected, invalid.length]);

  const stopTransport = () => {
    setPlaying(false);
    transportRef.current = null;
    chimeraAudio.stopScheduledNotes();
  };

  const commit = (next: MusicalComposition, fromPreset = false) => {
    stopTransport();
    setPlayhead(0);
    setShowComplete(true);
    onChange(fromPreset ? next : { ...next, id: 'custom' });
  };

  const updateNote = (id: string, change: Partial<CompositionNote>) => {
    commit({ ...composition, notes: composition.notes.map((note) => note.id === id ? { ...note, ...change } : note) });
  };

  const choosePreset = (id: string) => {
    const preset = COMPOSITION_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const next = cloneComposition(preset);
    commit(next, true);
    setSelectedId(next.notes[0]?.id ?? '');
    setActiveTrack(next.tracks[0].id);
  };

  const startWithOne = () => choosePreset('first-mark');
  const showFinishedExample = () => {
    choosePreset('glass-garden');
    setPerforming(true);
  };

  const audition = (note: CompositionNote) => {
    setSelectedId(note.id);
    const track = composition.tracks.find((t) => t.id === note.trackId);
    chimeraAudio.triggerStep(noteAsSynthStep(note, composition.bpm), track?.voice ?? 'music-box', 'harmonic-sine', 0);
  };

  const addNote = () => {
    const trackNotes = notes.filter((note) => note.trackId === activeTrack);
    const startBeat = Math.max(0, ...trackNotes.map((note) => note.startBeat + note.durationBeats));
    if (startBeat + addDuration > MAX_COMPOSITION_BEATS) return;
    const id = `${activeTrack}-${Date.now()}-${composition.notes.length + 1}`;
    commit({ ...composition, notes: [...composition.notes, { id, trackId: activeTrack, midi: addPitch, startBeat, durationBeats: addDuration, velocity: .78 }] });
    setSelectedId(id);
  };

  const addTrack = () => {
    if (composition.tracks.length >= 3) return;
    const id = `voice-${composition.tracks.length + 1}`;
    commit({ ...composition, tracks: [...composition.tracks, { id, label: `Voice ${composition.tracks.length + 1}`, voice: 'celestial-chime' }] });
    setActiveTrack(id);
  };

  const play = () => {
    if (playing) { stopTransport(); return; }
    if (invalid.length) return;
    const start = showComplete || playhead >= span ? 0 : playhead;
    // Unlock the AudioContext in the explicit user gesture and reserve a short lead.
    const origin = chimeraAudio.preparePlayback(0.15);
    if (origin === null) return;
    chimeraAudio.stopScheduledNotes();
    transportRef.current = {
      originAudioSeconds: origin,
      fromBeat: start,
      cursor: new CompositionLookaheadCursor(planCompositionTimeline(composition, start)),
    };
    setShowComplete(false);
    setPlayhead(start);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    const session = transportRef.current;
    if (!session) return;

    const scheduleUpcoming = () => {
      const audioNow = chimeraAudio.getAudioClockTime();
      if (audioNow === null) return;
      // A 180ms look-ahead tolerates moderately delayed JS callbacks while
      // native Web Audio controls the actual onset timestamps.
      const upcoming = session.cursor.pull(audioNow - session.originAudioSeconds, 0.18);
      for (const event of upcoming) {
        const voice = composition.tracks.find((t) => t.id === event.note.trackId)?.voice ?? 'music-box';
        chimeraAudio.scheduleStepAt(
          noteAsSynthStep(event.note, composition.bpm),
          session.originAudioSeconds + event.startOffsetSeconds,
          voice,
          'harmonic-sine',
          0,
        );
      }
    };

    scheduleUpcoming();
    const scheduler = window.setInterval(scheduleUpcoming, 30);
    let frame = 0;
    const tick = () => {
      const audioNow = chimeraAudio.getAudioClockTime();
      if (audioNow !== null) {
        const beat = beatAtAudioTime(
          composition.bpm, session.fromBeat, session.originAudioSeconds, audioNow, span,
        );
        setPlayhead(beat);
        if (beat >= span) {
          transportRef.current = null;
          setPlaying(false);
          setShowComplete(true);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      window.clearInterval(scheduler);
      cancelAnimationFrame(frame);
    };
  }, [playing, composition, span]);

  useEffect(() => {
    if (!playing) return;
    const pause = () => { if (document.hidden) stopTransport(); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
    // The playback session is stable while playing. Editing the score calls commit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Prevent scheduled notes from leaking into another route on unmount.
  useEffect(() => () => chimeraAudio.stopScheduledNotes(), []);

  const saveSvg = () => {
    if (!svgRef.current || invalid.length) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '1200');
    clone.setAttribute('height', '1200');
    const data = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${composition.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${grammar}-harmoglyph.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const saveScore = () => {
    const data = new Blob([JSON.stringify(composition, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${composition.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-score.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-[#f4f0ea] text-[#231c2f]">
      <div className="mx-auto max-w-[1900px] px-4 md:px-7 py-5 md:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[.22em] uppercase text-[#826b8e] font-semibold mb-1">Harmoglyph / The song becomes the artwork</div>
            <h1 className="font-serif text-3xl md:text-[42px] leading-tight tracking-tight">Compose a song. <em className="text-[#8956d8]">Watch it become art.</em></h1>
            <p className="mt-1 max-w-3xl text-sm text-[#645b68]">One score drives the sound, every visible mark, and its mathematical explanation. Start with a few notes; build toward the full show.</p>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => {startWithOne();setPerforming(false);}} className="rounded-full px-4 py-2 bg-[#2b2038] text-white text-xs font-semibold">Start with one note</button><button type="button" onClick={showFinishedExample} className="rounded-full px-4 py-2 bg-white border border-[#d8cede] text-[#6c4e8d] text-xs font-semibold">See a finished song + show</button></div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/80 border border-[#dcd4dd] px-3 py-2 text-xs text-[#65566f]">
            <Check size={13} className="text-[#168574]" /> 12-tone equal temperament · {composition.bpm} BPM · {barCount} bars
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[335px_minmax(0,1fr)] 2xl:grid-cols-[335px_minmax(0,1fr)_305px] gap-4 items-stretch">
          {!performing && (
            <section aria-label="Musical score editor" className="rounded-[23px] bg-white border border-[#e1d9e1] shadow-[0_15px_50px_rgba(41,25,48,.06)] p-4 md:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs tracking-[.17em] font-bold uppercase text-[#8956d8]"><Music2 size={15}/> 01 / Your score</div>
              {composition.id === 'first-mark' && <div className="rounded-xl bg-[#f0eaf7] border border-[#dfd0ef] px-3 py-2.5 text-xs text-[#665176]">One note already has a pitch, duration, sound and visible mark. Change C4 below, then add another note to grow the artwork.</div>}
              <div>
                <label htmlFor="composition-preset" className="block text-xs text-[#81778a] mb-1.5">Explore a complete piece or start from one</label>
                <select id="composition-preset" className="w-full rounded-xl border border-[#ded5e1] bg-[#f7f4f8] py-2.5 px-3 text-sm font-semibold" value={COMPOSITION_PRESETS.some((p) => p.id === composition.id) ? composition.id : 'custom'} onChange={(e) => choosePreset(e.target.value)}>
                  {COMPOSITION_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.title}</option>)}
                  {!COMPOSITION_PRESETS.some((p) => p.id === composition.id) && <option value="custom">Custom composition</option>}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div><h2 className="font-serif text-2xl">{composition.title}</h2><p className="text-[11px] text-[#786e7d]">{notes.length} notes · {composition.tracks.length} {composition.tracks.length === 1 ? 'voice' : 'voices'} · each note is editable</p></div>
                <button type="button" className="px-3 py-1.5 bg-[#f3eef8] rounded-full text-xs text-[#865bc2]" onClick={saveScore} title="Download an editable score JSON"><Download size={15}/></button>
              </div>
              <div className="text-[10px] text-[#82738b]">Valid changes save in this browser · export JSON using the download icon.</div>
              <div className="grid grid-cols-[minmax(0,1fr)_95px] gap-2">
                <label className="text-[11px] text-[#807387]">Title<input aria-label="Composition title" className="mt-1 block w-full rounded-lg p-2 bg-[#f8f5fa] border border-[#ded6e2] text-sm" value={composition.title} maxLength={60} onChange={(e) => commit({ ...composition, title: e.target.value })}/></label>
                <label className="text-[11px] text-[#807387]">Tempo / BPM<input aria-label="Composition tempo" className="mt-1 block w-full rounded-lg p-2 bg-[#f8f5fa] border border-[#ded6e2] text-sm" type="number" min="40" max="240" step="1" value={composition.bpm} onChange={(e) => commit({ ...composition, bpm: Number(e.target.value) })}/></label>
              </div>
              <div className="flex gap-1.5 flex-wrap" aria-label="Composition tracks">
                {composition.tracks.map((track, i) => <button type="button" key={track.id} onClick={() => setActiveTrack(track.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${activeTrack === track.id ? 'border-[#8c63d9] bg-[#efe8fa] text-[#7542c5]' : 'border-[#e5dfeb] text-[#736a78] hover:border-[#a288bd]'}`}><span style={{ color: PHRASE_COLORS[i % PHRASE_COLORS.length] }}>●</span> {track.label}</button>)}
                {composition.tracks.length < 3 && <button type="button" onClick={addTrack} className="rounded-full border border-dashed border-[#c7b8d4] px-2.5 py-1.5 text-xs text-[#795c97]" title="Add a second independent musical voice"><Plus size={13}/></button>}
              </div>
              <div className="grid grid-cols-4 gap-1.5 max-h-[260px] overflow-y-auto pr-1" aria-label="Editable note sequence">
                {notes.filter((n) => n.trackId === activeTrack).map((note) => {
                  const active = selected?.id === note.id;
                  const completed = progress >= note.startBeat + note.durationBeats;
                  return <button type="button" key={note.id} onClick={() => audition(note)} aria-pressed={active} aria-label={`Select and hear ${noteName(note.midi)} at beat ${note.startBeat + 1}`} className={`relative min-h-[65px] rounded-xl text-center border transition focus-visible:outline-2 focus-visible:outline-[#7845d0] ${active ? 'bg-[#e9ddfa] border-[#8956d8] shadow-[0_0_0_1px_#8956d8]' : completed ? 'bg-[#f4edf7] border-[#ebe4ef]' : 'bg-[#f6f3f5] border-[#e6dfe7] opacity-65'}`}>
                    <span className="block text-[9px] text-[#988ba0]">beat {format(note.startBeat + 1, 1)}</span><span className="block text-sm font-bold">{noteName(note.midi)}</span><span className="block text-[10px] text-[#83768c]">{note.durationBeats} beat{note.durationBeats === 1 ? '' : 's'}</span>
                    <span className="absolute left-2 right-2 top-0 h-[3px] rounded-full" style={{ background: PHRASE_COLORS[Math.floor(note.startBeat / composition.beatsPerBar) % PHRASE_COLORS.length] }}/>
                  </button>;
                })}
                {notes.filter((n) => n.trackId === activeTrack).length === 0 && <div className="col-span-4 py-5 text-center text-xs text-[#8b8094]">A new voice. Add its first note below.</div>}
              </div>
              <div className="rounded-2xl bg-[#f8f5f9] border border-[#e9e2eb] p-3">
                <div className="text-[11px] uppercase tracking-[.13em] font-bold text-[#78618b] mb-2">Add a musical note</div>
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <label className="text-[11px] text-[#807387]">Pitch<select aria-label="Pitch of new note" className="mt-1 block w-full rounded-lg p-2 bg-white border border-[#ded6e2] text-sm" value={addPitch} onChange={(e) => setAddPitch(Number(e.target.value))}>{MIDI_OPTIONS.map((midi) => <option key={midi} value={midi}>{noteName(midi)}</option>)}</select></label>
                  <label className="text-[11px] text-[#807387]">Beats<select aria-label="Duration of new note" className="mt-1 block w-full rounded-lg p-2 bg-white border border-[#ded6e2] text-sm" value={addDuration} onChange={(e) => setAddDuration(Number(e.target.value))}>{durationOptions.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
                </div>
                <button type="button" onClick={addNote} disabled={Math.max(0, ...notes.filter((n) => n.trackId === activeTrack).map((n) => n.startBeat + n.durationBeats)) + addDuration > MAX_COMPOSITION_BEATS} className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#2b2038] text-white text-sm font-semibold py-2.5 hover:bg-[#4a335e] disabled:opacity-40"><Plus size={15}/> Add note to {composition.tracks.find((t) => t.id === activeTrack)?.label}</button>
              </div>
              {selected && <div className="rounded-2xl border border-[#e1d8e6] px-3 py-3 space-y-2">
                <div className="flex justify-between items-center"><b className="text-xs">Edit selected note</b><button type="button" onClick={() => { commit({ ...composition, notes: composition.notes.filter((note) => note.id !== selected.id) }); setSelectedId(notes.find((n) => n.id !== selected.id)?.id ?? ''); }} className="text-[#a65f7c]" aria-label="Remove selected note"><Trash2 size={15}/></button></div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-[#807387]">Pitch<select aria-label="Selected note pitch" value={selected.midi} onChange={(e) => updateNote(selected.id, { midi: Number(e.target.value) })} className="block mt-1 w-full bg-[#f7f4f9] border rounded-lg border-[#ded6e2] p-2 text-sm">{MIDI_OPTIONS.map((midi) => <option key={midi} value={midi}>{noteName(midi)}</option>)}</select></label>
                  <label className="text-[11px] text-[#807387]">Duration<select aria-label="Selected note duration" value={selected.durationBeats} onChange={(e) => updateNote(selected.id, { durationBeats: Number(e.target.value) })} className="block mt-1 w-full bg-[#f7f4f9] border rounded-lg border-[#ded6e2] p-2 text-sm">{durationOptions.map((d) => <option key={d} value={d}>{d} beats</option>)}</select></label>
                </div>
                <label className="block text-[11px] text-[#807387]">Energy / velocity · {Math.round(selected.velocity * 100)}%<input aria-label="Selected note velocity" type="range" min="0.1" max="1" step="0.05" value={selected.velocity} onChange={(e) => updateNote(selected.id, { velocity: Number(e.target.value) })} className="block w-full accent-[#8956d8] mt-1"/></label>
                <div className="flex gap-2"><button type="button" onClick={() => updateNote(selected.id, { startBeat: Math.max(0, selected.startBeat - .5) })} className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-[11px]" disabled={selected.startBeat <= 0}><ArrowLeft size={12}/> Earlier</button><button type="button" onClick={() => updateNote(selected.id, { startBeat: Math.min(MAX_COMPOSITION_BEATS - selected.durationBeats, selected.startBeat + .5) })} className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-[11px]"><ArrowRight size={12}/> Later</button></div>
              </div>}
              {invalid.length > 0 && <div role="alert" className="text-xs rounded-lg text-[#a34160] bg-[#fff0f3] p-2">{invalid[0]}</div>}
            </section>
          )}

          <section aria-label="Song-generated artwork and performance" className={`relative rounded-[25px] overflow-hidden min-h-[680px] ${grammar === 'filament' ? 'bg-black border-[#1c1a18]' : 'bg-[#120e21]'} text-[#f7f2ff] border border-[#2d2440] shadow-[0_25px_90px_rgba(42,19,73,.17)] flex flex-col ${performing ? 'lg:col-span-2 2xl:col-span-3' : ''}`}>
            <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: grammar === 'filament' ? 'radial-gradient(circle at 50% 52%, rgba(242,196,126,.07) 0%, rgba(0,0,0,0) 55%)' : 'radial-gradient(circle at 50% 49%, #3b245e 0%, #20152f 33%, #130e20 68%, #100d1a 100%)' }}/>
            <div className="relative z-10 px-5 md:px-7 pt-6 flex flex-wrap items-start justify-between gap-3">
              <div><div className="text-[10px] font-semibold tracking-[.24em] uppercase text-[#bda5db]">02 / The visual score</div><h2 className="font-serif text-2xl md:text-3xl mt-1">{composition.title}</h2><p className="text-[11px] text-[#a999bc] mt-1">Every stroke represents an actual note · {grammar.toUpperCase()} interpretation</p></div>
              <div className="flex gap-1 rounded-full p-1 bg-[#281d3b]/80 border border-[#473456]" aria-label="Visual interpretation">
                {(['orbit','bloom','weave','ribbon','current','luminous','filament'] as ArtGrammar[]).map((style) => <button type="button" key={style} aria-pressed={grammar === style} onClick={() => setGrammar(style)} className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${grammar === style ? 'bg-[#d7c7f2] text-[#21162d] font-bold' : 'text-[#bbadcc] hover:text-white'}`}>{style}</button>)}
              </div>
            </div>
            <div className="relative z-10 flex-1 min-h-[480px] flex items-center justify-center px-2">
              <svg ref={svgRef} viewBox="0 0 600 600" role="img" aria-label={`Mathematical ${grammar} artwork for ${composition.title}; click a score note to inspect its contribution`} className="w-full max-w-[640px] max-h-[620px] drop-shadow-[0_0_32px_rgba(185,133,255,.16)]">
                <defs>
                  <radialGradient id="art-aura"><stop offset="0" stopColor="#533a75" stopOpacity=".24"/><stop offset="1" stopColor="#1c102f" stopOpacity="0"/></radialGradient>
                  <filter id="lum-glow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="4.5"/></filter>
                  <filter id="lum-soft" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="1.4"/></filter>
                  <filter id="note-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                {grammar !== 'filament' && <circle cx="300" cy="300" r="275" fill="url(#art-aura)"/>}
                {!isFlowGrammar(grammar) && [140,190,240].map((r) => <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#c8b4e6" strokeOpacity=".075" strokeWidth="1"/>)}
                {!isFlowGrammar(grammar) && Array.from({ length: barCount }, (_, i) => {
                  const a = -Math.PI / 2 + i * (Math.PI * 2 / barCount);
                  const to = point(263,a);
                  return <line key={i} x1="300" y1="300" x2={to.x} y2={to.y} stroke="#d9c9ed" strokeOpacity=".09"/>;
                })}
                {grammar === 'weave' && composition.tracks.map((track, index) => {
                  const trackMarks = marks.filter((mark) => mark.trackId === track.id && (showComplete || composition.notes.find((n) => n.id === mark.noteId)!.startBeat <= progress));
                  if (trackMarks.length < 2) return null;
                  const path = trackMarks.map((m, i) => {
                    const p = point(m.radius, m.startAngle);
                    if (i === 0) return `M ${p.x} ${p.y}`;
                    const prev = trackMarks[i-1], mid = point((prev.radius+m.radius)/2, (prev.startAngle+m.startAngle)/2);
                    return `Q ${mid.x} ${mid.y} ${p.x} ${p.y}`;
                  }).join(' ');
                  return <path key={track.id} d={path} fill="none" stroke={PHRASE_COLORS[index % PHRASE_COLORS.length]} strokeWidth="2.2" strokeOpacity=".32" strokeDasharray="4 7"/>;
                })}
                {motion && <g aria-label={grammar === 'ribbon' ? 'Melodic ribbon' : grammar === 'luminous' ? 'Melodic current luminous' : grammar === 'filament' ? 'Melodic current filament' : 'Melodic current'} transform={(motion.luminous ?? motion.filament)?.view.transform || undefined}>
                  {motion.filament && <g aria-hidden="true" style={{ mixBlendMode: 'screen' }}>
                    {motion.filament.strands.map((st) => <path key={st.key} d={st.d} fill="none" stroke={motion.filament!.voiceHue[st.trackId]} strokeOpacity={st.opacity} strokeWidth={st.width} strokeLinecap="round" strokeDasharray={st.kind === 'rest' ? '0.4 2.2' : undefined}/>)}
                    {motion.filament.cores.map((c) => <path key={c.key} d={c.d} fill="none" stroke={FILAMENT_PALETTE.bone} strokeOpacity=".32" strokeWidth=".5"/>)}
                  </g>}
                  {motion.luminous && (() => {
                    const L = motion.luminous;
                    const trackColor = (id: string) => PHRASE_COLORS[(Math.max(0, composition.tracks.findIndex((t) => t.id === id)) * 2) % PHRASE_COLORS.length];
                    const y0 = -L.view.ty / L.view.scale, h = 600 / L.view.scale;
                    return <g aria-hidden="true">
                      {L.phraseBands.map((b) => <rect key={b.index} x={b.x0} y={y0} width={Math.max(0, b.x1 - b.x0)} height={h} fill="#ffffff" fillOpacity={b.index % 2 ? .0 : .028}/>)}
                      {L.membranes.map((m) => <path key={m.key} d={m.d} fill="#cdb8ff" fillOpacity={.06 + .55 * m.meanPull} stroke="none"><title>{`Coupling: counterline drawn toward the melody, mean λ ${m.meanPull.toFixed(2)}`}</title></path>)}
                      {L.sheets.map((sh) => <path key={sh.key} d={sh.d} fill={trackColor(sh.trackId)} fillOpacity=".13" filter="url(#lum-soft)"/>)}
                      {L.echoes.map((e) => <path key={e.key} d={e.d} fill="none" stroke={trackColor(e.trackId)} strokeOpacity=".28" strokeWidth=".7"/>)}
                      {motion.segments.filter((g) => g.kind === 'note').map((g, i) => <path key={`glow-${i}`} d={g.d} fill={trackColor(g.trackId)} fillOpacity=".55" filter="url(#lum-glow)"/>)}
                    </g>;
                  })()}
                  {motion.annotations.map((a) => <line key={a.key} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#e7dcff" strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="2 5"><title>{a.title}</title></line>)}
                  {motion.threads.map((t) => <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#d9c7ff" strokeOpacity={.08 + .32 * t.strength} strokeWidth=".9" aria-hidden="true"/>)}
                  {motion.segments.map((seg, segIndex) => {
                    if (seg.kind === 'rest') {
                      const before = notes.find((n) => n.id === seg.restAfterNoteId);
                      if (motion.luminous || motion.filament) return null; // these materials draw silence themselves
                      return <path key={`rest-${seg.trackId}-${segIndex}`} d={seg.d} fill="#d8c8ed" fillOpacity=".16" stroke="none" aria-hidden="true"><title>{`Silence after ${before ? noteName(before.midi) : 'the previous note'}: a designed bridge, not a note`}</title></path>;
                    }
                    const noteId = seg.noteId!;
                    const note = notes.find((n) => n.id === noteId)!;
                    const color = PHRASE_COLORS[(Math.floor(note.startBeat / composition.beatsPerBar) + seg.trackIndex) % PHRASE_COLORS.length];
                    const isSelected = selected?.id === noteId;
                    const select = () => { setSelectedId(noteId); setShowMath(true); };
                    // Focus: no rectangular browser outline; a dashed white edge on the path itself (focus-visible only).
                    // Filament: the note shape is an invisible hit target over the strands; selection shows as a bone outline.
                    const fil = !!motion.filament;
                    return <path key={`note-${seg.trackId}-${segIndex}`} d={seg.d} fill={fil ? (isSelected ? FILAMENT_PALETTE.bone : 'transparent') : color} fillOpacity={fil ? (isSelected ? .1 : 1) : selected && showMath && !performing && !isSelected ? .5 : .9} stroke={fil ? (isSelected ? FILAMENT_PALETTE.bone : 'none') : isSelected ? '#fff' : color} strokeOpacity={isSelected ? .9 : .35} strokeWidth={fil ? .6 : isSelected ? 1.4 : .6} strokeLinejoin="round" filter={isSelected ? 'url(#note-glow)' : undefined} className="outline-none focus-visible:[stroke:#ffffff] focus-visible:[stroke-opacity:1] focus-visible:[stroke-width:2.4] focus-visible:[stroke-dasharray:3_2]" role="button" tabIndex={0} aria-label={`Inspect ${noteName(note.midi)}, beat ${format(note.startBeat + 1, 1)}, ${note.trackId} ${grammar}`} onClick={select} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }}/>;
                  })}
                  {motion.luminous && <g aria-hidden="true">
                    {motion.luminous.cores.map((c) => <path key={c.key} d={c.d} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" strokeLinecap="round"/>)}
                    {motion.luminous.restThreads.map((r) => <path key={r.key} d={r.d} fill="none" stroke="#e9ddff" strokeOpacity=".55" strokeWidth="1.1" strokeDasharray="1 4" strokeLinecap="round"><title>Silence: a designed bridge, not a note</title></path>)}
                    {motion.luminous.onsets.map((o) => <circle key={o.noteId} cx={o.x} cy={o.y} r={o.r} fill="#fff" fillOpacity=".85" filter="url(#note-glow)"/>)}
                  </g>}
                  {!showComplete && motion.tracks.map((track) => track.head && <circle key={track.trackId} cx={track.head.x} cy={track.head.y} r={track.head.width * .55 + 2} fill="#fff" fillOpacity=".9" filter="url(#note-glow)"/>)}
                </g>}
                {!isMotionGrammar(grammar) && marks.map((mark) => {
                  const note = notes.find((n) => n.id === mark.noteId)!;
                  const paintedFraction = showComplete ? 1 : clamp((progress - note.startBeat) / note.durationBeats, 0, 1);
                  if (paintedFraction <= 0) return null;
                  const sweep = Math.max(.002, mark.sweepAngle * paintedFraction - .012);
                  const selectedMark = selected?.id === mark.noteId;
                  const color = PHRASE_COLORS[(Math.floor(note.startBeat / composition.beatsPerBar) + Math.max(0, composition.tracks.findIndex((t) => t.id === note.trackId))) % PHRASE_COLORS.length];
                  const d = grammar === 'bloom' ? bloomPath(mark, sweep) : polarArc(mark.radius, mark.startAngle, sweep);
                  const start = point(mark.radius, mark.startAngle);
                  return <g key={mark.noteId} opacity={selected && showMath && !performing && !selectedMark ? .58 : 1}>
                    <path d={d} fill={grammar === 'bloom' ? color : 'none'} fillOpacity={grammar === 'bloom' ? .11 : 0} stroke={color} strokeWidth={selectedMark ? mark.strokeWidth + 2 : mark.strokeWidth} strokeLinecap="round" strokeLinejoin="round" filter={selectedMark ? 'url(#note-glow)' : undefined}/>
                    {grammar !== 'bloom' && <path d={d} fill="none" stroke="#fff" strokeOpacity=".42" strokeWidth="1.3" strokeLinecap="round"/>}
                    <circle cx={start.x} cy={start.y} r={selectedMark ? 5.5 : 2.8} fill="#fff" fillOpacity=".86"/>
                    <path d={d} fill="none" stroke="transparent" strokeWidth="20" role="button" tabIndex={0} aria-label={`Inspect ${noteName(note.midi)}, beat ${format(note.startBeat + 1,1)}`} onClick={() => {setSelectedId(note.id);setShowMath(true);}} onKeyDown={(event) => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();setSelectedId(note.id);setShowMath(true);}}}/>
                  </g>;
                })}
                {!isFlowGrammar(grammar) ? <>
                  <circle cx="300" cy="300" r="44" fill="#20162f" fillOpacity=".64" stroke="#d8c8ed" strokeOpacity=".12"/>
                  <text x="300" y="298" textAnchor="middle" fill="#f1e9ff" fontSize="15" fontFamily="serif" fontStyle="italic">HG</text>
                  <text x="300" y="315" textAnchor="middle" fill="#9788ab" fontSize="8" letterSpacing="2">{countLabel(notes.length)} NOTES</text>
                </> : <text x="300" y="582" textAnchor="middle" fill="#9788ab" fontSize="8" letterSpacing="2">HG · {countLabel(notes.length)} NOTES · TIME FLOWS LEFT TO RIGHT</text>}
              </svg>
              {!showComplete && painted === 0 && !playing && <p className="absolute bottom-6 text-xs text-[#afa0c5]">Press Play to see every note leave its mark.</p>}
            </div>
            <div className="relative z-10 px-5 md:px-7 pb-6 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><div className="text-[10px] tracking-[.2em] text-[#a996bd] font-bold">{countLabel(painted)} / {countLabel(notes.length)} COMPLETE NOTE MARKS</div><div className="font-serif text-xl mt-1">{showComplete ? 'One score. One complete artwork.' : playing ? `Painting bar ${currentPhrase} of ${barCount}…` : 'The song is waiting to unfold.'}</div></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={play} disabled={invalid.length > 0} className="rounded-full bg-[#e5cef8] text-[#261a35] px-4 py-2 flex items-center gap-2 text-xs font-bold hover:bg-white disabled:opacity-50">{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : showComplete ? 'Play from start' : 'Resume'}</button>
                  <button type="button" onClick={() => {stopTransport();setPlayhead(span);setShowComplete(true);}} className="rounded-full border border-[#645171] text-[#e4d7f3] px-3 py-2 text-xs">Complete art</button>
                  <button type="button" onClick={() => {stopTransport();setPlayhead(0);setShowComplete(false);}} className="rounded-full border border-[#645171] text-[#e4d7f3] px-3 py-2 text-xs" aria-label="Clear painting"><RotateCcw size={14}/></button>
                </div>
              </div>
              <label className="block text-[10px] text-[#ab9bbe]">Song position · {format(progress,1)} / {span} beats<input aria-label="Scrub song position" className="w-full block mt-1 accent-[#d5b1f5]" type="range" min="0" max={span} step=".5" value={progress} onChange={(e) => {stopTransport();setShowComplete(false);setPlayhead(Number(e.target.value));}}/></label>
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <div className="flex flex-wrap gap-1.5">{Array.from({length:barCount},(_,i)=><span key={i} className={`rounded-full text-[10px] px-2 py-1 border ${i + 1 === currentPhrase ? 'bg-[#665085] text-white border-[#9175b0]' : 'border-[#433453] text-[#a696ba]'}`}>Phrase {i+1}</span>)}</div>
                <div className="flex gap-3"><button type="button" className="text-xs text-[#c7b4e0] flex items-center gap-1" onClick={() => setPerforming((prev) => !prev)}><Eye size={13}/> {performing ? 'Exit show' : 'Full show'}</button><button type="button" className="text-xs text-[#c7b4e0] flex items-center gap-1" onClick={saveSvg} disabled={invalid.length > 0}><Download size={13}/> Save SVG</button></div>
              </div>
            </div>
          </section>

          {!performing && <aside aria-label="Mathematics and source inspector" className="lg:col-span-2 2xl:col-span-1 rounded-[23px] bg-white border border-[#e1d9e1] shadow-[0_15px_50px_rgba(41,25,48,.06)] p-4 md:p-5">
            <div className="flex justify-between items-center gap-2 mb-3"><div className="flex items-center gap-2 text-xs uppercase tracking-[.15em] font-bold text-[#8956d8]"><WandSparkles size={15}/> 03 / Why this shape?</div><button type="button" aria-expanded={showMath} onClick={() => setShowMath((prev)=>!prev)} className="text-xs text-[#826b8e] underline">{showMath ? 'Hide' : 'Reveal'}</button></div>
            {showMath && selected && selectedMark ? <div className="space-y-4">
              <div className="rounded-2xl bg-[#2a1d3c] p-4 text-white"><div className="text-[10px] text-[#cbb9e4] uppercase tracking-[.2em]">Selected source · {selected.trackId}</div><div className="font-serif text-3xl mt-1">{noteName(selected.midi)}</div><div className="text-[#c7bdd6] text-xs mt-1">Beat {format(selected.startBeat+1,1)} · {selected.durationBeats} beat(s) · {format(selectedMark.hz,2)} Hz</div></div>
              <div><div className="text-[10px] uppercase tracking-[.16em] text-[#8b7e94] font-bold">Music → mathematics</div><div className="mt-2 space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Frequency</span><b>{format(selectedMark.hz)} Hz</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Ratio to {noteName(composition.referenceMidi)}</span><b>{format(selectedMark.ratioToRoot,4)} : 1</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Angle / note onset</span><b>{format((selectedMark.startAngle + Math.PI/2)*180/Math.PI,1)}°</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Arc / note duration</span><b>{format(selectedMark.sweepAngle*180/Math.PI,1)}°</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Radius / pitch + voice</span><b>{format(selectedMark.radius,1)} units</b></div>
                <div className="flex justify-between gap-2"><span>Energy / line width</span><b>{format(selectedMark.strokeWidth,2)} units</b></div>
              </div></div>
              <div className="bg-[#f7f3fa] border border-[#e9e1ee] rounded-xl p-3 text-xs text-[#554a60] space-y-1"><div className="font-bold text-[#6e4aa6]">Traceable formulas</div><div className="font-mono text-[11px] leading-5">f = 440 × 2^((m − 69)/12)<br/>θ = 2π × onset / total<br/>Δθ = 2π × duration / total</div><div>Harmonic partials: {selectedMark.harmonicHz.map((hz) => `${Math.round(hz)}Hz`).join(' · ')}</div></div>
              {selectedMotion && <div><div className="text-[10px] uppercase tracking-[.16em] text-[#8b7e94] font-bold">Music → ribbon motion</div><div className="mt-2 space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Interval from previous note</span><b>{selectedMotion.intervalSemitones === null ? 'first note of this voice' : `${selectedMotion.intervalSemitones > 0 ? '+' : ''}${selectedMotion.intervalSemitones} semitones`}</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Ribbon moves by</span><b>{format(selectedMotion.radiusChange,1)} units</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Spring overshoot</span><b>{format(selectedMotion.peakOvershoot,1)} units</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Peak thickness / velocity</span><b>{format(selectedMotion.peakWidth,2)} units</b></div>
                {alsoSounding.length > 0 && <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Also sounding on this voice</span><b>{alsoSounding.join(', ')}</b></div>}
                <div className="flex justify-between gap-2"><span>Starts together with</span><b>{selectedMotion.counterpointNoteIds.length ? selectedMotion.counterpointNoteIds.join(', ') : '—'}</b></div>
              </div>
              <div className="mt-2 bg-[#f7f3fa] border border-[#e9e1ee] rounded-xl p-3 text-[11px] text-[#554a60] space-y-1"><div className="font-bold text-[#6e4aa6]">How the ribbon is computed</div><div className="font-mono leading-5">r(b) = r₀ + Σ Δrᵢ · s(b − onsetᵢ)<br/>s = damped spring step (ω, ζ)</div><div><b>Derived:</b> {RIBBON_MAPPINGS.derived.join('; ')}.</div><div><b>Designed:</b> {RIBBON_MAPPINGS.designed.join('; ')}.</div></div></div>}
              {selectedCurrent && <div><div className="text-[10px] uppercase tracking-[.16em] text-[#8b7e94] font-bold">Music → current motion</div><div className="mt-2 space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Pitch vs phrase start</span><b>{selectedCurrent.semitonesFromPhraseStart > 0 ? '+' : ''}{selectedCurrent.semitonesFromPhraseStart} semitones</b></div>
                <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Steers toward</span><b>{format(Math.abs(selectedCurrent.targetHeadingDeg),1)}° {selectedCurrent.targetHeadingDeg > 0.05 ? 'up' : selectedCurrent.targetHeadingDeg < -0.05 ? 'down' : '(level)'}</b></div>
                {alsoSounding.length > 0 && <div className="flex justify-between gap-2 border-b border-[#eee8ef] pb-2"><span>Also sounding on this voice</span><b>{alsoSounding.join(', ')} (newest note steers)</b></div>}
                <div className="flex justify-between gap-2"><span>Coupling while sounding</span><b>{selectedCurrent.couplings.length ? '' : 'none'}</b></div>
                {selectedCurrent.couplings.map((c) => <div key={c.noteIds.join('-')} className="flex justify-between gap-2 text-[11px] text-[#5f5468]"><span>{c.noteIds[0] === selected!.id ? c.noteIds[1] : c.noteIds[0]} · {Math.abs(c.intervalSemitones)} semitones (class {c.intervalClass})</span><b>consonance {format(c.consonance)} · pull ≤ {format(c.maxPull * 100, 0)}%</b></div>)}
              </div>
              <div className="mt-2 bg-[#f7f3fa] border border-[#e9e1ee] rounded-xl p-3 text-[11px] text-[#554a60] space-y-1"><div className="font-bold text-[#6e4aa6]">How the current is computed</div><div className="font-mono leading-5">heading = −H·tanh(κ·(pitch − phrase start)/H)<br/>counterline += λ·(melody − counterline), λ ≤ {DEFAULT_CURRENT_CONFIG.couplingMax}</div><div><b>Derived:</b> {CURRENT_MAPPINGS.derived.join('; ')}.</div><div><b>Designed:</b> {CURRENT_MAPPINGS.designed.join('; ')}.</div>{grammar === 'filament' && <div className="pt-1 border-t border-[#e9e1ee]"><b>Filament material (appearance only, same motion):</b> derived — {FILAMENT_MAPPINGS.derived.join('; ')}; designed — {FILAMENT_MAPPINGS.designed.join('; ')}.</div>}{grammar === 'luminous' && <div className="pt-1 border-t border-[#e9e1ee]"><b>Luminous material (appearance only, same motion):</b> derived — {LUMINOUS_MAPPINGS.derived.join('; ')}; designed — {LUMINOUS_MAPPINGS.designed.join('; ')}.</div>}</div></div>}
              <div className="rounded-xl border-l-[3px] border-[#8f63d4] bg-[#faf7fd] px-3 py-3 text-[11px] text-[#74687d] leading-relaxed"><b className="text-[#4b3a60]">Derived:</b> pitch, timing, frequency ratios, angular span and modeled partials. <b className="text-[#4b3a60]">Designed:</b> radius scale, palette, glow, note thickness and Orbit/Bloom/Weave/Ribbon/Current grammar and the Luminous material. None is claimed to be the unique picture of a song.</div>
            </div> : <p className="text-sm text-[#807187]">Select a note in the score or artwork and reveal the mapping that produced its mark.</p>}
            <div className="mt-5 pt-4 border-t border-[#eee7ef] space-y-2">
              <div className="text-[10px] uppercase font-bold tracking-[.14em] text-[#85778f]">04 / Bridge to the original app</div>
              <button type="button" onClick={() => onOpenInstrument(composition, projectToSpreadsheet(composition))} disabled={!canOpen3d} className="w-full bg-[#2b2038] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 flex gap-2 justify-center items-center"><Sparkles size={14}/> Open in 3D instrument</button>
              <p className="text-[11px] text-[#81738a] leading-relaxed">{canOpen3d ? 'Projects note onsets into the real A1:F48 formula engine. The 3D instrument uses native step timing and an approximate decay envelope.' : 'The A1:F48 spreadsheet has one audio voice. Polyphonic or differently voiced parts stay intact here; transfer is disabled to avoid silently dropping them.'}</p>
            </div>
          </aside>}
        </div>
        <p className="text-center mt-4 mb-2 text-xs text-[#8a7e91]">A working composition slice using the existing Web Audio synth and spreadsheet engine. Generated visual forms are mathematically traceable interpretations—not physical cymatics measurements.</p>
      </div>
    </main>
  );
}
