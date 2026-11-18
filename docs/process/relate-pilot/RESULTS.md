# Local relational-graph preflight: observed answers (18 November 2026)

**Engine:** custom in-memory graph traversal using JavaScript, **not Relate Cypher**. This tests whether connecting records creates useful cross-reference answers. **No Relate installation, Relate query, or performance benchmark was achieved** due to network restrictions.

## Graph sizes
- 120 items; 355 directed links; 69 review checks, 9 areas, 6 gates, 9 evidence placeholders, 12 GitHub file references and 5 judging criteria. All 12 file paths were accessible at recorded SHAs.
- Links are deliberately sparse and marked by source/scope confidence. Code presence does not imply implementation/requirement satisfaction.

## Q1: What would changing the music scheduler touch?

**15 review checks:** A03, B03, B04, C01, D07, E01, E02, E03, E04, E05, E06, E07, E08, F03, I04. Prioritize **E01–E05** (timing baseline/clock), **B03–B04** (overlapping voices and note duration), **D07** (seek/pause/replay), **C01** (source-to-mark correctness), **A03/I04** (rebuild/tests). Main files: `src/App.tsx`, `src/engine/audioSynth.ts`; draft PR3: `src/components/CompositionJourneyView.tsx`, `src/engine/composition.ts`; protect `src/engine/composition.test.ts` and `src/engine/pbtSuite.ts`. Relevant evidence placeholders: EV02, EV03, EV04, EV05. **This is an impact-review candidate, not a claim that a bug exists in each named file.**

## Q2: Which winning-submission requirements still lack independent proof?

All nine evidence classes remain **not independently verified in this pilot**: EV01 project eligibility/provenance; EV02 clean build/PBT/composition tests; EV03 audio onset/frame-time measurements; EV04 replay/provenance across scores; EV05 valid rejection/failure path; EV06 artifact export integrity; EV07 users judging artwork and novice journey; EV08 genuine Kiro runtime/hook evidence; EV09 publicly reachable judge app/video/Devpost.

**Prioritize EV01, EV02, EV03, EV08** before adding visual effects, then EV04/05/06/07 and EV09. This reflects the existing roadmap and does not establish those proofs do not exist outside the accessible source.

## Incremental utility versus plain checklist

The plain 69-item checklist already lists all individual obligations and priorities. The graph adds a *cross-cutting path* from a subsystem (scheduler) to checks, affected files, test candidates, and judge evidence in one traversal. This is useful **only if those manually seeded relationships stay accurate**; a stale graph can be worse than reading source docs. No measurable speed/accuracy improvement was demonstrated yet because Relate was not run, nor was a human baseline timed.

## Go / no-go

**No-go for adopting Relate into Harmoglyph now.** Keep this as a reproducible, removable documentation-only experiment. **Conditional go for a future local CLI trial** if scheduler changes surface genuine omissions or multiple agents repeatedly miss dependency/evidence context that GitHub docs already contain.
