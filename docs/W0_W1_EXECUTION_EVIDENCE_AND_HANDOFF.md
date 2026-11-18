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

## Kiro CLI W1 session — KIRO TASK 1 + 2

**Session ID:** sess_72b551af-5462-4abf-92f7-523bafc6ce06  
**Client:** Kiro CLI, macOS, Node.js v24.1.0  
**Branch:** `work/w0-w1-harmoglyph-clock-review-2026-11-18`  
**Code changes:** local only — `compositionTimeline.ts` and `compositionTimeline.test.ts`
uncommitted and unpushed pending independent CI. This documentation file only is
pushed so ChatGPT can read findings directly from GitHub.

### ChatGPT independent review findings (PR #4 comment, 18 Nov 2026)

Before describing Kiro's work, two corrections from ChatGPT's review are
recorded here verbatim, since they qualify what follows:

1. **Scope of the cursor fix:** the shipped composer's `play()` already
   constructs `new CompositionLookaheadCursor(planCompositionTimeline(...))` on
   every resume, and its scrub control calls `stop()` first. The missing
   `reset()` is therefore **API hardening and lifecycle-contract coverage**,
   not a fix to a currently exercised silent failure in the production path.
   Do not present it as an observed user-facing bug fix.

2. **Hook dispatch:** the manually run command is not evidence of an automatic
   `PostFileSave` trigger. The Kiro docs say CLI V3 supports event-driven
   PostFileSave hooks; inspecting active hooks via `/hooks`, confirming the
   matcher fires, and capturing the actual dispatch log remain open (I02/I03).

### What was inspected

Kiro read the four spec/design/tasks/handoff documents, then independently
read `compositionTimeline.ts`, `compositionTimeline.test.ts`, and
`audioSynth.ts` without assuming correctness from prior CI runs.

### Finding — `CompositionLookaheadCursor` has no `reset()` API (R4 coverage gap)

The cursor's internal `nextIndex` has no supported reset path. After any seek,
`planCompositionTimeline(score, newBeat)` produces a fresh event list, but
there was no method to point an existing cursor at that list from position 0.
Without `reset()`, any caller that attempts to reuse a cursor instance across
a seek has no correct API option — it must `new` a replacement, and the
contract for that lifecycle requirement was entirely untested.

The existing "seeking" test exercised `planCompositionTimeline()` in isolation
and never constructed a cursor or exercised it through a seek transition.

### Failing tests written before the fix

Two new tests added to `compositionTimeline.test.ts`:

1. **`cursor reset() after seek replays all events from new timeline without constructing a new instance`**  
   Full-play → `cursor.reset(seekEvents)` → drain must yield all events in
   order.  
   Failed before fix: `TypeError: cursor.reset is not a function`

2. **`cursor reset() mid-play discards unscheduled old events and replays new timeline`**  
   Mid-play → `cursor.reset(planCompositionTimeline(score, 3))` →
   `remaining` and drained events must match the new plan exactly.  
   Failed before fix: `TypeError: cursor.reset is not a function`

### Fix applied — `compositionTimeline.ts` (local, not yet in CI)

Minimal change to `CompositionLookaheadCursor`:
- `readonly events` constructor field → private `_events` with a public
  `get events()` accessor. External read-only contract is identical.
- Added `public reset(newEvents: readonly TimedCompositionNote[]): void`
  that assigns `_events` and rewinds `nextIndex` to 0.
- Added JSDoc stating the seek lifecycle contract and the warning against
  reuse without calling `reset()`.

No other logic changed. `pull()` and `remaining` behave identically for
callers that never seek.

### Test results after fix (local run, not yet in GitHub Actions)

```
node --import tsx --test src/engine/composition.test.ts \
                         src/engine/compositionTimeline.test.ts

✔  8 composition tests   (all pre-existing)
✔  9 timeline tests      (7 pre-existing + 2 new)
   tests 17 | pass 17 | fail 0
```

### Hook — manual command execution only; PostFileSave NOT confirmed

The `pbt-on-formula-save.json` hook (`version: v1`, `PostFileSave`, matcher
`src/engine/.*\.ts`) defines this command. It was run directly in the same
terminal session. **This does not constitute evidence of an automatic
PostFileSave dispatch.** KIRO TASK 3 (hook auto-trigger log with matcher
confirmation and session/model metadata) remains open.

```
npm run lint                                              PASS  (tsc --noEmit, 0 errors)
npm run test:composition                                  PASS  (8/8)
node --import tsx --test src/engine/compositionTimeline.test.ts  PASS  (9/9)
PBT seed=20261116, 100 trials × 5 invariants:
  cycle-termination          100/100  ✔
  acoustic-clamp             100/100  ✔
  csv-roundtrip              100/100  ✔
  wav-header                 100/100  ✔
  math-foundation-symmetry   100/100  ✔
```

### Open gates — confirmed still open after this session

- [ ] I02/I03: Actual Kiro hook automatic dispatch log with matcher
  confirmation and session/model metadata (`/hooks` inspection + trigger).
- [ ] CI gate: `compositionTimeline.ts` + `.test.ts` changes are local only.
  Must pass independent GitHub Actions before the PR is considered complete.
- [ ] E01–E03: Browser audio timing measurement under real Chrome/Firefox
  (scheduling drift, hidden-tab suspension, polyphonic chord onset).
- [ ] B04: Long-score note duration vs capped FM decay.
- [ ] A02/I01: AI Studio provenance and pre-Oct 30 eligibility audit.
- [ ] I05: Deployed public app replay path for judges.

### KIRO TASK 1: ✔ complete
### KIRO TASK 2: ✔ complete — API hardening (`cursor.reset()` + 2 tests, 17/17 pass, local)
### KIRO TASK 3: ✗ open — hook auto-dispatch not confirmed
### KIRO TASK 4: ✗ open — requires browser measurement
### KIRO TASK 5: ✗ open — evidence links pending

## Next owner update

When Kiro and browser checks are completed, append evidence links next to the
relevant IDs in the **existing** 69-check review list and W0–W5 roadmap.
Do not create a new recurring task or a parallel project management system.
