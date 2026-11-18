# Harmoglyph — Research Report 13: Critical Review & ADR Corrections (PROPOSAL)

> **Status: UNAPPROVED / review-only; no production implementation authorized.** This document reviews the user-provided `deep-research-report (13).md` against the Harmoglyph source and Kiroween rules on 18 November 2026. Do not treat the report's “approved/chosen/verified” wording as user approval or a successful runtime test.
>
> **Repository basis:** `Devpen787/Harmoglyph` main and **open draft PR #3** (`codex/unified-song-art-slice` / “Unify song, sound, artwork and math in Compose & Art”). This review belongs in draft PR #1 for product/architecture review, not in production main.

## Disposition

**Reuse the report as a list of architectural hypotheses and technical experiments; reject it as a verified implementation plan.** It accurately identifies the need to separate musical events, mappings, motion, rendering, and audio timing, but its source diligence is incomplete and several proposed invariants are false. It must not trigger a ground-up rewrite.

### Current project facts to preserve (source inspection, not independent execution)

- Main already contains `src/engine/spreadsheetVm.ts`, `audioSynth.ts`, `mathArtTheory.ts`, `vectorPlotter.ts`, `pbtSuite.ts`, and `HarmonicThreeStage.tsx`. The FM synthesizer uses native Web Audio; **Tone.js is not installed** in the reviewed manifests.
- Main `src/App.tsx` advances score steps with `window.setInterval`; `triggerStep()` schedules each note at the then-current `audioCtx.currentTime`. This is a concrete source of interval-driven jitter/latency and a sensible first scheduling experiment.
- **Draft PR #3 already adds** `MusicalComposition`, `CompositionNote`, `CompositionTrack`, event-to-geometry mapping, five test scores, note provenance, and `composition.test.ts`. Do not recreate these. Its doc states that the old A1:F48 projection is lossy for arbitrary duration/polyphony, and the present sound envelope approximates long notes. Preserve that honesty.
- Existing 5 seeded PBT groups × 100 trials are **tests implemented in source**, not an independently confirmed execution result; separate test source presence from executed evidence.
- Root `.kiro/` exists, but some hook files use a legacy-looking layout (`version: "1.0.0"`, `event`, `filePattern`, `command`) rather than the current documented `{"version":"v1","hooks":[{"trigger":"PostFileSave","matcher":"...","action":{"type":"command","command":"..."}}]}` format. Kiro running these hooks is **not yet demonstrated**.

## Proposed architecture — preserve breadth; implement one vertical slice

```text
Composition (already in PR #3) ──> normalized, beat-timed note and track events
         │
         ├──> Music features: interval, motif, simultaneous voices, dynamics
         │             │
         │             └──> Allowlisted mapping graph (units, bounds, provenance)
         │                           │
         │                           └──> Continuous motion state (fixed-step; pure seek)
         │                                     │
         │                                     └──> Form / material renderer (2D and 3D)
         │
         └──> Scheduled Web Audio synthesis (existing voices; clock-aware upgrade)
                                       └──> one score/playhead timing origin
```

Separate **music source** (what was composed) from **motion law** (how bodies interact) from **appearance** (ribbons/ink/points/filaments). The user's “galaxy” example meant graceful interacting complexity, **not a literal space art requirement**. A blank scene can still contain ambient motion; it must not invent *new score-driven* notes.

### Data-contract deltas to PR #3 (proposed)

- **Reuse** `CompositionNote { id, trackId, midi, startBeat, durationBeats, velocity }`, `CompositionTrack`, `MusicalComposition`; introduce typed feature and mapping records only after review.
- Keep **beats** canonical in the composition, convert to seconds with a versioned tempo map in the audio/animation scheduler. Avoid report's ambiguous `pitch: number` (MIDI *or* Hz) and `time: number` (beats *or* seconds).
- Every mapping: `ruleId, sourceFeature, targetParameter, operator, scale, offset, input/outputUnits, safeRange, seed/version`. Do **not** execute arbitrary strings such as `transform: "v => v*10"` as JS; that is an unbounded/untrusted code surface.
- Every rendered contribution: `noteId[]`, `ruleId[]`, `grammarId`, snapshot time. Make “Why is this moving?” traceable without putting debug visuals in the default creative view.
- Create a replayable `Composition + Mappings + MotionConfig + StyleConfig + fixedSeed + version` artifact. Compare deterministic **simulation checkpoints**, not byte-for-byte Web Audio across devices.

