import { SheetPreset, SheetRawGrid } from '../types/chimera';

interface MelodyStepSpec {
  semi: number | null; // semitone offset from A1 (null = rest)
  gate: number;
  decayMs: number;
  fm?: number;
  ratio?: number;
}

function buildFormulaSong(steps: MelodyStepSpec[], rootHz: number, mode: 'festive' | 'classical'): SheetRawGrid {
  const grid: SheetRawGrid = {};
  let lastValidFormula = String(rootHz);

  steps.forEach((s, idx) => {
    const row = idx + 1;
    if (row === 1) {
      grid[`A1`] = String(rootHz);
      lastValidFormula = '=A1';
    } else if (s.semi === null) {
      grid[`A${row}`] = `=A${Math.max(1, row - 1)}`;
    } else if (s.semi === 0) {
      grid[`A${row}`] = '=A1';
      lastValidFormula = '=A1';
    } else {
      const f = `=A1*POW(2,${s.semi}/12)`;
      grid[`A${row}`] = f;
      lastValidFormula = f;
    }

    grid[`B${row}`] = s.gate === 0 ? '0' : String(s.gate);
    grid[`C${row}`] =
      s.fm !== undefined
        ? String(s.fm)
        : mode === 'festive'
          ? `=1.4+ABS(SIN(ROW()*0.45))*2.2`
          : `=1.2+ABS(COS(ROW()*0.4))*1.8`;
    grid[`D${row}`] = `=50+SIN(ROW()*0.52)*38`;
    grid[`E${row}`] = String(s.decayMs);
    grid[`F${row}`] =
      s.ratio !== undefined
        ? String(s.ratio)
        : mode === 'festive'
          ? `=IF(MOD(ROW(),4)=1,2,3)`
          : `=IF(MOD(ROW(),3)=1,2,1.5)`;
    void lastValidFormula;
  });

  return grid;
}

// Happy Birthday to You in C Major (42-step eighth/quarter rhythm grid, transposable via A1!)
const HAPPY_BIRTHDAY_STEPS: MelodyStepSpec[] = [
  // Phrase 1: C4 C4 D4 - C4 - F4 - E4 - -
  { semi: 0, gate: 0.85, decayMs: 210, fm: 2.1 },
  { semi: 0, gate: 0.9, decayMs: 210, fm: 2.3 },
  { semi: 2, gate: 1.0, decayMs: 420, fm: 2.6 },
  { semi: 2, gate: 0, decayMs: 200 },
  { semi: 0, gate: 0.92, decayMs: 420, fm: 2.2 },
  { semi: 0, gate: 0, decayMs: 200 },
  { semi: 5, gate: 1.0, decayMs: 440, fm: 2.9 },
  { semi: 5, gate: 0, decayMs: 200 },
  { semi: 4, gate: 1.0, decayMs: 740, fm: 3.1, ratio: 3 },
  { semi: 4, gate: 0, decayMs: 200 },
  { semi: 4, gate: 0, decayMs: 200 },

  // Phrase 2: C4 C4 D4 - C4 - G4 - F4 - -
  { semi: 0, gate: 0.85, decayMs: 210, fm: 2.1 },
  { semi: 0, gate: 0.9, decayMs: 210, fm: 2.3 },
  { semi: 2, gate: 1.0, decayMs: 420, fm: 2.6 },
  { semi: 2, gate: 0, decayMs: 200 },
  { semi: 0, gate: 0.92, decayMs: 420, fm: 2.2 },
  { semi: 0, gate: 0, decayMs: 200 },
  { semi: 7, gate: 1.0, decayMs: 440, fm: 3.2, ratio: 3 },
  { semi: 7, gate: 0, decayMs: 200 },
  { semi: 5, gate: 1.0, decayMs: 740, fm: 2.8, ratio: 2 },
  { semi: 5, gate: 0, decayMs: 200 },
  { semi: 5, gate: 0, decayMs: 200 },

  // Phrase 3: C4 C4 C5 - A4 - F4 - E4 - D4 -
  { semi: 0, gate: 0.88, decayMs: 210, fm: 2.4 },
  { semi: 0, gate: 0.92, decayMs: 210, fm: 2.5 },
  { semi: 12, gate: 1.0, decayMs: 460, fm: 3.6, ratio: 3 },
  { semi: 12, gate: 0, decayMs: 200 },
  { semi: 9, gate: 0.96, decayMs: 420, fm: 2.9 },
  { semi: 9, gate: 0, decayMs: 200 },
  { semi: 5, gate: 0.94, decayMs: 420, fm: 2.5 },
  { semi: 5, gate: 0, decayMs: 200 },
  { semi: 4, gate: 0.94, decayMs: 420, fm: 2.4 },
  { semi: 4, gate: 0, decayMs: 200 },
  { semi: 2, gate: 0.98, decayMs: 680, fm: 2.8 },
  { semi: 2, gate: 0, decayMs: 200 },

  // Phrase 4: Bb4 Bb4 A4 - F4 - G4 - F4 -
  { semi: 10, gate: 0.9, decayMs: 220, fm: 2.7 },
  { semi: 10, gate: 0.92, decayMs: 220, fm: 2.8 },
  { semi: 9, gate: 1.0, decayMs: 420, fm: 3.0 },
  { semi: 9, gate: 0, decayMs: 200 },
  { semi: 5, gate: 0.95, decayMs: 400, fm: 2.6 },
  { semi: 5, gate: 0, decayMs: 200 },
  { semi: 7, gate: 0.98, decayMs: 420, fm: 3.1 },
  { semi: 7, gate: 0, decayMs: 200 },
  { semi: 5, gate: 1.0, decayMs: 850, fm: 3.4, ratio: 2 },
  { semi: 5, gate: 0, decayMs: 200 },
];

