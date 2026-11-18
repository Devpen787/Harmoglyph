# Harmoglyph — Deep Research #12 + #13: Synthesis, Baseline and Review Checklist

**Status:** REVIEW REGISTER — not an approved architecture, implementation authorization, test result, or Kiroween readiness declaration.  
**Prepared:** 18 November 2026. **Owner:** Harmoglyph documentation / [draft PR #1](https://github.com/Devpen787/Harmoglyph/pull/1).  
**Scope:** Compare both uploaded deep-research reports against the accessible GitHub main branch and [draft PR #3 (Compose & Art)](https://github.com/Devpen787/Harmoglyph/pull/3); preserve the ability to build layered, graceful, music-driven evolving artwork. No production modifications.

## 0. Original materials, evidence and interpretation

| Reference | Exact source | Primary content |
| --- | --- | --- |
| R12 | [Deep Research #12 — original verbatim report](./sources/deep-research-report-12-original.md) | 11 sections: musical intelligence (§1), mathematical pattern languages (§2), emergent motion (§3), artistic rendering (§4), pipeline (§5), six proposed motion grammars (§6), evaluation (§7), existing tools (§8), user journeys (§9), MVP/Kiro (§10), recommendations (§11) |
| R13 | [Deep Research #13 — original verbatim report](./sources/deep-research-report-13-original.md) | Review of claims, alternatives, proposed decisions, typed contracts, oscillator/spring/boids equations, timing and fixed-step simulation, test invariants, performance, three journeys, prototypes, Kiroween timeline |
| D13 | [Prior critical review of R13](../RESEARCH_13_REVIEW_ADR_PROPOSAL.md) | Source-code corrections, false or unsafe invariants, Kiro format, phased candidate experiments |
| MAIN | [Harmoglyph main](https://github.com/Devpen787/Harmoglyph/tree/main) | Existing sheet VM, mathematical foundations, native Web Audio FM synthesis, vector art, Three.js stage, PBT, server and .kiro |
| PR3 | [Unmerged draft #3](https://github.com/Devpen787/Harmoglyph/pull/3) | Composition model, tracks and note events, five demonstration scores, note/shape inspector, local draft, SVG/JSON export, composition unit tests |
| EXT | [Official Kiroween rules](https://kiroween.devpost.com/rules), [Kiro hooks documentation](https://kiro.dev/docs/hooks/), [AudioContext getOutputTimestamp](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp) | Independent external contracts to verify against, not results of running the app |

**Evidence grading:** **SOURCE** = inspected actual source; **DRAFT** = in PR #3 only; **REPORTED** = report/PR documentation asserts execution; **NOT VERIFIED** = no independent running browser, listening, profiler, Kiro run, or deployed app test in this review. An unchecked checkbox is a *review gate*, not necessarily a missing feature. Actual code presence is not a pass.

**Baseline as observed:** GitHub main is public. Both PR #1 and PR #3 remain OPEN DRAFTS and are NOT merged. Main has a root MIT LICENSE, formula VM and native synthesizer, four art modes and mathematical foundations, SVG/PNG/CSV/WAV code paths, a Three.js stage, and seeded PBT test source. The current deployed Google AI Studio version and any different local Kiro branches were NOT independently inspected; do not call either identical to main or PR #3.

## 1. Findings: both research reports compared

| Topic | R12 finding | R13 finding / proposed choice | Current project finding and synthesized disposition |
| --- | --- | --- | --- |
| Source representation | Symbolic score gives exact note events; MIR/audio analysis is optional | Discrete score chosen; audio ingestion deferred | **DRAFT** PR3 already introduces MIDI-number note events with onset/duration in beats and tracks. Retain; do not rebuild. MAIN has a different A1:F48 grid, not the same canonical composition. |
| Musical intelligence | Add intervals, chords, motifs, phrase segmentation, timbral features | Primarily pitch/gate/time; rejects spectral analysis for MVP | **PARTIAL** MAIN has just-interval/symmetry calculations; PR3 has basic note/track provenance and demo fixtures. Rich phrase/chord/semantic extraction must be assessed, not presumed present. |
| Lissajous/harmonographs | Treat simultaneous oscillator frequency ratios as mathematical visual relationships | Make oscillators first motion grammar | **SOURCE** MAIN already has harmonograph vector art and mathematical foundations. Neither report proves that existing visual motion is smoothly score-timed or independently remixable. Distinguish angular frequency (rad/s) from audible Hz and remember mapping choices are authored, not universal laws. |
| Golden angle / phyllotaxis | Early recommendation: spiral growth + ribbon | Reject golden-angle as primary unless musically justified | **SOURCE** golden angle is already in mathArtTheory and project foundations. Keep as one optional mathematical/aesthetic grammar, not a mandated meaning of melody. |
| Fourier/fractals/3D | Long-term methods and image vocabulary | Concentrates on simple oscillator/spring and 2D Canvas/SVG | **SOURCE** Three.js sculpture is already substantial. Do not throw away 3D or reverse geometry work; do not mandate a new renderer before profiling the real bottleneck. |
| Coupled motion | Kuramoto, boids, springs, flow fields, fluids, reaction-diffusion, attractors | Prefer simple damped springs, defer boids/fluids/complex coupling | **PROPOSAL** Test score-linked spring/coupled field alongside melodic ribbon. Leave boids, fluid and other grammars in future capability backlog until they demonstrate causal value. |
| Art mixing | Forms, materials and visual styles should be independent of motion | D3/Canvas/SVG first, Three.js for 3D | **PARTIAL** MAIN art modes and 3D stage exist; PR3 has SVG grammar variants. A shared, independently switchable **form × motion × relationship** system is not established. |
| Music-driven meaning | Note/interval source should explain every contribution | “Why” inspector and formulas | **DRAFT** PR3 maps notes to arcs and identifies individual note contributions. That is not yet a full explanation for continuous coupled motion or emergent structures. |
| Persistence and export | Final artwork, animated performance, still/vector + audio | WAV/JSON, video optional | **PARTIAL** MAIN WAV, CSV, SVG, PNG; PR3 localStorage, score JSON and SVG. A portable composition+rules+motion+style+seed file and synchronized video export are not verified. |
| Frame smoothness | Target 60 fps, continuous movement rather than SVG step popping | Fixed-step sim, rendering interpolation | **GAP** PR3 song view is requestAnimationFrame + performance.now; MAIN grid player is setInterval. Neither establishes a common audio-time driver plus stable continuous simulation state. Current Three.js animation does not prove the proposed composition motion engine exists. |
| Determinism | Reproducible score→art outputs | “Verified determinism” as hard promise | **QUALIFY** Verify bounded, repeatable simulation checkpoints under pinned input/config/seed/version. Do not promise byte-identical audio/video across devices/browsers or automatic proof of beauty. |
| Product journey | Note → phrase → piece → audiovisual show; adjustable layers, inspection | Quick Play → Draw-to-Music → advanced mapping | **DRAFT** PR3 implements a first note→song→show flow; existing 2D reverse geometry is not automatically song-to-score reversibility. Preserve beginner-to-advanced progression; decide whether reverse drawing belongs in later iteration. |
| Competitive landscape | Chromat, Resonance, Hydra, Chroma Flow, fluid-particles, Gray-Scott, TouchDesigner, Max, Notch etc. | Tone.js, Three, D3 licensed alternatives | **RESEARCH PENDING** Reports mention numeric references but do not include a consistently resolvable bibliography, precise commit/license versions or credible novelty proof. Do not repeat “no one has combined this” as established fact. |
| Kiro / contest | PBT, hooks, end-to-end demo and Kiro evidence | Kiro-driven plan and demo gates | **PARTIAL** .kiro and seeded PBT source exist; hooks use legacy-looking schema. Real Kiro execution/trigger logs, official submission compliance and provenance are not verified. |

### Conflicts or misleading requirements: disposition before any coding

1. **Tone.js is not already in the code**, despite wording in R12. MAIN and PR3 use native Web Audio; neither reviewed package.json lists Tone.js. Prototype a native look-ahead scheduler first and add Tone.js only if a measurable need remains.
2. **A new score model is not a blank-slate task.** PR3 already has MusicalComposition, CompositionNote, CompositionTrack, deriveGeometry, validated five fixture scores and tests; use them as the starting candidate. Review integration with A1:F48 rather than replacing the sheet.
3. **R12 phyllotaxis-first and R13 harmonograph-first are competing preferences, not objective conclusions.** Run aesthetically meaningful comparison tests; retain creative range.
4. **R13's MappingRule.transform as JavaScript string is not a safe data contract.** Use typed, allowlisted operators with units, normalized input, bounded output and provenance.
5. **“Silence = no motion” is not a general invariant.** No new music-triggered impulses may be correct, while existing particles may decay and an intentional ambient loop may continue.
6. **“Repeated notes overlap” is not a general invariant.** Same pitch may share one parameter while different onset, duration, velocity and tracks produce distinct marks or movement.
7. **“Tempo doubling preserves the same trajectory” only holds for deliberately beat-normalized laws.** Real-time inertia/decay in seconds responds differently to tempo.
8. **“Polyphony is linearly additive visually” contradicts the purpose of coupled dynamics.** Ensure both notes/voices remain accounted for; only require additive output when a specific renderer explicitly claims linear compositing.
9. **“k > 0 and damping > 0 guarantees stability” is false for arbitrary numerical integration.** Define solver/integrator, dt, clamps, finite checks and reference expectations.
10. **Zero damping is not intrinsically a bug.** Test invalid units, unsafe magnitudes, broken provenance, negative duration, non-finite state and contradictory mapping as deliberate failure cases.
11. **“Audio-visual synchronization <5 ms” is not a credible universal browser-screen guarantee.** Audio can be scheduled precisely, but screen updates, output device latency and browser policies must be separately measured. For 60 Hz, a display frame is approximately 16.7 ms.
12. **Code descriptions are not verified runs.** R13 “implicitly verified by Devpost” is not independent code or runtime validation; PR3 documentation also labels browser/listening gates open.
13. **A petal per bar is a visual metaphor, not derived musical necessity.** Do not assume the standalone Phrase Bloom mockup and PR3's different bloomPath implementation are the same renderer.
14. **R13's “approved/chosen” language is a research proposal.** No architecture or product scope is accepted merely because the report says “we decide”.
15. **“All libraries are MIT” is inconsistent even between report sections.** Verify each exact upstream project version and license before copying code; algorithm descriptions are not permission to reuse a source implementation.

## 2. Current code baseline — source paths to use while reviewing

| Area | MAIN code | DRAFT PR3 change | Current assessment |
| --- | --- | --- | --- |
| Original instrument | [src/types/chimera.ts](https://github.com/Devpen787/Harmoglyph/blob/main/src/types/chimera.ts), [spreadsheetVm.ts](https://github.com/Devpen787/Harmoglyph/blob/main/src/engine/spreadsheetVm.ts) | [composition.ts](https://github.com/Devpen787/Harmoglyph/blob/refs/pull/3/head/src/engine/composition.ts) | MAIN: A1:F48 (8 initial rows, max 48), columns Hz/gate/FM/orbit/decay/ratio. PR3: music in MIDI-number/beat units, up to 24 beats, 1–3 tracks, 0.5-beat onset/duration. Bridge is constrained and intentionally rejects lossy polyphony transfer. |
| Music playback | [audioSynth.ts](https://github.com/Devpen787/Harmoglyph/blob/main/src/engine/audioSynth.ts), [App.tsx](https://github.com/Devpen787/Harmoglyph/blob/main/src/App.tsx) | [CompositionJourneyView.tsx](https://github.com/Devpen787/Harmoglyph/blob/refs/pull/3/head/src/components/CompositionJourneyView.tsx) | MAIN: setInterval on UI schedules current-time note. PR3: performance.now/rAF beat position triggers note with current audio time. Neither should be described as proven tight sync. |
| Math/visual geometry | [mathArtTheory.ts](https://github.com/Devpen787/Harmoglyph/blob/main/src/engine/mathArtTheory.ts), [vectorPlotter.ts](https://github.com/Devpen787/Harmoglyph/blob/main/src/engine/vectorPlotter.ts) | [deriveGeometry in composition.ts](https://github.com/Devpen787/Harmoglyph/blob/refs/pull/3/head/src/engine/composition.ts), [SVG composition renderer](https://github.com/Devpen787/Harmoglyph/blob/refs/pull/3/head/src/components/CompositionJourneyView.tsx) | MAIN has several mathematical foundations and vector geometries. PR3 has fixed mappings onset→angle, duration→sweep, MIDI→radius, velocity→width; no generalized editable rule graph. |
| Live 3D | [HarmonicThreeStage.tsx](https://github.com/Devpen787/Harmoglyph/blob/main/src/components/HarmonicThreeStage.tsx) | PR3 projects compatible monophonic compositions to the existing sheet stage | There is already animated Three.js geometry and WebGL fallback detection. A new score-derived persistent coupled motion solver is not established. |
| Tests | [pbtSuite.ts](https://github.com/Devpen787/Harmoglyph/blob/main/src/engine/pbtSuite.ts) | [composition.test.ts](https://github.com/Devpen787/Harmoglyph/blob/refs/pull/3/head/src/engine/composition.test.ts) | Existing five seeded invariant groups, plus draft composition tests. Presence inspected; this review did **not** execute them or verify 500 trial results. |
| Preservation | Existing WAV/CSV/vector exports in audioSynth/vectorPlotter/spreadsheetVm | Score JSON, browser-local drafts, SVG composition export | Asset bundle (score+mapping+physics+render+seed), replay/export invariants and full-show video are future review items. |
| Kiro | [.kiro spec](https://github.com/Devpen787/Harmoglyph/blob/main/.kiro/specs/harmoglyph/requirements.md), [current hook file](https://github.com/Devpen787/Harmoglyph/blob/main/.kiro/hooks/pbt-on-formula-save.json) | Two updated hooks in PR3 | Inspected hook structure uses version 1.0.0/event/filePattern/command; [current documented format](https://kiro.dev/docs/hooks/) uses version v1, hooks[], trigger/matcher/action. Real trigger must be tested. |
| Licensing/submission | [MIT LICENSE](https://github.com/Devpen787/Harmoglyph/blob/main/LICENSE), [README](https://github.com/Devpen787/Harmoglyph/blob/main/README.md) | PR3 has draft handoff doc | Root license present and repository public. Deployment, dependencies/asset rights, Kiro execution, video, provenance and judge accessibility remain unchecked. |
| Versions outside GitHub | Google AI Studio app and earlier private experience/art-direction Labs | Unknown parity | **Not inspected in this review**. Do not infer that deployed Google AI Studio or the private comparison site equals MAIN or PR3. |

## 3. Review checklist — prioritized and evidence-driven

**Instructions:** The boxes below are intentionally UNCHECKED. A status of [MAIN], [PR3], or [PARTIAL] says source exists, **not** that acceptance checks passed. Keep this single checklist in PR #1 and add evidence links/checkpoint results beside boxes only when actually executed. Priority P0 = required to trust/release the current composition demo; P1 = next meaningful capability; P2 = broader vision, preserve but do not prematurely implement. Every item has a verification target.

### A. Snapshot, parity, preservation (R12§5, R13 “Reviewed Claims”, “Plan”)

- [ ] **A01 | P0 | [MAIN + PR3]** Pin exact base and draft commit SHAs, note GitHub PR status, and document the build target. **Close with:** SHA, branch, dated clean-checkout log.
- [ ] **A02 | P0 | [NOT VERIFIED]** Compare the actual Google AI Studio project/deployment to main and draft PR3; list divergence before syncing. **Close with:** read-only screenshots/commit or exported source comparison; no implicit merge.
- [ ] **A03 | P0 | [MAIN + PR3]** Run clean build, typecheck, existing PBT and PR3 composition tests. **Close with:** command, machine/runtime version, log, exit status, reproducible seed/count.
- [ ] **A04 | P0 | [PR3]** Review whether PR3 integrates without regressing original spreadsheet, FM voices, SVG/PNG/CSV/WAV, inverse geometry and 3D stage. **Close with:** old/new golden journey and explicit negative controls.
- [ ] **A05 | P1 | [UNKNOWN]** Confirm where the authoritative source for score and style edits lives across main, PR3, private labs and Google AI Studio. **Close with:** version/parity table and one documented merge strategy; no unsanctioned overwrites.

### B. Musical intelligence / score semantics (R12§1, R13 “Music Representation”, “Data Contracts”)

- [ ] **B01 | P0 | [PR3]** Retain the canonical MusicalComposition note IDs/tracks/onsets/durations/velocity/meter and verify all five score fixtures. **Close with:** note-count, voice-count, temporal integrity tests.
- [ ] **B02 | P0 | [PARTIAL]** Define the lossless boundary between MIDI-number notes in beats and A1:F48 frequency/gate/FM steps. **Close with:** no silent loss; unsupported polyphony/duration rejected or explicitly approximated.
- [ ] **B03 | P0 | [PR3]** Test overlapping notes, rests, chord onset, silence and multiple simultaneous voice/timbre handling. **Close with:** inspectable events, audible samples, correct negative cases.
- [ ] **B04 | P0 | [PR3]** Distinguish note *start*, duration, synth envelope and audible sustain. **Close with:** measured waveforms for short/long note pairs and documentation of approximations.
- [ ] **B05 | P1 | [PARTIAL]** Review intervals, pitch class, ratio to reference, interval consonance labels and how they are chosen. **Close with:** correct 12-TET calculation, explicit just-intonation comparisons, no false universal consonance claims.
- [ ] **B06 | P1 | [NOT VERIFIED]** Add only musically defensible features for rhythmic pattern, motifs, chords, phrase boundaries and repetition. **Close with:** feature test fixtures, algorithm and confidence/ambiguity policy; bars not automatically phrases.
- [ ] **B07 | P1 | [NOT VERIFIED]** Decide whether multi-track authoring must support independent form/motion/bond mapping per voice. **Close with:** two-track demonstrator showing distinctive and combined effects.
- [ ] **B08 | P2 | [RESEARCH]** Assess MIDI, MusicXML, image/PDF/ABC import, live performance and mic audio as separate input adapters. **Close with:** supported-format matrix; do not promise accurate transcription without tests.
- [ ] **B09 | P2 | [RESEARCH]** Keep audio/MIR features (spectral centroid, chroma, onset strength, timbre) separate from symbolic pitch and event analysis. **Close with:** explicit adapter/specification when a real-audio input case is justified.

### C. Mathematical mapping and explainability (R12§2,§5,§6; R13 “Visual Mapping”, “Schemas”)

- [ ] **C01 | P0 | [PR3]** Verify current fixed note→mark rules (onset→angle, duration→arc, pitch→radius, velocity→width) and hit-test provenance for each note. **Close with:** expected values and note highlight matching the displayed geometry.
- [ ] **C02 | P0 | [MAIN]** Inspect existing math foundation modes (sine/Fibonacci/golden angle/Pythagorean) for accurate mathematical terminology and finite clamped outputs. **Close with:** reference cases and no invented physics/cymatics claims.
- [ ] **C03 | P0 | [NOT VERIFIED]** Define mathematical vs conventional vs artistic mappings in the inspector (“this value is computed” versus “we chose this visual rule”). **Close with:** a reviewer can explain two visible movements in plain language.
- [ ] **C04 | P1 | [PROPOSED]** Define typed, versioned MappingRule with source feature, operator, target, units, bounds and provenance; no executable arbitrary JS source. **Close with:** schema validation, migration, invalid-rule refusal test.
- [ ] **C05 | P1 | [PROPOSED]** Separate **relationship rule** (why it moves) from **motion law** (how) and **visual material** (what it looks like). **Close with:** change just one dimension and verify all unaffected dimensions remain unchanged.
- [ ] **C06 | P1 | [PARTIAL]** Test Lissajous/harmonograph as explicit *ratios between controlled visual oscillators*, not “one audible note always gives one unique universal shape.” **Close with:** correct angular units, closure cases and phase/damping explanation.
- [ ] **C07 | P2 | [MAIN + RESEARCH]** Evaluate golden-angle/spiral, Fourier/epicycle and fractal methods as selectable aesthetic/mathematical grammars, not as physical facts about music. **Close with:** comparative art/meaning study.
- [ ] **C08 | P1 | [NOT VERIFIED]** Preserve source-note/rule metadata through layered composites and exports. **Close with:** select a point or filament and identify the causal note(s), interval(s), mapping version and motion mode.

### D. Continuous motion / mathematical dynamics (R12§3,§6; R13 “Motion Grammars”, “Simulation vs Rendering”)

- [ ] **D01 | P0 | [PARTIAL]** Inventory current 3D animation, SVG composition progression and any existing stateful motion, with profile screenshots. **Close with:** explicit classification of animation, step reveal, dynamics and static art.
- [ ] **D02 | P0 | [PROPOSED]** Prototype *phrase-aware melodic spline/ribbon* from actual pitch intervals, onset gaps and note lengths. **Close with:** smooth bounded geometry, note-segment provenance and visibly different contrasting scores.
- [ ] **D03 | P1 | [PROPOSED]** Prototype *coupled spring/resonance field* with music-derived rest targets and authored interval/voice bonds. **Close with:** stable finite trajectories and inspectable source connections under chords and rests.
- [ ] **D04 | P1 | [PROPOSED]** Use a defined integrator (semi-implicit/analytic/Verlet), fixed dt, bounded parameter ranges and damping tests. **Close with:** finite checkpoints on long/stress runs and deterministic input ordering.
- [ ] **D05 | P1 | [PROPOSED]** Compare Lissajous interval grammar with existing harmonograph baseline (not automatically one oscillator per note). **Close with:** correct 2:1/3:2 tests and a human-readable example.
- [ ] **D06 | P1 | [NOT VERIFIED]** Define layer composition and how multiple phrases/tracks share or influence motion without tangled geometry. **Close with:** one note→phrase→two-track scene, with meaningful hierarchy and graceful convergence.
- [ ] **D07 | P1 | [NOT VERIFIED]** Define seek, replay, pause/resume, restart and end-of-song freeze under continuous motion. **Close with:** same checkpoint from sequential play versus deterministic seek/replay.
- [ ] **D08 | P2 | [RESEARCH]** Maintain a comparison backlog for boids, Kuramoto/coupled phases, curl-noise/flow fields, 2D fluids, Gray–Scott reaction diffusion, chaos/attractors and 3D surfaces. **Close with:** each candidate's specific musical cause, stability/performance limit, license and why it beats simpler grammar.
- [ ] **D09 | P0 | [NOT VERIFIED]** Define what persists into the **final artwork** versus what is temporary live animation. **Close with:** deterministic terminal image/trace that still embodies notes and phrases after sound stops.

### E. Audio scheduling / audiovisual time and smoothness (R12§5,§7; R13 “Synchronization”, “Risk-First Experiments”)

- [ ] **E01 | P0 | [MAIN]** Instrument existing setInterval step scheduler: measure nominal and actual note starts, jitter, first-play unlock and background-tab behavior. **Close with:** recorded baseline distribution, not guessed latency.
- [ ] **E02 | P0 | [PR3]** Instrument performance.now/rAF composer clock and current-time audio note triggers. **Close with:** exact note schedule versus actual playhead and screen update on short/rapid notes.
- [ ] **E03 | P0 | [PROPOSED]** Compare native Web Audio look-ahead scheduling to current implementation before choosing a new Tone.js dependency. **Close with:** jitter/drift and development-cost comparison; architecture decision recorded.
- [ ] **E04 | P0 | [PROPOSED]** Define one musical timeline origin, beat→audio seconds conversion and visual prediction/latency compensation; use audioContext output timestamps where available. **Close with:** consistent event IDs/timebase under play, pause, resume and seek.
- [ ] **E05 | P0 | [PROPOSED]** Separate authoritative audio scheduling, fixed-step simulation ticks, and variable-rate rAF rendering interpolation. **Close with:** no simulation jump when frames are missed; defined catch-up/cap policy.
- [ ] **E06 | P0 | [NOT VERIFIED]** Measure motion continuity separately from synchronized note starts: frame-time percentiles, discontinuities, curvature and perceptual smoothness. **Close with:** actual desktop and mobile/low-power measurement; reduced-motion alternative.
- [ ] **E07 | P1 | [NOT VERIFIED]** Test pauses, tab switching, audio suspension, device output latency and reopening/reloading saved compositions. **Close with:** reliable state recovery and no accumulated timing drift.
- [ ] **E08 | P1 | [NOT VERIFIED]** Define a realistic sync budget and instrument it. Reject the report's universal under-5ms claim; 60 Hz screens show at ~16.7ms intervals. **Close with:** documented audible/visible onset comparison and tolerances validated by observation.

### F. Rendering, materials, export and preservation (R12§4,§5; R13 “Rendering”, “Export”, “Performance”)

- [ ] **F01 | P0 | [MAIN + PR3]** Verify 2D SVG/vector pipeline and 3D stage both still render with actual composed inputs; compare finished artwork and live animation. **Close with:** screenshots/video and source note traceability.
- [ ] **F02 | P1 | [PROPOSED]** Make one motion state render as ink, ribbon, particles or filament without changing audio/motion state. **Close with:** same checkpoints/audio, clearly different output materials and valid performance budget.
- [ ] **F03 | P0 | [PARTIAL]** Independently inspect main WAV/CSV/SVG/PNG and PR3 JSON/SVG exports by round-tripping/decoding. **Close with:** file existence, valid contents, expected note counts, dimensions and reimport/replay.
- [ ] **F04 | P1 | [PROPOSED]** Preserve a portable composition package (score, tracks, mappings, motion, appearance, seed, version, timeline). **Close with:** load it on a new browser session and reconstruct equivalent simulated checkpoints.
- [ ] **F05 | P2 | [RESEARCH]** Decide whether synchronized short video is a launch requirement or an explicit later export; do not claim MP4 from an untested captureStream path. **Close with:** justified video codec/mux test or clearly marked out-of-scope.
- [ ] **F06 | P1 | [NOT VERIFIED]** Profile Canvas2D/SVG versus existing Three.js/WebGL for actual scene complexity, not a theoretical 10k–100k particle promise. **Close with:** hardware, pixel density, 50/500/1000 elements, p50/p95 frame time, fallback.
- [ ] **F07 | P1 | [NOT VERIFIED]** Test renderer safety/perceptual quality: clamping/NaN handling, resize, GPU context loss, overdraw, aliasing, reduced motion, contrast and high-DPI export. **Close with:** repeatable QA recordings on target devices.

### G. User experience / artistic quality (R12§9; R13 “UX Journeys” and “ETH-Winner Audit”)

- [ ] **G01 | P0 | [PR3]** Test complete novice journey: first note → modify pitch/duration → add phrase → hear result → finished artwork → save. **Close with:** completed user run without opening spreadsheet.
- [ ] **G02 | P0 | [PR3]** Test advanced journey without losing beginner clarity: multiple tracks, score edit, inspecting a note, spreadsheet/3D handoff with deliberate unsupported-case explanation. **Close with:** no silent data loss or trap screens.
- [ ] **G03 | P1 | [PROPOSED]** Introduce **mix form × motion × relationship** controls progressively (preset first, advanced customization later). **Close with:** users can make meaningful changes without learning formulas.
- [ ] **G04 | P1 | [PARTIAL]** Test “why is this moving?” with both single notes and relationships between multiple notes/voices. **Close with:** understandable inspector proves actual source ID/algorithm, not a decorative label.
- [ ] **G05 | P0 | [PROPOSED]** Run the same grammar with Glass Garden, Ascending Light, Pulse Study, Leap Dialogue, and the single-note control; include silence. **Close with:** visibly/quantitatively distinguishable score behavior and predictable negative controls.
- [ ] **G06 | P1 | [RESEARCH]** Compare art direction with Ribbon, Bloom and Constellation study—but identify **which renderer** each experiment used. **Close with:** avoid equating standalone labs with PR3 art; no arbitrary petal-per-bar logic.
- [ ] **G07 | P1 | [NOT VERIFIED]** Small moderated visual evaluation: ask 3–5 people whether they'd save/print the finished image, what they think is music-driven, and what looks chaotic or choppy. **Close with:** raw observations and design decisions; unit tests alone cannot establish beauty.
- [ ] **G08 | P1 | [NOT VERIFIED]** Accessibility and mobile: readable legend, keyboard hit targets, color independence, reduced motion, audible preview alternatives, meaningful presets and responsive layout. **Close with:** browser/mobile visual checks and recorded accessibility issues.
- [ ] **G09 | P2 | [RESEARCH]** Evaluate reverse drawing→score as a separate instrument experience; main reverse geometry formula helper does not prove full polyphonic musical inversion. **Close with:** explicit supported input class and loss/ambiguity policy.

### H. Scientific, prior-art and licensing claims (R12§2,§3,§8; R13 “Reviewed Claims”, “Licensing”)

- [ ] **H01 | P0 | [RESEARCH]** Create resolvable citations for each major algorithm/reference in R12/R13. Many bracket references ([13], [28], [31], etc.) have no complete in-report bibliography. **Close with:** paper/official repo URL, version/date, what exactly it supports.
- [ ] **H02 | P1 | [RESEARCH]** Verify source names, available code, current maintenance and license for Chromat, Resonance, Hydra, Chroma Flow, fluid-particles, Gray-Scott and any intended borrowing. **Close with:** reusable pattern versus non-reusable code explicitly recorded.
- [ ] **H03 | P1 | [RESEARCH]** Compare credible competing products (TouchDesigner, Max/Jitter, Resolume, Notch, Magic Music Visuals and music-to-art tools) by exact capability: score semantics, mapping graph, persistent art, live visual controls, export, causal inspection. **Close with:** evidence matrix, NOT unsupported “none exist” claim.
- [ ] **H04 | P0 | [RESEARCH]** Audit artistic claims: Lissajous frequency ratio and phase assumptions, golden angle as a layout rule, spectral centroid as timbral feature, Chladni/cymatics naming and sound→image causation. **Close with:** labels distinguish computed facts, conventions, metaphor and measured physical effects.
- [ ] **H05 | P1 | [RESEARCH]** Confirm library versions/licenses in actual dependency tree and original assets/music copyright; do not assume a shared MIT license. **Close with:** exact dependency audit and attribution/permission records.

### I. Kiroween compliance and demonstrated proof (R12§10; R13 “Kiro and PR Structure”, “ETH-Winner Audit”; EXT)

- [ ] **I01 | P0 | [MAIN]** Verify Frankenstein category, **new-project eligibility during Oct 30–Dec 4, 2026 submission window**, repository history, and treatment/disclosure of preexisting code. **Close with:** provenance timeline and rules interpretation based on actual commits.
- [ ] **I02 | P0 | [MAIN + PR3]** Confirm root .kiro and tracked specs/steering/hooks; match current Kiro hook JSON format (v1/hooks/trigger/matcher/action), rather than assuming legacy hook commands execute. **Close with:** real Kiro hook triggered and captured output.
- [ ] **I03 | P0 | [NOT VERIFIED]** Produce actual Kiro IDE/CLI development logs for meaningful implemented tasks; .kiro config or a report saying Kiro was used is insufficient. **Close with:** task/spec/run evidence tied to commit IDs.
- [ ] **I04 | P0 | [PARTIAL]** Run 5 × 100 seeded PBT groups, composition tests, typecheck/build and at least one intentionally failing negative mapping/clock case. **Close with:** independent repeatable logs and truthful scope (“tested invariants” not “formal proof”).
- [ ] **I05 | P0 | [PARTIAL]** Confirm public MIT license visible, valid code/assets, build instructions, and accessible working demo with judge instructions through end of judging. **Close with:** separate-browser smoke and reproducible install.
- [ ] **I06 | P0 | [NOT VERIFIED]** Record public YouTube demo **under three minutes** showing a real end-to-end musical edit → motion → art → explanation → export, with allowed original/licensed audio. **Close with:** video URL, timing, actual footage matching product.
- [ ] **I07 | P0 | [NOT VERIFIED]** Complete Devpost fields, category, Kiro usage write-up and relevant disclosures; verify five equal-weight judged dimensions (impact, implementation, design, innovation, presentation). **Close with:** verified submission preview, category and evidence links.
- [ ] **I08 | P0 | [NOT VERIFIED]** Reconfirm competition dates/time zones before submission. Official rules: **Dec 4, 2026 at 2:00pm PT / 23:00 Zurich** (22:00 UTC). **Close with:** dated rules capture and final deadline checklist.
- [ ] **I09 | P1 | [NOT VERIFIED]** Separate optional bonuses and public communications from mandatory submission; don't invent a crew deployment, hook run or credit balance. **Close with:** only checked eligible bonuses backed by evidence.

## 4. Experiments and score controls (avoid false scientific promises)

**Fixture set already introduced in PR3**: First Mark (one note); Glass Garden (phrase-shaped melodic song); Ascending Light (ordered pitch climb); Pulse Study (repetition); Leap Dialogue (two-voice overlap). Add explicit silence/rest and an unsafe mapping. Record independent snapshots plus user observations.

| Experiment | Input/control | What must change | What must remain invariant | Evidence |
| --- | --- | --- | --- | --- |
| X1 — Single note / interval math | First Mark, then a fixed 2:1/3:2 pair | Ratio-derived parametric geometry at known visual frequencies | Pitch conversion and note IDs | Formula samples/curve closure on *visual* time axis; listening separate |
| X2 — Score discrimination | Glass Garden vs Ascending Light vs Pulse Study | Paths, timing, repetitions, phrase evolution | Same mapping/version/style/seed | State metrics + side-by-side art inspection |
| X3 — Simultaneous relationships | Leap Dialogue vs two separately played voice lines | Coupled motion when both voices overlap | Both notes remain represented; no unauthorized notes | Source IDs + bounded simulation + listening |
| X4 — Style separation | Same score and motion under ink / ribbons / particles | Appearance materially differs | Sound, mapping and raw motion state identical | Checkpoint diff + screenshots/export |
| X5 — Timing and pause | Rapid onsets, held notes, pause/resume/tab sleep | Playhead, starts and visual cues align under declared tolerance | Ordered events, no duplicated note starts | Audio clock logs, frame timing, browser captures |
| X6 — Negative controls | Rest, repeated tone, invalid units, NaN/unsafe scale, no damping as a valid case | No silent unsafe behavior; reject invalid rule | Last valid composition persists | Deterministic failure/refusal logs |
| X7 — Artwork persistence | Composition to end, seek, replay, re-import | Static composition can be reproduced; live trail semantics documented | Config/seed/version and source provenance | Save+reopen reproduction and export verification |

**False criteria explicitly excluded:** byte-for-byte audiovisual identity across all hardware, pixel-perfect GPU output across devices, sound causally *exerting magnetic force*, linearity of coupled motion, zero background movement during silence, <5ms universal screen sync, “beautiful” from unit tests, or guaranteed tempo-shape invariance absent an explicit beat-domain definition.

## 5. Proposed review order — no approval implied

| Gate | What to review | Outcome to record | Why first |
| --- | --- | --- | --- |
| G0 — Source reconciliation | A01–A05, B01–B04, I01 | Approved baseline and eligibility risk register | Prevent duplicate or ineligible implementation |
| G1 — Audio and truthfulness | E01–E05, C01–C03, I02–I04 | Timing comparison, accurate causal mapping, Kiro evidence | Clock is a dependency of everything that moves |
| G2 — First two meaningful flows | C04–C06, D02–D05, D09, G05, X1–X6 | Controlled ribbon/spring comparison with real songs | Determine meaning *before* choosing beautiful materials |
| G3 — Creative expression and journey | D06–D08, F01–F07, G01–G08, X7 | Remixed and exportable artistic result, tested by people | Validate what a creator would actually use |
| G4 — Submission | H01–H05, I05–I09 | Judge-ready evidence and truthful product claims | Fit the actual competition, not a self-reported ready badge |

**Not a mandate to shrink the vision:** keep flow fields, particle/fluid materials, 3D work, symbolic/microphone/MIDI inputs and advanced mapping as future choices. Gate G2 only identifies what should be prototyped *first* to test the governing idea: **a piece of music generates an evolving, coherent, traceable artwork whose movement and appearance the creator can remix.**

## 6. Decision log — current disposition

| Decision | Status | Rationale / trigger |
| --- | --- | --- |
| Use PR3's score model rather than creating a new one | **PROPOSED** | Code is already present and testable; review parity first |
| Establish one scheduled audio/playhead timebase | **PROPOSED** | Both current playback implementations carry timing risk |
| Compare phrase-aware ribbon with bounded coupled spring | **PROPOSED** | Test expressive interpretation and smooth interactive motion |
| Keep Lissajous, golden angle, Fourier, 3D and other families as alternative grammars | **PRESERVE / EVALUATE** | Not forced as universal music structure |
| Separate relationship, behavior and appearance | **PROPOSED ARCHITECTURE** | User requested independent mixing of flows, artistic form and rule behavior |
| Make every output traceable to source notes/rules | **PROPOSED CONTRACT** | Required for meaning and inspectability |
| Adopt Tone.js as new dependency | **NOT DECIDED** | Benchmark native scheduler first |
| Implement fluid/boids/Kuramoto immediately | **DEFERRED CANDIDATE** | Higher complexity and weak direct semantic proof for first milestone |
| Add live-audio MIR / draw-to-polyphonic-score / full video renderer | **PARKED, NOT REJECTED** | Valuable possible extensions, unproven MVP requirement |
| Merge PR3 / publish a revised app | **NOT AUTHORIZED HERE** | Needs isolated review of regression and actual user experience |
| Kiroween readiness / performance / reproducibility claims | **UNVERIFIED** | Requires logs, recordings, public testing and valid hook execution |

## 7. What has and has not been done in this review

- **Done:** Read both complete uploaded reports; archive originals unchanged on the documentation branch; inspect relevant current GitHub MAIN files and draft PR3 files; compare their contents with both reports; cross-check official Kiro hook syntax and Kiroween requirements; construct an explicit checklist and experiment/control matrix.
- **Not done:** Run npm tests locally; deploy or open Google AI Studio live app; measure actual audio/screen latency; visually/aurally validate PR3; run Kiro IDE/CLI; inspect upstream library source/licensing in depth; conduct user tests; merge PRs; make application-code changes.
- **Handling results:** When a review gate is run, append evidence (SHA, timestamp, device/browser, command/artifact, observation, pass/fail, limitations) to the relevant checkbox. Never mark “pass” from a report assertion, a code comment or a screenshot alone.

## Source links

- [Deep Research report #12 verbatim](./sources/deep-research-report-12-original.md)
- [Deep Research report #13 verbatim](./sources/deep-research-report-13-original.md)
- [Earlier critical review of #13](../RESEARCH_13_REVIEW_ADR_PROPOSAL.md)
- [Foundation map in draft PR #1](../FOUNDATION_MAP_KIROWEEN.md)
- [Song/Art slice handoff in draft PR #3](https://github.com/Devpen787/Harmoglyph/blob/refs/pull/3/head/docs/SONG_ART_COMPOSITION_SLICE.md)
- [Official Kiro Hook documentation](https://kiro.dev/docs/hooks/)
- [Official Kiroween rules](https://kiroween.devpost.com/rules)

_This artifact is an organized review queue against the existing project, not a new management system or an instruction to replace the approved product direction._