## Specific errors in report #13 — replace before Kiro implementation

| Report assertion/test | Corrected contract |
| --- | --- |
| “Sample-accurate visual timing” or <5 ms browser A/V sync guarantee | Audio events may be sample-scheduled; screens update on refresh intervals (~16.7 ms at 60 Hz) and output devices add latency. Use `AudioContext.getOutputTimestamp()` where supported; measure frame timing and external perceptual sync separately. Do not infer physical output from `ended` or a JS callback. |
| Fixed dt alone guarantees bitwise-identical audio-visual output | Fixed dt + same ordered events/seed/numeric operations can make simulator states reproducible under specified conditions; browser GPU rasterization, audio hardware and JS scheduling can still vary. |
| Harmonic oscillator with 1 Hz/2 Hz analogies means audible 1 Hz/2 Hz notes | Keep **audible pitch in Hz** and **visual oscillator frequency in cycles/s** distinct; map ratio/interval to shape, not 440 Hz directly to hundreds of visible strokes per second. Use angular frequencies in radians/s: `2πf`. |
| “k>0,c>0 springs won't blow up” | Physical damping does not ensure numerically stable explicit integration. Specify integrator (semi-implicit Euler or analytic damped spring), dt, stability bounds, max speeds/energy, finite-value handling. |
| Same score, different *mapping* preserves shape | Changing a mapping should change geometry. Only changing **rendering style alone** should preserve the underlying simulated positions. |
| Silence always means no movement | Silence means no new note-driven impulses; existing motion can decay/persist. The selected style may also have intentional idle animation, clearly labeled. |
| Repeated notes must overlap; tempo changes preserve trajectories | Repetition can produce different **time locations**. Tempo invariance applies only to deliberate beat-normalized mappings; seconds-based decay varies with tempo. |
| Polyphonic visual must be linear; chord waveform equals two **sequential** runs | Coupled dynamics are intentionally nonlinear; test simultaneous event preservation and finite bounded state instead. A linear, time-aligned audio mix can be checked when using linear routing and fixed gain, not by comparing to a sequential composition. |
| Zero damping automatically represents a fault | Zero damping is a valid sustained oscillator. Negative duration, invalid pitch, unsafe mapping scale, nonfinite/unstable motion, missing source event, or wrong clock mapping make better refusal tests. |
| “We verified the existing implementation by reading Devpost” | Devpost is a self-reported product description. Source inspection confirms functions/classes exist; runtime, correctness, real Kiro use and deployment require independent evidence. |
| Start anew with Tone.js, score model and test suite | PR #3 already supplies score model/tests and main supplies native audio. First profile the real scheduler, then justify a Tone.js adoption (or native Web Audio schedule-ahead refactor) with a small comparison. |

The report's **“self-contained web components”** scope restriction appears unrelated to this score-driven musical product (likely left over from the Verified Grafts proposal). Do not propagate that wording into requirements.

## Two meaningful first motion grammars — candidate experiments, not final style

1. **Phrase-aware melodic ribbon**: use exact beat onsets, interval contours, note duration and track identity to produce a continuous centerline with bounded spline curvature. One phrase adds a persistent trace; new notes grow it. Render the same trace as ink, thread or illuminated ribbon. An inspector can show notes and interval contributions. Use smoothing that does not silently erase phrase identity.
2. **Coupled spring / resonance field**: maintain a set of points with rest targets derived from note pitch/onset and bounded spring-like links derived from simultaneous notes or chosen harmonic relationships. Damping smooths changes, while user-selectable style draws particles, woven threads, or a deforming surface. Treat “harmony causes attraction” as an authored mapping, not the physics of acoustic gravity.