// Beethoven's Fur Elise motif from E5 (A1=659.25 Hz)
const FUR_ELISE_STEPS: MelodyStepSpec[] = [
  { semi: 0, gate: 0.92, decayMs: 260 }, // E5
  { semi: -1, gate: 0.88, decayMs: 260 }, // D#5
  { semi: 0, gate: 0.92, decayMs: 260 }, // E5
  { semi: -1, gate: 0.88, decayMs: 260 }, // D#5
  { semi: 0, gate: 0.94, decayMs: 260 }, // E5
  { semi: -5, gate: 0.88, decayMs: 280 }, // B4
  { semi: -2, gate: 0.9, decayMs: 280 }, // D5
  { semi: -4, gate: 0.88, decayMs: 280 }, // C5
  { semi: -7, gate: 1.0, decayMs: 560 }, // A4
  { semi: null, gate: 0, decayMs: 200 },
  { semi: -16, gate: 0.85, decayMs: 300 }, // C4
  { semi: -12, gate: 0.88, decayMs: 300 }, // E4
  { semi: -7, gate: 0.92, decayMs: 320 }, // A4
  { semi: -5, gate: 1.0, decayMs: 540 }, // B4
  { semi: null, gate: 0, decayMs: 200 },
  { semi: -12, gate: 0.85, decayMs: 300 }, // E4
  { semi: -8, gate: 0.9, decayMs: 300 }, // G#4
  { semi: -5, gate: 0.92, decayMs: 320 }, // B4
  { semi: -4, gate: 1.0, decayMs: 560 }, // C5
  { semi: null, gate: 0, decayMs: 200 },
  { semi: -12, gate: 0.85, decayMs: 280 }, // E4
  { semi: 0, gate: 0.94, decayMs: 280 }, // E5
  { semi: -1, gate: 0.9, decayMs: 280 }, // D#5
  { semi: 0, gate: 0.98, decayMs: 520 }, // E5
];

// Beethoven's Ode to Joy from E4 (A1=329.63 Hz, C4=261.63 root offsets)
const ODE_TO_JOY_STEPS: MelodyStepSpec[] = [
  { semi: 0, gate: 0.95, decayMs: 300 }, // E4
  { semi: 0, gate: 0.9, decayMs: 300 },  // E4
  { semi: 1, gate: 0.95, decayMs: 300 }, // F4
  { semi: 3, gate: 1.0, decayMs: 340 },  // G4
  { semi: 3, gate: 0.95, decayMs: 300 }, // G4
  { semi: 1, gate: 0.9, decayMs: 300 },  // F4
  { semi: 0, gate: 0.92, decayMs: 300 }, // E4
  { semi: -2, gate: 0.9, decayMs: 320 }, // D4
  { semi: -4, gate: 0.95, decayMs: 320 }, // C4
  { semi: -4, gate: 0.9, decayMs: 300 }, // C4
  { semi: -2, gate: 0.92, decayMs: 300 }, // D4
  { semi: 0, gate: 0.96, decayMs: 340 }, // E4
  { semi: 0, gate: 1.0, decayMs: 460 },  // E4.
  { semi: -2, gate: 0.88, decayMs: 240 }, // D4
  { semi: -2, gate: 0.98, decayMs: 680 }, // D4(half)
  { semi: null, gate: 0, decayMs: 200 },
];

