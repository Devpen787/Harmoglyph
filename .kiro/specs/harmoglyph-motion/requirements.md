# Harmoglyph W2-A — Signature score-to-motion integration

Status: **approved to implement an isolated first vertical slice**, not approved as final artistic direction, release, or merge. Prepared 20 Nov 2026. Parent: W0–W5 roadmap in draft docs PR #1; source stack: draft PR #3 (composition), draft PR #4 (audio-clock).

## User outcome

A person plays or edits a real musical composition and sees **graceful, continuous, meaningfully interconnected motion**. They can select the visible source note or phrase, understand how the music caused the motion, and preserve the artwork. "Galaxy" means interacting motion, not literal stars/space. It must not resemble a generic reactive equalizer.

### Reuse rather than rebuild

The earlier **separate** Song→Art and Art Lab experiments tested Glass Garden (16 notes), Switchback (20), Ribbon, Bloom, Orbit, Weave and Constellation, note selection, reveal and export. They are prior exploration, **not committed production modules**. Feedback: Ribbon communicates melody best; Bloom can look too similar across songs; Constellation becomes cluttered; initial swirling art looked tangled. User wants mix-and-match art materials, motion behavior and musically meaningful relationships. Do **not** claim these prototypes were merged or that a final visual design was accepted.

## W2-A acceptance requirements

**R1 — One canonical musical source.** Reuse `MusicalComposition`, `CompositionNote`, `compositionTimeline`, canonical note IDs, beat durations, track IDs and existing audio-clock playhead. Do not create a second song schema or separate timer that drives the art.

**R2 — Continuous, explainable motion.** Implement **one coherent primary melodic-ribbon motion grammar** (bounded, damped/oscillatory relationship if justified) inside the *existing* Compose & Art experience. Movement must flow across onsets and phrase boundaries—not teleport at note starts or generate unrelated particles. Explicitly distinguish mathematical relationships from aesthetic mappings. One polished grammar is sufficient; don't launch a six-mode rebuild.

**R3 — Relational causality.** Pitch contour, intervals, rhythm/onsets, durations, velocities and polyphonic tracks must have identifiable, testable visual consequences. Every score-derived object must retain `noteId` and `trackId` (and relevant relationship provenance); selection/inspector explains what changed and why. For Leap Dialogue, retain two voices instead of averaging them into one.

**R4 — Replay invariance.** For the same valid score, fixed motion parameters, and score beat, snapshots/checkpoints are reproducible independent of animation-frame cadence, pause/seek/replay and wall-clock time. Snapshot numeric values stay finite, within the SVG viewport, and stable after return. Do not promise bit-identical browser pixels or hardware audio.

**R5 — Edit and reveal.** Changing a note's pitch/onset/duration changes the attributable motion; scrub/start/stop/full-composition reveal work on the same state. At the end, show a meaningful persistent artwork, not an empty frame. The existing SVG and score JSON exports remain available. Visual appearance changes must not alter the audio or source score.

**R6 — Contrast and guardrails.** Verify First Mark, Glass Garden, Ascending Light, Pulse Study and Leap Dialogue, plus a deliberate negative control (invalid input, zero motion / non-finite parameter, or unsupported flattening). Outputs must be distinct and explainable: a single note stays simple; rising pitch visibly differs from repeated pulse; counterpoint shows both voices. Retain previous Orbit/Bloom/Weave as comparison/fallback; don't destroy 3D/formula/legacy features.

**R7 — Reviewable Kiro contribution.** Kiro CLI/IDE itself implements and tests the new motion feature under native specs/steering. Show failing test then code then passing test; check existing CI/build, capture screenshots from the real Compose & Art route if feasible. Separate computed frame evidence, real browser observation, and subjective aesthetic judgment. Stop for user visual review before final styling approval.

## Boundaries

This is a **production-code W2 slice**, unlike the prior exploratory prototypes. Do not redo W1 clocks, simulated audio or WAV tests; do not change synthesis envelopes or the 900 ms ceiling. W0 project-creation/AI Studio eligibility is a parallel submission gate, **not a reason to block isolated W2 implementation**. No dependencies, paid API, merge, deployment, direct main changes, or new project-management system without explicit approval. Work on the new stacked W2 branch and keep existing PR #3/#4 draft and unmerged.
