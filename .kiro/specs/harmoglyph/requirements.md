# Requirements Specification — Harmoglyph (Kiroween 2026 Frankenstein)

## Introduction
Harmoglyph fuses three incompatible computing paradigms into a single deterministic web instrument: an Excel-style recursive-descent formula spreadsheet (`A1:F48`), a real-time polyphonic 2-operator Web Audio FM synthesizer with offline 16-bit PCM `.wav` rendering, and a bidirectional parametric SVG/PNG vector plotter—unified by four mathematical foundations (`Harmonic Sine`, `Fibonacci`, `Golden Ratio φ`, and `Pythagorean Tuning`).

---

## EARS Requirements

### Requirement 1: Formula Spreadsheet Virtual Machine (`A1:F48`)
**WHEN** a user enters a numeric literal or `=` formula into any cell in `A1:F48`,
**THE SYSTEM SHALL** parse and evaluate arithmetic, range functions (`SUM`, `AVG`, `MIN`, `MAX`), math functions (`SIN`, `COS`, `ABS`, `SQRT`, `ROUND`, `FLOOR`, `CEIL`, `POW`, `MOD`, `PI`), row/column introspection (`ROW`, `COL`), and conditional branching (`IF`) in real time.

### Requirement 2: Cycle Termination & Error Isolation
**IF** a formula contains a direct or transitive circular dependency (e.g. `A1=B1+10`, `B1=A1*2`) or division by zero,
**THEN THE SYSTEM SHALL** terminate evaluation in $O(V + E)$ time without infinite recursion, display `#CYCLE!` or `#DIV/0!` in the affected cells, and emit finite clamped fallback parameters so the audio engine cannot crash.

### Requirement 3: Mathematical Foundations Coupling (`mathArtTheory.ts`)
**WHEN** a user selects a mathematical foundation (`harmonic-sine`, `fibonacci`, `golden-ratio`, or `pythagorean`) or clicks **Apply Math to Sheet**,
**THE SYSTEM SHALL** dynamically modulate both the 2-operator FM synthesizer sideband ratios/brightness and the parametric SVG vector symmetry/phase parameters from the same mathematical sequence.

### Requirement 4: 2-Operator Web Audio FM Synthesizer & Offline `.wav` Export
**WHEN** playback is active or **Export Audio (.wav)** is triggered,
**THE SYSTEM SHALL** map each evaluated row (`A`: Pitch Hz, `B`: Gate, `C`: FM Index, `E`: Decay ms, `F`: Harmonic Ratio) into clamped Web Audio FM synthesis (`20–4000 Hz`, gain `<= 0.35`) across 4 timbral voices and generate a valid 44-byte `RIFF`/`WAVE` 16-bit mono PCM `.wav` download.

### Requirement 5: Bidirectional Parametric Vector Plotter & `.svg` / `.png` / `.csv` Exports
**WHEN** spreadsheet cell values or inverse geometry sliders change,
**THE SYSTEM SHALL** project the evaluated steps into Harmonograph, Chladni Mandala, FM Ribbon, or Euler Pitch Spiral curves, support reverse-compilation from geometry back into `=` formulas (`geometryToFormulaGrid`), and export standalone `.svg`, `1200×900` `.png`, and lossless `.csv` files.

### Requirement 6: Score Transcription & Natural-Language Formula Assist
**WHEN** a user uploads a music score (`.abc`, `.ly`, `.musicxml`, `.pdf`, or image) or submits a formula prompt,
**THE SYSTEM SHALL** transcribe the melody, key signature, tempo, and durations into playable `A1:F48` mathematical spreadsheet formulas without exposing API keys in browser code.

### Requirement 7: Kiro Free-Tier Governance, Property-Based Verification & Submission Audit
**WHEN** the user opens the **Verify (PBT)** or **Kiroween Kit** views,
**THE SYSTEM SHALL** execute 500 seeded Property-Based Testing trials across 5 formal invariants, render the interactive D3 `SpecDependencyGraph` parsed from `/.kiro/specs.json`, track Git/`.kiro` staging and official hackathon rules in real time, and allow 1-click execution of `/.kiro/hooks/*.json`.