**Optional comparison**: an analytical Lissajous/harmonograph *interval* mode, using a pair of controlled angular frequencies (not arbitrary per-note X–Y assignment). Defer boids, high-cost fluid simulation, and phyllotaxis-first requirements until the first two mappings can be made comprehensible and visually compelling.

## Minimum first evidence gate (Kiro-built vertical slice)

1. **Baseline:** Reconcile current Google AI Studio state, main, draft PR #1 and PR #3; pin a SHA; run `npm run lint`, `npm run test:composition` on PR #3, `npm run build`, and seeded PBT in a clean checkout. Save logs, environment and SHA; no success claim before logs exist.
2. **Timing spike:** Compare existing setInterval triggering against scheduled events with a single musical timeline; verify that rapid notes, sustained notes, two voices, pause/resume and note highlights remain correct. Measure event onset errors and frame distribution; avoid an unmeasurable <5 ms universal target.
3. **Motion semantics:** On *First Mark*, *Glass Garden*, *Ascending Light*, *Pulse Study*, and *Leap Dialogue* (PR #3 fixtures), compare Ribbon and Coupled motion. Include silence/rest and an intentionally unsafe mapping. Assert finite bounded state, stable IDs/provenance, tempo rules and predictable changes.
4. **Visual quality:** Review completed pieces with two substantially different melodies; note whether output looks like print-worthy art rather than decorative equalizers, and whether visitors can identify the music-to-art relationship. Mechanical tests cannot certify beauty; capture three to five real-user observations.
5. **Golden journey:** Choose / edit one note → hear and see immediate effect → add a phrase or second voice → mix motion/form → inspect the causal mapping → export one valid artifact. Preserve novice simplicity while supporting expert depth.
6. **Kiro compliance:** Use Kiro IDE/CLI *actually* to execute spec-driven timing/motion work. Migrate one hook to current v1 format, trigger it inside Kiro, capture output/failure, and record which feature used Kiro. `.kiro` files alone are not evidence of implementation.

### Candidate acceptance checks

- Same scored timeline + stable mapping/config/seed produces matching *simulated state checkpoints* and event-to-object IDs across repeated runs.
- Changing **appearance only** does not change audio or raw motion trajectories; changing **motion law** does change trajectories but not audio/score.
- All note IDs in visual marks/objects refer to real score notes. No generated score events without a source (unless clearly flagged as creative embellishment).
- With an invalid mapping, the validator refuses the new mapping and keeps the last valid artifact, recording an understandable reason.
- Running at targeted laptop dimensions maintains a profiled, acceptable frame-time distribution under supported particle count, with fallback and reduced-motion modes.
- A creator can finish and export one original score-derived artwork in a short moderated session without needing to open the spreadsheet unless desired.

## Competition contract and deadline

- **Kiroween Stage 1:** project must fit category and meaningfully use Kiro. Stage 2: Potential Impact, Technological Implementation, Design, Innovation and Presentation (20% each).
- **Mandatory submission:** public GitHub with license detectable and root `.kiro` tracked; working judge-accessible app; public YouTube demo under 3 min; truthful Kiro development write-up; correct Devpost fields and disclosures of non-framework pre-existing code. New project must be made during the submission window (Oct 30–Dec 4); verify provenance.
- **Kiro credits request:** Dec 1, 2026 12:00 PT (21:00 Zurich); **submission:** Dec 4, 2026 14:00 PT (23:00 Zurich).
- Do not declare 100% ready, “formal verification”, or an active Kiro Crew until proved with runtime evidence. Optional bonus submissions require separate proof.

Primary references:
- Existing foundation map: `docs/FOUNDATION_MAP_KIROWEEN.md` (draft PR #1)
- Actual composition implementation: draft PR #3, `src/engine/composition.ts`, `composition.test.ts`, `docs/SONG_ART_COMPOSITION_SLICE.md`
- Kiro hook format: https://kiro.dev/docs/hooks/
- Audio output timestamp API: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp
- Competition rules: https://kiroween.devpost.com/rules

**Recommended next implementation:** a single source/PR reconciliation plus clock/scheduler proof on a branch through real Kiro, then introduce motion and style-mixing as separate modules. Do not implement the entire report or merge this document as a final ADR without user review.
