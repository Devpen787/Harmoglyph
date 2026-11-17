---
inclusion: fileMatch
fileMatchPattern: "src/engine/{mathArtTheory,vectorPlotter,audioSynth}.ts"
---

# Mathematical Harmony & Cymatics Coupling Contract

1. **Foundation Determinism**:
   Every `MathFoundationId` (`harmonic-sine`, `fibonacci`, `golden-ratio`, `pythagorean`) in `src/engine/mathArtTheory.ts` MUST compute deterministic, finite modifiers (`fmRatioScale`, `fmIndexScale`, `filterCutoffMultiplier`, `lobeMultiplier`, `phaseStepRad`, `radiusPower`, `spiralDivergenceDeg`) for any step index `0..47` and root frequency `20..4000 Hz`.
2. **Audio-Visual Symmetry**:
   Toggling a mathematical foundation in `StudioView` MUST simultaneously modulate:
   - The 2-operator FM synthesizer (`audioSynth.ts` modulator ratio, modulation index depth, and biquad filter brightness) in both live Web Audio and offline 16-bit `.wav` rendering.
   - The parametric SVG plotter (`vectorPlotter.ts` Harmonograph phase delta, Mandala Chladni lobe count, Ribbon sideband frequency, and Pitch Spiral divergence angle).
3. **Inverse Geometry Compilation**:
   `geometryToFormulaGrid()` MUST emit valid `=` spreadsheet formulas across `A1:F8` whose evaluated `steps` reproduce finite, clamped frequencies and harmonic ratios.
