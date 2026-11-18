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

## Kiro CLI W1 session 2 — KIRO TASK 2 (actual-path scheduling) + KIRO TASK 3 (hook auto-dispatch)

**Session ID:** sess_72b551af-5462-4abf-92f7-523bafc6ce06 (continued)  
**Client:** Kiro CLI, macOS, Node.js v24.1.0  
**Branch:** `work/w0-w1-harmoglyph-clock-review-2026-11-18`  
**Assignment source:** PR #4 comment "Next Kiro assignment — W1 actual-path scheduling control + automatic hook evidence"  
**Code changes:** local only — `compositionTimeline.ts` and `compositionTimeline.test.ts`
uncommitted and unpushed pending independent CI. Documentation file only is pushed.

### Step 1 — Git state verified before any change

```
git branch --show-current  →  work/w0-w1-harmoglyph-clock-review-2026-11-18
git status --short:
 M .kiro/specs/harmoglyph-clock/tasks.md
 M src/engine/compositionTimeline.test.ts
 M src/engine/compositionTimeline.ts
?? package-lock.json
```

All prior Kiro uncommitted changes (cursor `reset()`) preserved intact.

### Step 2 — Tracing the actual `scheduleUpcoming()` path

`CompositionJourneyView.scheduleUpcoming()` runs every 30 ms via `setInterval`.
On each call:

```
elapsed = getAudioClockTime() - originAudioSeconds
batch   = cursor.pull(elapsed, 0.18)
for event of batch:
    scheduleStepAt(note, originAudioSeconds + event.startOffsetSeconds, ...)
```

`scheduleStepAt()` resolves onset as:

```
onset = Math.max(ctx.currentTime, startAudioSeconds)
```

**Delayed-callback scenario:** if the JS main thread is blocked (React
re-render, GC, layout) for ~400 ms, `scheduleUpcoming()` fires late.
At that point `elapsed = 0.40`. `pull(0.40, 0.18)` returns all events with
`startOffsetSeconds <= 0.58` — a batch that includes both past-due and
future notes. For the `pulse-study` score at 132 BPM, notes at offsets
`0.000`, `0.227`, and `0.455 s` are all returned together:

```
note lead-1  nominal 0.150 s  →  actual onset 0.550 s  LATE (clamped to now)
note lead-2  nominal 0.377 s  →  actual onset 0.550 s  LATE (clamped to now)
note lead-3  nominal 0.605 s  →  actual onset 0.605 s  on-time
```

