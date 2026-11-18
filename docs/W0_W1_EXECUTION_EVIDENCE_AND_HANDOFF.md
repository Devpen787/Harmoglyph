# Harmoglyph — W0 baseline + W1 clock spike: evidence and Kiro handoff

**As of:** 18 November 2026. **Status:** W0 partially proven; W1 code spike
passes static/unit checks but browser and Kiro execution gates remain OPEN.
The owning roadmap/checklist remains under documentation draft PR #1.

## Provenance / scope
- GitHub main baseline: `c6b55866342147a4de0eff01551b6a26ad6cf317`
  (initial repository commit dated Nov 17 2026, 11:55:41 UTC; this is not
  proof of initial AI Studio source creation date).
- Draft PR #3 Compose & Art starting SHA:
  `ddd3d2c004fac60f0b3b6744e8cf051c510fa1ff`, open/draft.
- This branch: `work/w0-w1-harmoglyph-clock-review-2026-11-18`,
  [draft PR #4](https://github.com/Devpen787/Harmoglyph/pull/4),
  targeting PR #3, **not main**.
- Google AI Studio connected browser tab:
  currently titled `ChimeraForge` (private app URL deliberately not recorded here). Read-only tab text showed **"Changes
  from Google AI Studio are available to push to GitHub"**.
  AI Studio source, full history and unpushed diff were not exposed by this
  read-only browser tool. **Parity and project-origin dates remain unresolved.**
- Kiroween 2026: [Official current rules](https://kiroween.devpost.com/rules)
  say new projects created during Oct 30–Dec 4 2026; first repository
  commit date alone is insufficient to prove all source was newly created.
  Do not invoke 2025 rules permitting "significantly updated" projects.

## Independent GitHub Actions checks (real executed evidence)

| SHA | Run | Verified |
| --- | --- | --- |
| `4869454f7dcd02f753f951ee39ef08c54a31ca47` | [Baseline GitHub Actions](https://github.com/Devpen787/Harmoglyph/actions/runs/44283793122) | npm install, typecheck, composition tests, 5×100 seeded PBT, build — PASS |
| `c58221879579a4872991e0f0886419cff285239f` | [Timeline tests](https://github.com/Devpen787/Harmoglyph/actions/runs/44284420895) | Added W1 tests plus baseline checks — PASS |
| `751371dde2c09e791ca3946e9f70e49969bff065` | [Composer scheduling patch](https://github.com/Devpen787/Harmoglyph/actions/runs/44284939864) | TS, composition, timeline, PBT, build — PASS |
| `adc8c3fcd02e0048420cd2a3bd95ca627569a703` | [Kiro hook migration](https://github.com/Devpen787/Harmoglyph/actions/runs/44285090071) | CI passed; **not a Kiro runtime execution** |

These runs demonstrate executable source checks only. They do NOT verify
hardware output timing, perceived smoothness, Kiro compliance, exported files,
browser permission/unlocking or the deployed AI Studio version.

## What changed in draft PR #4

1. Added a deterministic `planCompositionTimeline()` and bounded
   `CompositionLookaheadCursor`, preserving note ID, track and onset/beat units.
2. Added seven Node tests for the five fixture scores, tempo conversion,
   simultaneous voices, repeated look-ahead polling, seeking, visual clock
   derivation and invalid timing.
3. Extended the existing FM Web Audio engine with `preparePlayback()`,
   `scheduleStepAt()`, `getAudioClockTime()`, `stopScheduledNotes()`;
   the old instantaneous `triggerStep()` API remains available.
4. Changed *only the draft composer* to queue notes ahead in AudioContext time
   and compute its playhead from that same clock. The original sheet player's
   `setInterval` remains an open separate area of W1.
5. Updated one .kiro hook to the documented `version: v1` schema.
   Static format and actual Kiro trigger are distinct gates.

## Actual open gates, not automatically passed

- [ ] A02 / I01: Verify the actual AI Studio source timestamps, unpushed
  modifications and pre-Oct 30 provenance. Confirm eligibility.
- [ ] A04: Review PR #3+4 in a running browser, including sound, 2D/3D,
  original formula engine and export regression paths.
- [ ] E01/E02/E03: Measure scheduling errors with real Chrome/Firefox audio
  and display timing for fast notes, holds, chords, background tabs and resumed
  sessions. Same audio clock is a design improvement, NOT measured victory.
- [ ] B04: Long score note duration versus current capped FM decay.
- [ ] I02/I03: A real Kiro CLI/IDE session and hook-trigger log tied to
  a meaningful Kiro-authored task/commit. Kiro is not installed in this
  assistant runtime, so this work CANNOT be marked complete here.
- [ ] I05: Verify actual submitted public app and judge replay path.

## Single handoff instruction for Kiro (no handoff upload needed)

Open `Devpen787/Harmoglyph`, check out branch
`work/w0-w1-harmoglyph-clock-review-2026-11-18`. Read
`.kiro/specs/harmoglyph-clock/{requirements,design,tasks}.md` and
`docs/W0_W1_EXECUTION_EVIDENCE_AND_HANDOFF.md`. Independently inspect
the current audio-clock implementation and its tests. Find and implement
one real improvement or missing test through Kiro (priority: late audio
lookahead, pause/seek/cancel, browser unlock); run the complete tests and
actually trigger the migrated Kiro hook. Attach Kiro session evidence and
a code revision to draft PR #4. Do not merge or deploy; explicitly label
anything you could not independently verify.

## Next owner update

When Kiro and browser checks are completed, append evidence links next to the
relevant IDs in the **existing** 69-check review list and W0–W5 roadmap.
Do not create a new recurring task or a parallel project management system.
