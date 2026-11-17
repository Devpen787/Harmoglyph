# Technical Design — Harmoglyph

## Architecture Overview
Harmoglyph executes a deterministic, bidirectional dataflow pipeline connecting mathematical foundations, tabular formulas, FM audio synthesis, and parametric vector geometry:

```text
Mathematical Foundations (src/engine/mathArtTheory.ts)
  [Harmonic Sine 2πn | Fibonacci F_n/F_{n-1} | Golden Ratio φ | Pythagorean 3:2]
       │
       ▼
SheetRawGrid (A1:F48)  ◄──── Inverse Compiler: geometryToFormulaGrid()
       │
       ▼  evaluateSheet() [src/engine/spreadsheetVm.ts]
SheetEvaluationResult { cells, steps[1..48], errorCount, cycleCoords }
       ├──▶ StudioView Grid (formula blue vs literal white vs #CYCLE! crimson)
       ├──▶ chimeraAudio.triggerStep() & renderStepsToWavBlob() [src/engine/audioSynth.ts]
       └──▶ computeVectorCurve() & exportStandaloneSvg/Png() [src/engine/vectorPlotter.ts]
```

## Module Breakdown
1. **Spreadsheet VM (`src/engine/spreadsheetVm.ts`)**:
   - Tokenizer + recursive-descent parser (`ExprParser`) supporting operator precedence (`comparison < add/sub < mul/div < power < unary < primary`).
   - Memoized `resolveCell` with `visiting: Set<string>` guaranteeing $O(V + E)$ evaluation and deterministic `#CYCLE!` termination.
   - Acoustic clamps (`clampFreq`, `clampGate`, `clampFmIndex`, `clampDecayMs`, `clampModRatio`) applied at row-step emission.
   - Lossless RFC-4180 CSV serializer/parser (`serializeSheetToCsv`, `parseCsvToSheet`).
2. **Mathematical Foundations Engine (`src/engine/mathArtTheory.ts`)**:
   - Maps `harmonic-sine`, `fibonacci`, `golden-ratio`, and `pythagorean` foundations to per-step FM and geometric modifiers (`computeFoundationStepModifiers`) and generates complete `A1:F8` formula sheets (`generateFoundationFormulaGrid`).
3. **Web Audio FM Synth & WAV Binary Encoder (`src/engine/audioSynth.ts`)**:
   - Real-time 2-operator FM voice across 4 timbres (`music-box`, `celestial-chime`, `haunted-organ`, `analog-pluck`) with foundation-coupled modulator ratios and biquad filter cutoffs.
   - Pure-TypeScript `renderSheetToWavBytes` rendering offline 22.05 kHz 16-bit mono PCM into an exact 44-byte `RIFF` / `WAVE` / `fmt ` / `data` binary buffer.
4. **Vector Plotter & Inverse Compiler (`src/engine/vectorPlotter.ts`)**:
   - Projects step frequency ratios `f / A1` (`analyzeHarmonicSymmetry`) and mathematical foundation modifiers into `440×280` Harmonograph, Chladni Mandala, FM Ribbon, and Euler Pitch Spiral curves (`computeVectorCurve`), plus `geometryToFormulaGrid` and `.svg`/`.png` exports.
5. **Property-Based Verification (`src/engine/pbtSuite.ts`)**:
   - Seeded Mulberry32 PRNG running 100 trials per invariant (`500` total trials across `cycle-termination`, `acoustic-clamp`, `csv-roundtrip`, `wav-header`, and `math-foundation-symmetry`).
6. **Express Backend & Kiro Free-Tier Workspace Hub (`server.ts`)**:
   - `GET /api/health`, `GET /.kiro/specs.json`, `GET /api/kiroween/specs`, `GET /api/kiroween/audit`
   - `GET /api/kiroween/free-tier-workspace` & `POST /api/kiroween/run-hook` (live `.kiro/` inspector and hook runner)
   - `POST /api/kiroween/git-setup`, `POST /api/kiroween/verify-public`, `POST /api/kiroween/generate-kiro`
   - `POST /api/sheet/transcribe`, `POST /api/formula/compose`, `POST /api/submission/pack`
