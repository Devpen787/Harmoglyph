# Contributing to Harmoglyph

Thank you for contributing to **Harmoglyph**! This project was engineered for **Kiroween 2026 (Frankenstein Category)** using Kiro's spec-driven workflow, and all contributions follow the specifications, steering contracts, and verification invariants documented in `/.kiro/`.

---

## 1. Spec-Driven Development Workflow (`/.kiro/`)

Before modifying core engine behavior or adding new features, align your changes with the repository's Kiro pipeline:

1. **Requirements** (`/.kiro/specs/harmoglyph/requirements.md`) — Update or verify EARS-formatted functional and safety requirements (`WHEN ... THE SYSTEM SHALL ...`).
2. **Design** (`/.kiro/specs/harmoglyph/design.md`) — Document unidirectional dataflow, mathematical foundation mappings, DSP clamping, and Express API contracts.
3. **Tasks** (`/.kiro/specs/harmoglyph/tasks.md`) — Break implementation work into verifiable tasks mapped to the 5-agent crew (`/.kiro/agents/synth-crew.json`).

> **Repository Rule**: Never ignore `/.kiro/` in `.gitignore`. All Kiro specs, steering docs, hooks, agents, powers, and MCP configurations must remain visible and tracked in version control.

---

## 2. Mandatory Steering & Safety Contracts

Any changes under `src/engine/` or `server.ts` must honor the active steering documents:

- **Audio Safety Contract (`/.kiro/steering/audio-safety-contract.md`)**:
  - Carrier pitch (`Col A`): strictly clamped to **`[20, 4000] Hz`**.
  - Gate (`Col B`): strictly clamped to **`[0, 1]`**.
  - FM Modulation Index (`Col C`): strictly clamped to **`[0, 12]`**.
  - Orbit Phase (`Col D`): strictly clamped to **`[10, 100]`**.
  - Envelope Decay (`Col E`): strictly clamped to **`[40, 900] ms`**.
  - Modulator Ratio (`Col F`): strictly clamped to **`[0.25, 8]`**.
  - Master Web Audio output gain must remain **`<= 0.35`** and PCM `.wav` rendering must apply soft-knee limiting so `NaN`/`Infinity` never reach speakers or audio buffers.
- **Math-Harmony Contract (`/.kiro/steering/math-harmony-contract.md`)**:
  - All 4 mathematical foundations (`harmonic-sine`, `fibonacci`, `golden-ratio`, `pythagorean`) and `ComplexityEngine` symmetry calculations must remain deterministic and fault-isolated.
- **Node.js v22 ESM & Strip-Types Compatibility**:
  - Production starts directly with `node server.ts`. Any module imported by `server.ts` (directly or transitively under `src/engine/` and `src/types/`) **must** use explicit `.ts` extensions on relative imports and explicit `type` modifiers (`import { type Foo }`) on TypeScript-only interfaces and type aliases.
- **UI & Visual Discipline**:
  - Keep `src/components/` consistent with Harmoglyph's dark instrument surface palette (`#07090E`, `#0B0F17`, `#111622`, `#1F2A40`, `#00E5CC`, `#38BDF8`, `#F59E0B`) and Tailwind CSS styling.
  - Never commit `.env` files, API keys, or secrets (use `.env.example` for variable declarations).

---

## 3. Local Development Setup

```bash
# Install dependencies
npm install

# Copy optional environment template (only needed for AI compose & PDF/image sight-reading)
cp .env.example .env

# Run Express + Vite dev server on http://localhost:3000
npm run dev
```

---

## 4. Verification Gates Before Submitting Changes

Run **all** of the following checks locally and ensure they pass cleanly before committing or opening a pull request:

1. **TypeScript Typecheck (`npm run lint`)**:
   ```bash
   npm run lint
   ```
2. **Production Bundle (`npm run build`)**:
   ```bash
   npm run build
   ```
3. **Production Server Smoke Test (`npm start`)**:
   ```bash
   NODE_ENV=production npm start
   ```
   Confirm `server.ts` starts cleanly under `node` without ESM resolution errors and serves `http://localhost:3000/`.
4. **500-Trial Property-Based Testing Suite & Submission Audit Hooks**:
   Open **Verifier / PBT** in the app (or `POST /api/kiroween/run-hook`) and verify all **500/500 trials** pass across:
   - `cycle-termination` (100/100)
   - `acoustic-clamp` (100/100)
   - `csv-roundtrip` (100/100)
   - `wav-header` (100/100)
   - `math-foundation-symmetry` (100/100)
   And run the `kiroween-submission-audit` hook (`/api/kiroween/audit`) to confirm `/.kiro/`, `LICENSE`, `LICENSE.md`, `CONTRIBUTING.md`, `.gitignore`, and `README.md` checks pass.

---

## 5. License

By contributing to Harmoglyph, you agree that your contributions will be licensed under the **MIT License** ([`./LICENSE`](./LICENSE) / [`./LICENSE.md`](./LICENSE.md)).
