---
name: spreadsheet-dsp-power
displayName: Spreadsheet DSP & Vector Export Power
description: Compiles recursive-descent A1:F48 spreadsheet formulas into 2-operator Web Audio FM synthesis, 16-bit PCM RIFF/WAVE audio, and parametric SVG/PNG vector plots.
keywords: ["spreadsheet-vm", "web-audio", "fm-synth", "wav-pcm", "svg-plotter"]
---

# Spreadsheet DSP & Vector Export Kiro Power

Bundled domain expertise for turning tabular spreadsheet formulas into real-time Web Audio synthesis and deterministic digital artifacts:

1. **Recursive-Descent Formula Parsing (`src/engine/spreadsheetVm.ts`)**:
   - Tokenizes literals, unary sign, binary operators (`+`, `-`, `*`, `/`, `^`), comparison operators (`=`, `<`, `>`, `<=`, `>=`, `<>`), ranges (`A1:A48`), and pure math/audio functions (`POW`, `SIN`, `COS`, `MOD`, `IF`, `ROW`, `COL`, `PI`).
2. **2-Operator Web Audio FM Graph (`src/engine/audioSynth.ts`)**:
   - `modulator (sine/triangle/square)` -> `modGain` -> `carrier.frequency` -> `lowpass biquad` -> `exponential ADSR gain` -> `masterGain (0.28)` -> `AnalyserNode`.
3. **Pure-TypeScript Offline PCM Renderer**:
   - Synthesizes 22.05 kHz mono 16-bit signed PCM directly into a `DataView` with a valid 44-byte `RIFF`/`WAVE` header so exports play offline in any media player or DAW.
4. **Parametric Vector Projection & Inverse Compiler (`src/engine/vectorPlotter.ts`)**:
   - Maps `(orbitX, freqHz, fmIndex, modRatio)` per step into smooth SVG curve coordinates and reverse-compiles geometric targets back into `=` formulas via `geometryToFormulaGrid()`.
