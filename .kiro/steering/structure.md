---
inclusion: always
---

# Harmoglyph Repository & Module Structure Steering

## Workspace Layout
- `/server.ts` — Express server mounting Vite middleware in dev (`port 3000`), serving `/api/kiroween/*` audits & hook runners, deterministic `.abc`/`.ly`/`.xml` score transcription, and optional server-side `@google/genai` routes.
- `/src/engine/` — Pure, deterministic TypeScript engines (zero React/DOM dependencies):
  - `spreadsheetVm.ts`: Recursive-descent `A1:F48` formula evaluator, `#CYCLE!` detector, and RFC-4180 CSV serializer.
  - `mathArtTheory.ts`: Mathematical foundation engine (`harmonic-sine`, `fibonacci`, `golden-ratio`, `pythagorean`).
  - `audioSynth.ts`: 2-operator Web Audio API FM synthesizer and offline 22.05 kHz 16-bit mono `RIFF/WAVE` `.wav` encoder.
  - `vectorPlotter.ts`: Parametric SVG/PNG curve compiler and inverse `geometryToFormulaGrid` compiler.
  - `pbtSuite.ts`: Seeded Mulberry32 Property-Based Testing suite (5 invariants × 100 trials = 500 trials).
- `/src/components/` — Modular React 19 UI views (`StudioView.tsx`, `VerifyView.tsx`, `KiroweenKitView.tsx`, `SpecDependencyGraph.tsx`, `KiroFreeTierHub.tsx`, `SubmissionChecklistWidget.tsx`).
- `/.kiro/` — Tracked Kiro spec-driven development artifacts (`specs/`, `steering/`, `hooks/`, `agents/`, `powers/`, `settings/`, `specs.json`, `agent.yaml`).