export const SHEET_PRESETS: SheetPreset[] = [
  {
    id: 'happy-birthday',
    title: 'Happy Birthday',
    subtitle: 'Full 44-step formula melody from A1 root (edit A1 to transpose key live).',
    bpm: 136,
    rowCount: HAPPY_BIRTHDAY_STEPS.length,
    voice: 'music-box',
    artMode: 'mandala',
    artworkKey: 'birthday',
    cells: buildFormulaSong(HAPPY_BIRTHDAY_STEPS, 261.63, 'festive'),
  },
  {
    id: 'fur-elise',
    title: 'Für Elise',
    subtitle: 'Beethoven A-minor motif derived from equal-temperament POW(2, n/12) math.',
    bpm: 138,
    rowCount: FUR_ELISE_STEPS.length,
    voice: 'celestial-chime',
    artMode: 'harmonograph',
    artworkKey: 'classical',
    cells: buildFormulaSong(FUR_ELISE_STEPS, 659.25, 'classical'),
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    subtitle: '16-step Beethoven 9th melody paired with radial Mandala symmetry.',
    bpm: 112,
    rowCount: ODE_TO_JOY_STEPS.length,
    voice: 'analog-pluck',
    artMode: 'mandala',
    artworkKey: 'classical',
    cells: buildFormulaSong(ODE_TO_JOY_STEPS, 329.63, 'festive'),
  },
  {
    id: 'spooky-minor',
    title: 'Spooky Haunted Waltz',
    subtitle: '8-step minor-third Halloween organ arpeggio with glowing FM bell harmonics.',
    bpm: 120,
    rowCount: 8,
    voice: 'haunted-organ',
    artMode: 'harmonograph',
    artworkKey: 'spooky',
    cells: {
      A1: '220',
      A2: '=A1*POW(2,3/12)',
      A3: '=A2*POW(2,4/12)',
      A4: '=A1*2',
      A5: '=A4*POW(2,3/12)',
      A6: '=A3*2',
      A7: '=A2*2',
      A8: '=A1',
      B1: '1',
      B2: '0.85',
      B3: '1',
      B4: '0.7',
      B5: '1',
      B6: '0.88',
      B7: '0.65',
      B8: '0.95',
      C1: '1.8',
      C2: '=C1+0.6',
      C3: '=C2+0.6',
      C4: '4.2',
      C5: '=C4-0.8',
      C6: '=C5-0.8',
      C7: '2.0',
      C8: '1.2',
      D1: '35',
      D2: '=D1+12',
      D3: '=D2+14',
      D4: '85',
      D5: '=D4-10',
      D6: '=D5-12',
      D7: '48',
      D8: '30',
      E1: '320',
      E2: '240',
      E3: '290',
      E4: '420',
      E5: '260',
      E6: '240',
      E7: '320',
      E8: '480',
      F1: '2',
      F2: '2',
      F3: '3',
      F4: '1.5',
      F5: '2',
      F6: '3',
      F7: '2',
      F8: '1',
    },
  },
  {
    id: 'fibonacci-pulse',
    title: 'Fibonacci Polyrhythm',
    subtitle: 'Recursive Fibonacci pitch modulo wrapped into an 8-step electronic groove.',
    bpm: 132,
    rowCount: 8,
    voice: 'analog-pluck',
    artMode: 'ribbon',
    artworkKey: 'spooky',
    cells: {
      A1: '130.8',
      A2: '196.0',
      A3: '=110+MOD(A1+A2,330)',
      A4: '=110+MOD(A2+A3,440)',
      A5: '=110+MOD(A3+A4,550)',
      A6: '=110+MOD(A4+A5,660)',
      A7: '=AVG(A1:A4)',
      A8: '=MIN(A1:A6)',
      B1: '1',
      B2: '=IF(MOD(ROW(),2)=0,0.75,1)',
      B3: '=IF(MOD(ROW(),2)=0,0.75,1)',
      B4: '0',
      B5: '1',
      B6: '0.9',
      B7: '0.7',
      B8: '1',
      C1: '2.4',
      C2: '1.5',
      C3: '=C1*1.4',
      C4: '0.8',
      C5: '3.8',
      C6: '2.2',
      C7: '1.6',
      C8: '3.0',
      D1: '45',
      D2: '60',
      D3: '75',
      D4: '30',
      D5: '92',
      D6: '68',
      D7: '52',
      D8: '40',
      E1: '220',
      E2: '180',
      E3: '240',
      E4: '140',
      E5: '310',
      E6: '200',
      E7: '260',
      E8: '380',
      F1: '1.5',
      F2: '2',
      F3: '2.5',
      F4: '2',
      F5: '3',
      F6: '1.5',
      F7: '2',
      F8: '2',
    },
  },
  {
    id: 'harmonic-spiral',
    title: 'Harmonic Math Spiral',
    subtitle: '16-step trigonometric SIN/COS formulas shaping sweeping chimes & spiral curves.',
    bpm: 108,
    rowCount: 16,
    voice: 'celestial-chime',
    artMode: 'pitch-spiral',
    artworkKey: 'spiral',
    cells: Object.fromEntries(
      Array.from({ length: 16 }, (_, idx) => {
        const r = idx + 1;
        return [
          [`A${r}`, '=330+SIN(ROW()*0.42)*150'],
          [`B${r}`, r % 4 === 0 ? '0.65' : '0.92'],
          [`C${r}`, '=ABS(COS(ROW()*0.38))*4.2'],
          [`D${r}`, '=52+COS(ROW()*0.48)*40'],
          [`E${r}`, r % 4 === 0 ? '480' : '320'],
          [`F${r}`, r % 3 === 0 ? '3' : '2'],
        ];
      }).flat(),
    ),
  },
];
