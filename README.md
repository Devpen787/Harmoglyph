# Harmoglyph

**Kiroween 2026 Hackathon — Frankenstein Category**  
*A deterministic mathematical instrument stitching together an Excel-style Formula Spreadsheet VM (`A1:F48`), a 2-Operator Web Audio FM Synthesizer with offline 16-bit PCM `.wav` rendering, a bidirectional Parametric SVG/PNG Vector Plotter, and a live 3D Three.js Harmonic Sculpture Stage.*

[![License: MIT](https://img.shields.io/badge/License-MIT-00E5CC.svg)](./LICENSE.md)

---

## 1. The Frankenstein Vision

Spreadsheets, FM digital audio synthesizers, generative vector plotters, and real-time 3D WebGL geometry engines usually live in completely separate domains. **Harmoglyph** stitches them into one unified, bidirectional creative instrument where **algebraic formulas, musical frequencies, and 2D/3D shapes are projections of the same mathematical state**:

1. **Formula Spreadsheet VM (`A1:F48`)**: Every row (`1..48`) is an eighth-note step, and columns `A`–`F` evaluate recursive-descent Excel-style formulas (`=A1*POW(2,MOD(FIB(ROW()),12)/12)`, `SIN`, `COS`, `PHI`, `GOLDEN_ANGLE`, `PERTURB`) with explicit cycle detection (`#CYCLE!`).
2. **2-Operator Web Audio FM Synthesizer & Offline `.wav` Exporter**: Each evaluated row triggers a polyphonic Web Audio API 2-operator FM voice in real time and compiles offline into a 22.05 kHz 16-bit mono `RIFF/WAVE` `.wav` file.
3. **3D Three.js Harmonic Sculpture & Bloom Stage**: The live waveform, pitch ratios, and mathematical foundation sculpt a real-time interactive 3D manifold (`3D Torus Knot`, `Cymatic Mandala`, `Helix Ribbon`, `Golden Vortex`) with `UnrealBloomPass` post-processing and orbit controls.
4. **Bidirectional Parametric SVG/PNG Vector Plotter**: Renders closed Lissajous harmonographs, Chladni mandalas, FM wave ribbons, and Euler pitch spirals—or reverse-compiles drawn lines and regular polygons (`Art → Formula → Music`) straight back into live `=` formulas.

---

## 2. Guided Learning Tiers: Discovery → Explorer → Algebra Lab

Harmoglyph scales smoothly from effortless visual/musical play into deep mathematical composition:

- **1. Discovery (3D Harmonic Stage + Live Physics Bridge)**:
  - Manipulate **Root Pitch (`Cell A1`)**, **Organic Imperfection ($\delta \in [0\%, 100\%]$)**, **3D Form**, **Voice**, and **Mathematical Tuning** with instant `<1ms` feedback.
  - Inspect live `p:q` interval ratios, **Symmetry %**, the **`ComplexityEngine` Harmony Score (`formulaCount : visualVertexCount`)**, and the 5-step **Progressive Mastery Quests** tracker.
- **2. Explorer (Harmonic Codex & Interactive Formula Catalog)**:
  - **Harmonic Codex (`src/components/HarmonicCodexPanel.tsx`)**: Mix and match **Pitch Laws**, **Modulation/Rhythm Laws**, and **3D/2D Shape Forms** with live compatibility diagnostics (*Harmonic Lock*, *Living Spiral*, *Creative Tension*) and 1-click starter experiments.
  - **Formula Catalog (`src/components/MathFormulaCatalog.tsx`)**: Compare formulas across all four math foundations alongside live SVG vector previews and musical frequency/FM profiles—and **click to inject** directly into individual `A1:F48` cells, active columns, or custom ranges.
- **3. Algebra Lab (Formula Console & Graft Editor)**:
  - **Syntax-Highlighted Formula Autocomplete (`FormulaCellInput.tsx`)** with inline hints for `FIB`, `PHI`, `INV_PHI`, `GOLDEN_ANGLE`, `PERTURB`, `SIN`, `COS`, `POW`, `MOD`, `IF`, `ROW`, and `COL`.
  - **Live Formula Anatomy & 1-Click Column Math Generators** (`Wand2` column menus).
  - **`ComplexityEngine` Real-Time Symmetry Advisor** scoring generative efficiency (`formulaCount / visualVertexCount`) with 1-click symmetry fixes.
  - **Interactive Line-to-Formula Canvas (`Draw Line -> Music`)** and **Side-by-Side Spreadsheet Graft Editor (`GraftEditorView.tsx`)**.

---

## 3. System Architecture & Pipeline

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                Mathematical Foundations & ComplexityEngine                   │
│   src/engine/mathArtTheory.ts · src/engine/harmonicCodex.ts                  │
│   • Harmonic Sine (2πn)       • Fibonacci Sequence (Fₙ / 137.5° Phyllotaxis) │
│   • Golden Ratio (φ ≈ 1.618)  • Pythagorean Tuning (3:2 / 4:3 Just Ratios)   │
│   • Organic Imperfection (δ)  • ComplexityEngine Harmony Score & Advisor     │
└───────────────┬──────────────────────────────┬───────────────────────────────┘
                │                              │
                ▼                              ▼
┌────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ Stage 1: Formula Spreadsheet VM    │◄──┤ Inverse Geometry & Score Compilers  │
│ src/engine/spreadsheetVm.ts        │   │ geometryToFormulaGrid() / server.ts │
│ • Grid A1:F48 (8 to 48 steps)      │   │ Compiles drawn lines, polygons &    │
│ • Recursive-descent AST parser     │   │ .abc/.xml/.pdf/.png scores into =   │
│ • #CYCLE! & #DIV/0! isolation      │   │ spreadsheet formulas                │
│ • Lossless RFC CSV round-trip      │   └─────────────────────────────────────┘
└───────────────┬────────────────────┘
                │ EvaluatedRowStep[] (strictly clamped)
        ┌───────┴──────────────────────────────┬───────────────────────────────┐
        ▼                                      ▼                               ▼
┌──────────────────────────────┐  ┌─────────────────────────────┐  ┌─────────────────────────────┐
│ Stage 2: 2-Op FM Synth       │  │ Stage 3: Vector Plotter     │  │ Stage 4: 3D Three.js Stage  │
│ src/engine/audioSynth.ts     │  │ src/engine/vectorPlotter.ts │  │ HarmonicThreeStage.tsx      │
│ • 4 FM voices                │  │ • Harmonograph, Mandala,    │  │ • Audio-reactive manifold   │
│ • 20–4000 Hz, gain <= 0.35   │  │   Ribbon & Pitch Spiral     │  │ • UnrealBloomPass glow      │
│ • 22.05 kHz 16-bit .wav      │  │ • Standalone .svg & .png    │  │ • FIB/φ dynamic vertices    │
└──────────────────────────────┘  └─────────────────────────────┘  └─────────────────────────────┘
```

### Spreadsheet Column Bindings (`A1:F48`)

| Column | Parameter | Unit | Acoustic & Geometric Role | Safety Clamp |
| :--- | :--- | :--- | :--- | :--- |
| **`A`** | `freqHz` | `Hz` | Carrier pitch frequency (`A1` serves as root transpose anchor) | `[20, 4000]` |
| **`B`** | `gate` | `0..1` | Step trigger / velocity (`<= 0.02` acts as silent rest) | `[0, 1]` |
| **`C`** | `fmIndex` | `idx` | FM modulation depth & high-frequency petal/filament ripple | `[0, 12]` |
| **`D`** | `orbitX` | `px` | Vector orbital radius / spatial excursion phase | `[10, 100]` |
| **`E`** | `decayMs` | `ms` | Exponential envelope release & dynamic stroke weight | `[40, 900]` |
| **`F`** | `modRatio` | `ratio` | FM modulator/carrier ratio (`f_m / f_c`) & angular symmetry | `[0.25, 8]` |

---

## 4. Spec-Driven Development with `/.kiro/`

Harmoglyph is built with Kiro's **spec-driven development** workflow, and the entire `/.kiro/` directory is preserved and tracked in git (verified by `.gitignore` and `/api/kiroween/audit`):

```text
.kiro/
├── agent.yaml                              # Master workflow phases, steering, crew & hooks
├── specs.json                              # Machine-readable pipeline & 500-trial PBT manifest
├── specs/
│   └── harmoglyph/
│       ├── requirements.md                 # EARS-formatted functional & safety requirements
│       ├── design.md                       # Unidirectional & inverse DSP/geometry architecture
│       └── tasks.md                        # Implementation waves with requirement traceability
├── steering/
│   ├── product.md                          # Always-included product identity & UX goals
│   ├── tech-stack.md                       # React 19, Vite, Express, Three.js, D3 & TS conventions
│   ├── structure.md                        # Repository layout & module boundaries
│   ├── audio-safety-contract.md            # File-match safety contract for src/engine/**/*.ts
│   ├── math-harmony-contract.md            # File-match contract for math/vector/synth coupling
│   └── kiroween-submission-guide.md        # Manual (#kiroween-submission-guide) submission guide
├── hooks/
│   ├── pbt-on-formula-save.json            # Triggers 500-trial PBT invariants on engine saves
│   ├── math-symmetry-verify.json           # Verifies symmetry & math coupling invariants
│   └── kiroween-submission-audit.json      # Audits LICENSE, README, .gitignore & /.kiro staging
├── agents/
│   └── synth-crew.json                     # 5-agent crew (VM, DSP, Plotter, Verifier, Choreo)
├── powers/
│   ├── spreadsheet-dsp-power.md            # Reusable formula-to-PCM synthesis Kiro Power
│   └── math-cymatics-power.md              # Mathematical foundation & cymatics Kiro Power
└── settings/
    └── mcp.json                            # 4 local Model Context Protocol server bindings
```

### Property-Based Verification (`src/engine/pbtSuite.ts`)
Using a deterministic Mulberry32 PRNG (`seed = 20261116`), the **Verifier / PBT** view and `/api/kiroween/run-hook` execute **500 randomized trials (100 per invariant)**:
1. `cycle-termination` (100/100): Hostile circular formula graphs always terminate cleanly with `#CYCLE!`.
2. `acoustic-clamp` (100/100): Extreme values (`NaN`, `1/0`, `±1e9`) clamp strictly inside safe Web Audio ranges.
3. `csv-roundtrip` (100/100): `parseCsvToSheet(serializeSheetToCsv(grid))` preserves every formula and literal losslessly.
4. `wav-header` (100/100): Offline PCM `.wav` output matches valid 44-byte `RIFF/WAVE/fmt /data` structure and exact byte length.
5. `math-foundation-symmetry` (100/100): Rational/irrational foundations and inverse geometry compilation maintain bounded symmetry guarantees.

---

## 5. Getting Started

### Prerequisites
- **Node.js** `v22+` and **npm**
- *(Optional)* `GEMINI_API_KEY` in `.env` (copied from `.env.example`) for natural-language AI formula composition, multimodal `.pdf`/image score transcription, and AI submission draft generation. All core functionality—the Spreadsheet VM, Harmonic Codex, Formula Catalog, `ComplexityEngine`, 3D Three.js stage, Web Audio FM synth, `.wav`/`.svg`/`.png`/`.csv` exports, deterministic `.abc`/`.xml` import, D3 `.kiro` inspector, and the 500-trial PBT verifier—runs **100% locally without an API key**.

### Installation & Local Development

```bash
npm install
cp .env.example .env   # Optional: add GEMINI_API_KEY
npm run dev
```

Open **`http://localhost:3000`** in your browser.

### Typecheck, Build & Production Start

```bash
npm run lint    # Runs tsc --noEmit
npm run build   # Builds production Vite client bundle into dist/
npm start       # Runs production Express + API server via `node server.ts`
```

---

## 6. Contributing & License

- **Contributing**: See [`./CONTRIBUTING.md`](./CONTRIBUTING.md) for spec-driven contribution steps, safety contracts, and verification gates.
- **License**: Distributed under the **MIT License**. See [`./LICENSE`](./LICENSE) and [`./LICENSE.md`](./LICENSE.md).