Notes 1 and 2 sound simultaneously despite being 0.227 s apart in the score.
This is **the documented intentional policy** in `design.md` ("Late notes are
made audible now; their nominal target is preserved in the deterministic
timeline for independent late-scheduler measurements"). It is not a hidden bug.

**The genuine gap:** the caller receives all these events from `pull()` with
no way to tell which are overdue. `scheduleStepAt()` clamps silently. A
consumer that wants to log, warn, skip, or instrument scheduling quality has
no supported API path. The score's distinct `startOffsetSeconds` values are
preserved in the returned events, but nothing names the boundary between
late and on-time.

### Step 3 — Policy decision

Three options were considered:

- **Skip overdue notes** — risks silence on slow devices; changes score semantics
- **Return a richer type from `pull()`** — breaks the existing call sites
- **Export a pure classifier** — adds observability without touching policy or existing API

Chosen: export `classifyScheduledEvents(batch, elapsedSeconds)` as a pure
function returning `{ late, onTime }`. Preserves ascending offset order in
each partition. Policy unchanged: `scheduleStepAt()` still plays late notes
at `currentTime`. Consumers can now detect and instrument the condition.

### Step 4 — Failing tests written before the fix

Three new tests added to `compositionTimeline.test.ts` (all failed before
`classifyScheduledEvents` was exported):

1. **`delayed callback coalesces overdue notes but preserves distinct offsets for consumer classification`**  
   Virtual clock at elapsed=0.40 s on `pulse-study`. Verifies: batch has ≥2
   events, offsets are strictly distinct and ascending, `classifyScheduledEvents`
   returns non-empty `late` and `onTime` partitions, partition is exhaustive,
   each partition preserves order, all late events have offset < elapsed, all
   on-time events have offset ≥ elapsed.  
   Failed before fix: `SyntaxError: does not provide an export named 'classifyScheduledEvents'`

2. **`classifyScheduledEvents handles zero-delay poll (all events on-time)`**  
   First poll at elapsed=0 → `late.length === 0`, `onTime.length === batch.length`.  
   Failed before fix: same import error.

3. **`classifyScheduledEvents with an empty batch returns empty partitions`**  
   Edge case: empty input → both partitions empty, no throw.  
   Failed before fix: same import error.

### Step 5 — Fix applied to `compositionTimeline.ts` (local, not yet in CI)

Added one exported pure function after `planCompositionTimeline`:

```typescript
export function classifyScheduledEvents(
  batch: readonly TimedCompositionNote[],
  elapsedSeconds: number,
): { late: TimedCompositionNote[]; onTime: TimedCompositionNote[] }
```

No existing function, type, or class was modified. `pull()`, `reset()`,
`remaining`, and `events` are unchanged. `tsc --noEmit` passes clean.

### Step 6 — Test results after fix (local run, not yet in GitHub Actions)

```
node --import tsx --test src/engine/composition.test.ts \
                         src/engine/compositionTimeline.test.ts

✔  8 composition tests   (all pre-existing)
✔ 12 timeline tests      (7 pre-existing + 2 from session 1 + 3 new)
   tests 20 | pass 20 | fail 0
```

### Step 7 — PostFileSave hook: AUTOMATICALLY DISPATCHED ✔

The `pbt-on-formula-save.json` hook (`version: v1`, trigger: `PostFileSave`,
matcher: `src/engine/.*\.ts`) **fired automatically** when Kiro saved
`src/engine/compositionTimeline.ts` via `fs_write`. The hook instruction
arrived in a `HOOK_INSTRUCTION` block immediately after the file-save tool
call, before any manual command was run. This is genuine automatic dispatch,
not a manual invocation.

**Hook command executed (driven by hook output):**

```
npm run lint                                              PASS  (tsc --noEmit, 0 errors)
npm run test:composition                                  PASS  (8/8)
node --import tsx --test src/engine/compositionTimeline.test.ts  PASS  (12/12)
PBT seed=20261116, 100 trials × 5 invariants:
  cycle-termination          100/100  ✔
  acoustic-clamp             100/100  ✔
  csv-roundtrip              100/100  ✔
  wav-header                 100/100  ✔
  math-foundation-symmetry   100/100  ✔
```

**I02/I03 status update:** automatic `PostFileSave` dispatch confirmed in
this Kiro CLI session. The hook matched `src/engine/compositionTimeline.ts`,
injected its command as a `HOOK_INSTRUCTION`, and all stages passed.
Metadata captured: session sess_72b551af, Kiro CLI, macOS, Node.js v24.1.0.
The hook JSON format used is `version: v1`; the `createHook` tool schema
confirms this format is natively supported by Kiro CLI.

### Open gates — updated after this session

- [x] I02/I03: PostFileSave hook automatic dispatch confirmed (this session).
- [ ] CI gate: `compositionTimeline.ts` + `.test.ts` changes are local only.
  Must pass independent GitHub Actions before the PR is complete.
- [ ] E01–E03: Browser audio timing measurement under real Chrome/Firefox.
  The virtual-clock model confirms coalescing risk; audible severity under
  real browser GC/layout delay has NOT been measured. Do not equate the
  virtual model with a measured audio observation.
- [ ] B04: Long-score note duration vs capped FM decay.
- [ ] A02/I01: AI Studio provenance and pre-Oct 30 eligibility audit.
- [ ] I05: Deployed public app replay path for judges.

### KIRO TASK 2: ✔ complete — delayed-callback coalescing traced, `classifyScheduledEvents` added, 20/20 tests (local)
### KIRO TASK 3: ✔ confirmed — `PostFileSave` hook auto-dispatched on `fs_write` of `compositionTimeline.ts`
### KIRO TASK 4: ✗ open — requires real browser measurement
### KIRO TASK 5: ✗ open — evidence links pending

## W1 source commit and independent CI — approved code-review handoff (18 Nov 2026)

**Authorization:** PR #4 comment "Approved W1 code-review and CI handoff — Kiro execution request".  
**Starting head before this action:** `fddbf1a445614e7394e9031f386009ce0490cff2`

### Step 1 — Git state verified

```
git status --short (before staging):
 M .kiro/specs/harmoglyph-clock/tasks.md
 M src/engine/compositionTimeline.test.ts
 M src/engine/compositionTimeline.ts
?? package-lock.json

git diff --check: no whitespace errors
```

All prior Kiro session changes confirmed present and intact. `tasks.md` and
`package-lock.json` confirmed unstaged and left unchanged.

### Step 2 — Diff inspection: exactly what was reported

`src/engine/compositionTimeline.ts` additions only:
- `classifyScheduledEvents()` pure export (38 lines incl. JSDoc)
- `CompositionLookaheadCursor.reset()` method (8 lines)
- `private _events` field + `get events()` accessor replacing `readonly events`
- Updated class JSDoc (seek lifecycle contract)
- `pull()` / `remaining` internals updated from `this.events` → `this._events`

`src/engine/compositionTimeline.test.ts` additions only:
- Import of `classifyScheduledEvents`
- 5 new test cases (lines 68–192 of the diff)

No other files modified in the staged set. Diff confirmed matches session reports.

### Step 3 — Local verification results (all pass)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run lint` | PASS — `tsc --noEmit`, 0 errors |
| Composition tests | `npm run test:composition` | PASS — 8/8 |
| Timeline tests | `node --import tsx --test src/engine/compositionTimeline.test.ts` | PASS — 12/12 |
| PBT | seed=20261116, 100 trials × 5 invariants | PASS — 500/500 |
| Build | `npm run build` | PASS — vite, pre-existing chunk-size warning unrelated to W1 |

### Step 4 — Source commit pushed

**Commit SHA:** `086f9ea8d4c27a3e70e7c7c1e3c85dea6e4f8302` (short: `086f9ea`)  
**Branch:** `work/w0-w1-harmoglyph-clock-review-2026-11-18`  
**PR:** https://github.com/Devpen787/Harmoglyph/pull/4  
**Changed paths:**
- `src/engine/compositionTimeline.ts` (+63 / -6 lines)
- `src/engine/compositionTimeline.test.ts` (+125 / -1 lines)

**Commit message summary:** API hardening — not a production-path audio fix.
`cursor.reset()` closes the previously untested seek lifecycle contract.
`classifyScheduledEvents()` adds observability for delayed-callback coalescing
without changing the intentional play-late policy.

### Step 5 — Independent GitHub Actions CI

| SHA | Run ID | URL | Conclusion |
|---|---|---|---|
| `086f9ea` | `44330372065` | https://github.com/Devpen787/Harmoglyph/actions/runs/44330372065 | **success** |

**CI job steps (all ✔):**
- Environment and baseline identity
- Install dependencies
- Typecheck
- Composition invariants
- W1 deterministic timeline tests
- Check Kiro hook v1 JSON structure
- Original 500 seeded PBT checks
- Build

Triggered via `pull_request` on the PR #4 branch. Completed in 30 s on
ubuntu-latest / Node.js 24. Two informational annotations (Node.js 20
deprecation, Ubuntu 26 migration notice) are runner infrastructure warnings
pre-dating this commit; they are not failures.

### PostFileSave hook evidence qualification

The automatic `PostFileSave` dispatch recorded in Kiro session 2 above is
**Kiro's own self-report**: the hook instruction appeared in a `HOOK_INSTRUCTION`
block in the Kiro CLI context immediately after `fs_write` of
`compositionTimeline.ts`. This is Kiro's internal event mechanism — it cannot
be exported as an independent log file or linked as a separate artifact.
The hook command itself (`npm run lint && npm run test:composition && ...`) was
run to completion and all stages passed, as shown above. The _automatic dispatch_
event is therefore attested by Kiro CLI's session context only; an independent
observer cannot replay or verify the dispatch event itself, only the command
result. This is recorded honestly per R6.

### Remaining open gates after W1 source commit + CI

- [ ] E01–E03: Measure scheduling errors with real Chrome/Firefox audio and
  display timing (fast notes, chords, background tabs, resumed sessions).
  The virtual-clock model confirms the coalescing mechanism exists; it does
  not substitute for measured audible onset timing.
- [ ] B04: Long-score note duration vs capped FM decay.
- [ ] A02/I01: AI Studio provenance and pre-Oct 30 eligibility audit.
- [ ] I05: Deployed public app replay path for judges.
- [ ] PR #3 and #4 remain draft/unmerged. ChatGPT independent review of
  source commit `086f9ea` and CI run `44330372065` required before promotion.

### KIRO TASK 2: ✔ source committed and CI-verified (`086f9ea`, run 44330372065)
### KIRO TASK 3: ✔ PostFileSave auto-dispatch self-reported by Kiro CLI (see qualification above)
### KIRO TASK 4: ✗ open — browser measurement required
### KIRO TASK 5: ✗ open — evidence links pending

## Next owner update

When Kiro and browser checks are completed, append evidence links next to the
relevant IDs in the **existing** 69-check review list and W0–W5 roadmap.
Do not create a new recurring task or a parallel project management system.
