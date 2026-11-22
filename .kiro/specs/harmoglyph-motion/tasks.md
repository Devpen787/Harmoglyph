# Kiro W2-A implementation tasks — isolated first integration

**Status 20 Nov 2026:** T0–T5 executed by Kiro CLI on this branch. Commit SHA and CI result are in the PR #5 comment for this commit. Visual direction is **not** approved; awaiting ChatGPT code review and Dev visual review.

- [x] **T0 — Protect worktree.** Fetch branch `work/w2-signature-motion-2026-11-20` and confirm it is based on PR #4 HEAD `2b653ec`. Check `git status` and preserve pre-existing local changes. Read W2 requirements, design, prior W0/W1 handoff and the precise existing `CompositionJourneyView` + composition model. Do not overwrite untracked files.
- [x] **T1 — First meaningful failing tests.** Write and run tests on a pure motion-model contract: consistent timestamps produce equal coordinates; score changes affect musical motion; Leap Dialogue retains independent source tracks; invalid/nonfinite values fail closed; all positions finite and in bounds. Capture actual failure before implementation; don't manufacture failing tests based only on missing import without specifying the intended behavior.
- [x] **T2 — Build score-derived continuous motion kernel.** Implement one coherent Ribbon grammar (bounded melodic contour + meaningful interval/rhythm/velocity/phrase dynamics, gentle damped coupling if justified). Model independent of React/WebAudio, with stable IDs and explicit formula/design mappings. Do not add a new generalized physics framework or random particles.
- [x] **T3 — Integrate into real user flow.** Add a Ribbon option inside the existing Compose & Art art field. Connect its motion to current audio-clock-derived beat and score; preserve existing Orbit/Bloom/Weave, note selection and inspector, responsive layout, Full show, scrub, completed-art view and SVG export. Source-to-visible-geometry interactions should be keyboard accessible. Keep all original formula/3D features reachable.
- [x] **T4 — Contrasting fixture proof.** Exercise First Mark, Glass Garden, Ascending Light, Pulse Study and Leap Dialogue. Compare repeatable checkpoints and visibly distinct dynamics; prove edit→motion causal change. Capture screenshots from the actual app in an accessible headed browser if feasible and note subjective design uncertainty. Do not recreate or claim to have imported earlier standalone experimental source code.
- [x] **T5 — Independent verification and stop.** Run `npm run lint`, `npm run test:composition`, timeline tests, motion tests, seeded PBT 5×100 and `npm run build`. Add the new motion-test command to existing CI so it runs independently on the W2 commit. Read resulting GitHub Actions status. Record exact Kiro changes/test results, demo paths/screenshots, caveats and SHA in the existing evidence lineage or W2 PR description. Commit/push only scoped W2 code/tests/evidence to W2 branch. **Do not merge, deploy, change main, alter audio envelope, or move to W3.** Stop for ChatGPT code and Dev visual review.

Parallel W0 eligibility origin check and remaining W1 human audio observation remain open for submission; do not re-run or block W2 implementation on those while they are separately tracked.

### Execution notes (Kiro CLI, 20 Nov 2026)
- T0: branch tracks `origin/work/w2-signature-motion-2026-11-20`, which contains PR #4 head `2b653ec`; only pre-existing local file (untracked `package-lock.json`) left untouched.
- T1: 13 behaviour tests in `src/engine/compositionMotion.test.ts` run against a typed stub: 11 fail, 2 pass vacuously (empty tracks). Log: `docs/evidence/w2/t1-failing-run-2026-11-20.txt`.
- T2: `src/engine/compositionMotion.ts` (pure). 13/13 pass. Mutation checks (teleporting jump, wall-clock dependence) are caught: `docs/evidence/w2/t2-mutation-checks-2026-11-20.txt`.
- T3: Ribbon added to the existing Compose & Art grammar switch; Orbit/Bloom/Weave unchanged.
- T4: real-app capture of all five presets in headed Chrome for Testing 156: `docs/evidence/w2/screenshots/`, `docs/evidence/w2/ui-check-2026-11-20.json`.
- T5: `npm run test:motion` added and wired into `.github/workflows/w0-baseline.yml`.

### W2-B (Kiro CLI, 21 Nov 2026) — response to "Independent W2-A review"
- [x] Rest attribution: samples name a note only while it sounds; silence is a labelled `rest` bridge. 3 regressions failed on `decb96c`, pass now.
- [x] Browser check: live motion requires two observations while playing, both with head positions, displacement > 1 px.
- [x] Candidate grammar "Current" (`src/engine/compositionCurrent.ts`), 10 tests; Ribbon kept as baseline.
- [x] Real voice coupling in Current (consonance-weighted, one-directional, λ ≤ 0.3); Ribbon links relabelled as annotations.
- [x] A/B screenshots, 5 presets × 2 grammars × (in-progress, complete): `docs/evidence/w2/w2b-screenshots/ab-contact-sheet.png`.
- [x] Focus treatment: dashed white stroke on the path at `:focus-visible`, no rectangular outline.
- [x] Live-motion browser evidence: was blocked in W2-B (frozen AudioContext clock); W2-C reran the corrected check, 15/15 pass (see W2-C notes).
- [ ] Dev visual selection between Ribbon and Current.

### W2-C (Kiro CLI, 21–22 Nov 2026) — response to "ChatGPT independent W2-B review"
- [x] Same-track overlap: samples list all sounding notes (`activeNoteIds`); newest owns the position; motion returns to the older note when the inner one ends. 3 regressions failed first; preset frames byte-identical to `6391704`.
- [x] Audio-clock diagnosis: the stall is intermittent and environmental (output-device stream), not Harmoglyph-specific; 0/20 frozen on repeat; Web Audio without an output device always ran.
- [x] Luminous material for Current (`src/engine/currentMaterial.ts`, 6 tests), appearance only; Current kept unchanged for comparison.
- [x] Real-app A/B, pitch edit and coupling captures: `docs/evidence/w2/w2c-screenshots/w2c-contact-sheet.png`.
- [ ] Dev visual review. Kiro's own assessment: Luminous still reads as a line chart (see handoff).
- [ ] Proposed, not implemented (needs approval): detect a stalled audio clock after Play and tell the user instead of silently freezing.
