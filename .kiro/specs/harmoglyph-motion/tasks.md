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

### W2-D (Kiro CLI, 22 Nov 2026) — Dev-approved options 1 + 2 after the be-of-dao.com reference
- [x] Filament material (`src/engine/filamentMaterial.ts`, 7 tests written first): each voice is a bundle of 36 hashed (non-random) strands on the existing motion coordinates; works on Current and Ribbon frames.
- [x] DAO-inspired palette while Filament is selected: black ground, bone white, one warm hue per voice; other styles unchanged. No new fonts.
- [ ] Dev visual review (open questions in handoff W2-D section).

### W2-E (Kiro CLI, 22 Nov 2026) — Filament II volume variant, W2-D kept as A/B baseline
- [x] `buildFilamentLayer(..., { variant: 'volume' })`; default stays W2-D (fingerprint `43f014de77daa5d4` unchanged).
- [x] Volume from note thickness; First Mark sparse control; rests identical to W2-D; coupling bends eased across each real coupling window, zero outside and with zero coupling. 5 focused tests (4 failed first).
- [x] Real-app A/B at matching beats/viewport/framing, fixed-view Glass Garden edit, mouse + keyboard selection, export determinism, playback motion.
- [ ] Dev visual review (tradeoffs in handoff W2-E section).

## Finish the musical artwork — Dev's product direction, 22 November 2026

Done means a creator can hear an arrangement, watch its artwork grow, hang a cohesive print, rotate the complete static 3D sculpture, and reopen one editable digital original. Selecting a meaningful region reveals its musical sources, mapping and time range and plays the corresponding passage. The score, style, mapping version and framing reproduce the declared result. The static digital sculpture is required. Physical fabrication is a separate optional outcome.

Tick each item after recording its revision and evidence here or in the existing handoff. Dev chooses the artwork. A screenshot, a CI result, a listening observation and a physical print establish different things.

### Reference passage and visual baseline
- [x] Use Leap Dialogue as the first controlled two-voice study. At revision `2b722858`, the score has 8 lead notes, 4 counterline notes, 8 beats and 104 BPM. Recomputed three region anchors from the preset and its onset generator below. Beat offsets are zero-based.
- [x] Confirm W2-E implementation and independent CI [45033423063](https://github.com/Devpen787/Harmoglyph/actions/runs/45033423063). The [browser evidence](../../../docs/evidence/w2/w2e-ab-check.json) records repeat-identical SVG export with 12 note paths, keyboard/mouse selection, and a controlled pitch edit. The [contact sheet](../../../docs/evidence/w2/w2e-screenshots/w2e-ab-contact-sheet.png) is ready for visual review.

| Beat offset | Melody | Counterline | Check in both views |
|---|---|---|---|
| 0 | lead-1, C4 | counter-1, C3 | Identify the opening octave and audition it |
| 2 | lead-3, E5 | counter-2, G3 | Match the third lead onset to its two sounding voices |
| 6 | lead-7, D5 | counter-4, G3 | Trace the late phrase and its movement into the ending |

### Make and hear the music
- [ ] Compose and save a new original passage using the editor. Audition melody and bass separately and together. Add rhythmic accents intentionally.
- [ ] For the known-song path, select a recognizable 4–8-bar passage of Wake Me Up and a source permitted for the intended use. Record arrangement and source credits.
- [ ] Enter or import the melody, check pitch and rhythm by ear, then add bass and pulse. Compare to the chosen reference and label playback as the arrangement. Evaluate MIDI/MusicXML import against manual entry if it helps scale to a full song.
- [ ] Expand both studies section by section to completed pieces. If playback of a specific recording is desired, separately test authorized audio aligned to verified phrase timestamps.

### Shape and print
- [ ] Compare both Filament versions at matching framing. Use First Mark for silence, Glass Garden for a single voice and Leap Dialogue for counterpoint. Dev chooses a print candidate.
- [ ] Compare continuous and phrase-grouped layouts on a longer score. Run controlled tests for pitch, rhythm, and coupling with one input changed at a time. Record which visual rules are authored and which values come from the score.
- [ ] Export the approved full composition as SVG. Set intended paper size and margins, open independently, print at size and assess line weight, silhouette and balance at wall distance.

### Link the sculpture and the score
- [ ] **Next Kiro implementation:** Generate one static 3D study from Leap Dialogue's existing score-derived paths, retaining both voices and the three region anchors above. Reuse the 3D stage where suitable. Evaluate a shallow relief and depth-separated voices. Capture front, side and oblique views; rotate after playback ends.
- [ ] Make a selection in either artwork resolve to the same note/phrase IDs and beat range. Audition the region and show why its geometry changed. Exercise all three anchors and a rest or zero-coupling control.
- [ ] Export the static model (GLB candidate), reopen it in an independent viewer, and check geometry, materials and multiple viewpoints. Optional physical edition: validate thickness/supports and fabricate a small proof.
- [ ] Save score, tracks, tempo, rules, versions, any seed, material, framing, camera and source-region links together. Add Open Piece with validation, legacy-score handling and preservation of the current piece on failure.
- [ ] In a clean browser reopen, play, seek, edit and re-export. Compare source IDs, timing, geometry checkpoints and final views. Verify an appearance-only edit preserves sound and motion. Check a supported formula/3D transfer and the safe refusal of a lossy polyphonic sheet transfer.
- [ ] Have a new user make, explain, save and reopen their version unaided. Record 3–5 creator observations and Dev's final print and sculpture selection.

### Release and Kiroween
- [ ] Reconcile AI Studio source history and pending changes with the draft PR stack. Establish eligibility and rights for public assets and demo music.
- [ ] Complete human listening including first play, polyphony, pause/seek, background/return and legacy playback. Check two browsers, keyboard, reduced motion, small screens and performance on the release build.
- [ ] Prepare the reviewed release SHA. Restrict development-only server operations in the public build. Verify clean install, tests, public judge URL, exports and replay.
- [ ] Assemble Kiro spec/commit/test and hook evidence with observed limits. Finish README, honest prior-art comparison, licensed public demo video under three minutes, category and Devpost preview. Obtain Dev's release/submission approval and verify the submitted links.
