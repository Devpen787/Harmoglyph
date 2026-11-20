# W2-A design — score → relationships → continuous motion → artwork

This is a design contract for Kiro to implement, not evidence of completed code.

## Existing seams (do not duplicate)

- `src/engine/composition.ts`: canonical `MusicalComposition`, `sortedNotes`, `deriveGeometry`, `validateComposition`, preset fixtures, mathematical note/source attribution.
- `src/engine/compositionTimeline.ts`: audio-second/beat conversion and lookahead.
- `src/components/CompositionJourneyView.tsx`: authored editing, `playhead` computed from `AudioContext.currentTime`, score selection, `performing`, `showComplete`, SVG export and source/math inspector. Current art modes `orbit | bloom | weave` are **static/progressive marks**, not a continuous physics engine.
- `src/engine/audioSynth.ts`: existing scheduled FM synth. **Keep unchanged**.
- `src/components/HarmonicThreeStage.tsx`, `src/engine/vectorPlotter.ts`, formula A1:F48: preserve and reuse only where appropriate; not a forced conversion of polyphonic score to monophonic sheet.

## Proposed first vertical slice

1. **Pure deterministic motion model** in `src/engine/compositionMotion.ts` (final name may be adjusted if already occupied). Inputs: validated canonical composition, absolute composition beat (or seconds converted once), an explicit bounded motion config; outputs: ordered source-attributed motion samples / ribbon control points and inspectable relationships. Pure functions only—no DOM, Web Audio, React, `Date.now()`, `Math.random()`, or frame-to-frame accumulated state dependent on refresh rate.
2. **One expressive grammar:** melodic ribbon is the visual spine. Pitch interval influences relative curvature/displacement, note onset/length influences progression and persistence, velocity influences bounded amplitude/thickness, same-beat counterpoint forms separate but visually related tracks. A small deterministic damped oscillatory/spring-inspired response is allowed **only if** clearly driven by note relationships and produces smooth motion. Prefer evaluating a state at time `t` directly; a fixed-step solver must be deterministic under arbitrary frame cadence and seek.
3. **Renderer/material separation:** a lightweight SVG renderer added to existing artwork canvas; source `noteId/trackId` remains accessible via click/keyboard and inspector. Reuse the current palette and SVG export; don't rebuild React navigation or make a separate demonstration app. Existing Orbit/Bloom/Weave remain selectable as baseline comparisons; Ribbon becomes an option only when it works.
4. **Small, legible source inspector extension:** selected note shows its preceding interval / phrase / track and the declared mapping from those inputs to motion. Explain mathematical frequency/ratio separately from artistic scaling, damping, palette and layout.
5. **Stable completion:** when `showComplete` or `progress >= totalBeats`, a final rendered composition remains visible and exports via existing Save SVG. Seek and restart must not accumulate stale trails or duplicate notes.

## Expected proof

- Pure exact-time frame sampler produces identical canonical checkpoints on two calls with same input; frame-order invariance by comparing direct sampling at beat B with 30fps/60fps/irregular checkpoints.
- At least one controlled note pitch edit changes only its attributable geometry/relationship and leaves original score/voice count intact; appearance-only selection never invokes audio schedule changes.
- Polyphonic Leap Dialogue includes all 12 notes and two distinct track IDs.
- Single-note First Mark is deliberately restrained, not a crowded nebula.
- Contrast screenshots of First Mark, Glass Garden, Ascending Light, Pulse Study and Leap Dialogue at documented beat positions; a reviewer assesses aesthetic continuity and distinction. Automated finite/bounded/source-ID tests alone **do not prove beauty or fluidity**.
- Tests run in GitHub Actions on exact W2 commit (new test command integrated into existing workflow), not just CLI output.
- Demonstrate one explicit failure/negative control and explain why it fails safe.

## Critical distinction

A visual arc reveal progresses over time but is not itself expressive continuous motion. W2 must actually change positions/shapes continuously as a function of the score-derived time, while preserving a stable completed art state. No physical cymatics, arbitrary notes-as-gravity claim, or guaranteed sub-5ms A/V sync.

## Workflow and authority

Start from PR #4 head `2b653ecf3062e579b4747d80f4d138edb2028d66`, W2 branch `work/w2-signature-motion-2026-11-20`, stacked PR targeting the PR #4 branch. The Kiro agent owns the code and tests; ChatGPT independently reviews commit and CI, then Dev chooses which visual variant is sufficiently compelling. No merge/deploy. Keep detailed evidence in the existing W0–W5 owning record and PR description/comment, not a parallel dashboard.
