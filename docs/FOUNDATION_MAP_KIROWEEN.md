# Harmoglyph — Foundation Map & Kiroween Gate Plan

> **Status:** PROPOSAL / FOR DEV REVIEW. This document maps the source observed on 17 November 2026; it does **not** approve a product redesign, certify Kiro usage, or assert contest eligibility.
>
> **Source baseline:** Devpen787/Harmoglyph, main at c6b55866342147a4de0eff01551b6a26ad6cf317. The Google AI Studio preview was changing during review and displayed a pending push-to-GitHub banner. Reconcile preview vs main before code changes.
>
> **Scope:** Product story, user journeys, system relationships, UX information architecture, mathematical truth labels, verification gates, Kiro workflow, and Devpost submission. No code implementation authorized by this document.

## 0. The question before the redesign

**Current repo product:** a mathematical instrument where one formula spreadsheet generates music, 2D vectors, and 3D sculptures.

**Previous candidate pivot:** ChimeraForge — Verified Grafts, which combines independently built *applications* and checks their behavior against unmodified originals. The current repo's Graft Editor combines *spreadsheet configurations*, not independent applications. These are **different products**.

**Decision required before major redesign:** Are we entering Harmoglyph as a creative mathematical instrument, or building Verified Grafts as an integration verifier? Do not combine their concepts or claim a capability neither demonstrates. This map treats the **current Harmoglyph instrument** as the working baseline, with positioning as a hypothesis.

### Candidate user/problem statement — UNVALIDATED

- **Primary pilot user:** musician, generative artist, or STEAM educator wanting to create and inspect a relationship between mathematical inputs, sound, and visual form.
- **User struggle to test:** making an interactive mathematical sound-and-form piece normally takes multiple tools and code, and the relationship between changes is hard to perceive.
- **Candidate value proposition:** "Start with one pattern. Hear it, see it, shape it, and export it — from the same mathematical model."
- **First differentiator:** immediate, synchronized 3D, sound, and editable math; not "many advanced algorithms" or "AI is everywhere."
- **Open objection:** why would this person choose Harmoglyph rather than an existing browser synth, creative-coding tool, or educational visualization? Interview and live test with 3–5 real target users; do not state impact as fact until supported.

## 1. Foundation map: one input model, three observable outputs

~~~mermaid
flowchart TB
  A["User intent: choose, tweak, or compose pattern"] --> B["Single session state: grid + preset + timing + style"]
  B --> C["Spreadsheet VM: evaluate cells safely"]
  C --> D["Normalized, bounded row steps"]
  D --> E["Math-law transformations"]
  E --> F["Web Audio + WAV exporter"]
  E --> G["2D SVG / PNG plotter"]
  E --> H["3D Three.js sculpture"]
  G --> I["Optional reverse geometry → grid"]
  I --> B
  D --> J["Diagnostics and PBT — separate from creative UI"]
~~~

**Existing source anchors:**

| Contract / behavior | Source in repo | Current status |
| --- | --- | --- |
| Session/view state and shared evaluator | src/App.tsx | Observed in source |
| Grid data, rows, columns, value types | src/types/chimera.ts | Observed |
| Spreadsheet parsing, cycles, clamps | src/engine/spreadsheetVm.ts | Source exists; re-test |
| Math-to-sound/art transformations | src/engine/mathArtTheory.ts | Observed |
| Web Audio and offline WAV | src/engine/audioSynth.ts | Source exists; re-test |
| SVG/PNG, geometry-to-formula | src/engine/vectorPlotter.ts | Source exists; re-test |
| Live sculpture | src/components/HarmonicThreeStage.tsx | Source exists; visually observed |
| Graft configuration editor | src/components/GraftEditorView.tsx | Source exists; visually observed |
| Verification suite | src/engine/pbtSuite.ts | Source exists; claims require independent run |
| User-facing layout | src/components/OpeningStageView.tsx, StudioView.tsx, TopBar.tsx | Visually observed |

### Stable data dictionary

The engine currently uses up to 48 rows, six cells per row; these are **engineering controls**, not six independent musical or mathematical truths:

| Cell | Meaning | Bounded range |
| --- | --- | --- |
| A | Pitch / carrier frequency | 20–4,000 Hz |
| B | Gate / velocity | 0–1 |
| C | FM modulation depth | 0–12 |
| D | Vector orbit / X geometry control | 10–100 |
| E | Envelope decay | 40–900 ms |
| F | Modulator frequency ratio | 0.25–8 |

**Contract to resolve before further complexity:**

1. A formula, a preset, a drawing, and a graft must ultimately produce the same normalized step schema. Do not build four unrelated state pipelines.
2. Decide explicitly whether selecting a mathematical foundation changes parameters at **render time**, rewrites source cells via "Apply to Sheet", or both; explain the consequences and make transformations reversible where practical.
3. Do not equate visually similar output with mathematically equivalent output.
4. Playback, live visuals and exported files must use the same evaluation snapshot/settings, not silently divergent computations.
5. All errors must be contained and shown in plain language; the audio path must remain finite and within documented clamps.
6. If multiple presets/math laws are presented, explain whether they are laws, particular mappings, style choices, or demo compositions.

## 2. The user journey hierarchy — simple to complex

~~~mermaid
flowchart TD
  L0["0 — DISCOVER: Choose a pattern → Play → change one control"] --> L1["1 — EXPLORE: Compare math laws / sound / forms"]
  L1 --> L2["2 — MAKE: Edit grid or draw path → inspect outputs → export"]
  L2 --> L3["3 — GRAFT: Combine two sheet configurations with explicit mapping"]
  S["Build/Judge diagnostics: Kiro proof, PBT, dependency graph, submission"] -. "Developer-only entry, not consumer navigation" .-> L0
~~~

| Journey | Who / goal | The one obvious action | Success condition | Current friction observed |
| --- | --- | --- | --- | --- |
| J01 Discover | First-time, nontechnical visitor wants a quick payoff | Choose preset; Play | Audible + visible response within 15 seconds after audio gesture | Dense HUD, multiple tier menus, duplicated Play, jargon |
| J02 Transform | Curious user wants cause/effect | Move **one** meaningful slider or switch math law | Perceptible before/after, safe undo | Dozens of simultaneous labels and controls |
| J03 Explain | Learner wants to understand math | Open "Why did this change?" | See exact formula + observed sound/form consequence + interpretation disclaimer | Catalog/Codex compete as separate concepts |
| J04 Make | Creator wants their own piece | Edit one formula or draw a simple stroke | Same data drives sound + 2D + 3D; clear error state | Spreadsheet, AI upload, draw controls crowded together |
| J05 Export | Creator wants to keep/share the result | Export WAV/SVG/PNG or session data | Valid downloadable output; matching preview/snapshot | Export is buried in advanced console |
| J06 Graft | Expert wants to combine patterns | Choose donor/host columns, preview diff, apply | Contract + deterministic test before mutation; undo | Two large grids and verifier need a guided path |
| J07 Verify | Developer/judge wants evidence | Open diagnostics from a separated route | Reproduce test results with seed, code revision, failures | Submission status blended into creative experience |

**Demo path: J01 → J02 → J05.** Advanced features must not be prerequisites for this path.

### Acceptance criteria to test with people

- A stranger can state what the product does after five seconds.
- After one explicit user gesture, they can make the same pattern audible and visible without instruction.
- They can predict one slider's effect before touching it and explain what happened afterward.
- They can export something useful within 90 seconds.
- Three to five actual target users can name a real activity they would use it for; record exact comments and failures, not just compliments.

These are targets, **not measured claims**.

## 3. Information architecture and visual system

### Consumer-facing app (proposal)

- **Stage (default):** one hero sculpture, current pattern name, one Play/Pause control, one high-leverage transform, simple sound/visual response, and Export. The default should be legible and interesting even muted.
- **Explore:** a law picker and single comparison ("Before / After"). Expand an explanation for pitch/rhythm/shape mapping. Offer a small lesson, not a formula encyclopedia by default.
- **Create:** one canvas/workbench with modes **Formulas** or **Draw**, a synchronized preview, and accessible error feedback. Imported scores and AI assistance are optional entry paths, not main-nav clutter.
- **Advanced → Graft:** stepwise choose base pattern, donor, contract, preview, verify, apply. Communicate that the operation grafts *patterns/spreadsheet columns*, not arbitrary applications.
- **Developer / Judge diagnostics:** separate screen or route for 500 PBT checks, EARS traceability, .kiro sources, Git status, and Devpost evidence. It should not appear as a consumer "Submission" tab or claim certification automatically.

### UI simplification rules

1. One canonical nav; remove duplicate tier, header and footer routes to the same place.
2. One primary CTA per screen. Secondary controls stay contextual.
3. Name actions for outcomes: "Try a pattern", "Change the sound", "See the math", "Make your own", "Mix patterns", "Export".
4. Hide A1:F48, FM-index, φ, period, δ, and ratio readouts behind Explore/Create unless needed for a demonstrated interaction.
5. Remove contradictory progress indicators ("quest 1/5" vs "3/5 done") or make progress state fully derived from completed actions.
6. A visual must have a reason: legible focal point, actual response to input, accessible text and contrast, tolerable bloom/brightness, meaningful empty/error state.
7. Use responsive layout, keyboard focus, reduced motion, Web Audio activation messaging, and export/download failure feedback. Do a separate accessibility inspection after stable build.

**Presentational north star:** the complexity lives in the engine and the explanations, not in the first viewport.

## 4. Truth labels: mathematics vs mapping vs aesthetics

| Claim type | What we can responsibly say | UI expression |
| --- | --- | --- |
| Objective / executable | Spreadsheet value, bounded pitch, formula dependency, deterministic geometry output, test counts with seed and SHA | Show exact measurement and reproducible test |
| Designed interpretation | "We mapped Fibonacci ratios to frequency modulation and spiral parameters" | Explain the mapping; avoid implying uniqueness or scientific necessity |
| Creative / subjective | "Dreamlike", "harmonious", "tense", "beautiful", "organic" | Present as descriptive tags or clearly labeled heuristics |
| Scientific model claim | "Cymatic" / "Chladni" visuals | Call algorithmic / inspired visualizations unless the physical differential equation and empirical agreement are validated |

In particular, an on-screen "Harmony 88/100" should **not** read like an external, objective musical-quality score. If it is a computed heuristic, rename it to a measurable property ("ratio regularity" or "shape symmetry") with an inspectable definition. Our design opinion is not a physics invariant.

## 5. Kiroween is a release contract, not a decorative dashboard

**Primary category hypothesis:** Frankenstein — combination of spreadsheet VM, FM instrument, 2D plotter, 3D sculpture. Make each integration causally visible in the demo, not merely list libraries. Category selection is pending Dev confirmation.

**Five judging criteria:** Potential Impact, Technological Implementation (thoughtful Kiro use), Design, Innovation/Idea, Presentation. Don't optimize only for visual complexity or property-test totals.

| Gate | Pass evidence | Current observation / blocker |
| --- | --- | --- |
| G0 Eligibility & identity | Eligible residence/age, not AWS employee, original work/new since Oct 30; disclosed pre-existing work | Needs Dev attestation and creation provenance |
| G1 Product clarity | Specific user/problem, 5-second pitch, 3–5 user tests | Hypothesis only; not validated |
| G2 Working accessible app | Public URL without login or judge credentials in private field; mobile/desktop/audio/export smoke test | AI Studio preview sign-in risk; external deployment unverified |
| G3 Public source | Public GitHub with root LICENSE detectable, README, source/assets, root .kiro not ignored | Repository and root .kiro observed; final license/asset review pending |
| G4 Real Kiro use | Actual IDE/CLI/Web/Crew runs on Harmoglyph; spec → implementation → test evidence, recorded change | .kiro files exist; actual Kiro execution **not proven** |
| G5 Valid Kiro structures | Kiro recognizes specs, steering and at least the Kiro features we honestly claim; hooks actually fire, agents/powers/MCP actually load if claimed | Existing hooks and agent/power manifests need format/activation validation |
| G6 Deterministic verification | Fresh independent lint/build, PBT logs with seed/trials/SHA, cross-output integration smoke tests, counterexample | PBT code exists; current "500/500" is not an independent run |
| G7 Presentation | Public YouTube under 3 min; problem/user, 20-second live outcome, actual Kiro workflow, no unlicensed material | Not yet evidenced |
| G8 Devpost complete | Correct category, repo, app, video, Kiro write-up, required questions and truthful optional bonuses | Existing project page does **not** equal entry submitted to Kiroween |
| G9 Contest freeze | Snapshot the submitted app, repo and video by deadline; keep unchanged until winners as rules instruct | Future task; freeze plan needed |

**Absolutely remove/replace** "100% KIROWEEN READY", "Formal Verification", or "Public Verified" if not supported by reproducible evidence. Treat status as PASS / FAIL / NOT TESTED / NOT APPLICABLE, with source revision + timestamp.

### Current .kiro implementation risk (source inspection, not runtime proof)

- **Steering and specs:** root .kiro and EARS requirements/design/tasks are present; steering frontmatter appears plausible. Verify Kiro IDE actually reads them.
- **Hooks:** .kiro/hooks/pbt-on-formula-save.json uses fields such as version "1.0.0", event, filePattern, command. Current Kiro hook documentation uses a v1 hooks-list structure with trigger, matcher and action. The existing JSON should not be called an installed working Kiro hook until corrected and fired inside Kiro. The hook description also says "400" while the suite claims 500.
- **Custom agents/Crew:** .kiro/agents/synth-crew.json describes five roles in one JSON file. That is not proof five configured Kiro agents or a Kiro Crew app executed. Consult Kiro's current custom-agent and Kiro Crew configuration; create authentic configs/evidence if using the feature.
- **Powers:** .kiro/powers/*.md files are documentation, but a recognized installed Kiro power needs its supported package/manifest conventions. Do not report an active Power merely because a Markdown file exists.
- **MCP:** .kiro/settings/mcp.json references a filesystem MCP server plus local REST URL paths. A generic REST endpoint is not automatically an MCP server. Check Kiro connection status and protocol, not just the JSON.
- **Terminology cleanup:** metadata.json still says ChimeraForge; package.json says react-example; product and Devpost are Harmoglyph. Resolve names before screenshots/public release.
- **Asset rights:** review public assets (including the New York, New York PDF under public/assets/aistudio) for license, authorship and permissions. Do not infer infringement without inspecting provenance; do not use copyrighted music/assets in demo without rights.
- **Runtime:** server Gemini keys must remain server-only; core creative experience should have a useful no-key path.

### Real Kiro workflow — the smallest convincing slice

1. Clone/check out pinned repo in **Kiro IDE**. Confirm the IDE is truly running in Dev's account and supports the feature in Switzerland. Record date, version and git SHA.
2. Have Kiro inspect the existing EARS spec and **revise ONE J01/J02 vertical slice**: selecting a math law changes both sound and visual output, within safety bounds, from shared data. Define acceptance cases.
3. Let Kiro generate/update the design/tasks under .kiro/specs/harmoglyph; execute a bounded task using Kiro, not only AI Studio/Gemini.
4. Repair/validate one hook using current Kiro syntax; deliberately trigger it and capture the Kiro hook execution result, command, output, and behavior when failing. If automatic execution is unsupported, explain honestly.
5. Run a before/after PBT counterexample: known broken mapping fails and corrected mapping passes. Record seed, inputs, output, commit SHA. PBT does not constitute formal verification.
6. Commit the actual changes (with tests) and save a short development log: prompt/spec, Kiro surface used, generated changes vs manual corrections, test evidence, what Kiro helped and where it failed.
7. Only then claim those features in the Devpost Kiro write-up. Custom agents, MCP, Powers, Kiro Crew and property-based correctness tools are **optional claims** requiring separate evidence if used; the contest requires Kiro use, not every named feature.

References: https://kiro.dev/docs/specs/ ; https://kiro.dev/docs/hooks/ ; https://kiro.dev/docs/steering/ ; https://kiro.dev/docs/custom-agents/ ; https://kiro.dev/docs/powers/installation/ ; https://kiro.dev/docs/mcp/configuration/

## 6. Build sequence, each a strict release gate

| Slice | Scope | Required before next slice | Relevant judging signal |
| --- | --- | --- | --- |
| S0 Baseline & identity | Reconcile AI Studio vs GitHub, prove initial build, document actual product and origin dates | Stable pinned SHA, app opens, no source loss | Eligibility / tech |
| S1 Golden path | J01: preset → Play → change ONE control; focus 3D and accessible audio | 5-second comprehension, 15-second observable response, no dead CTA | Impact / design / presentation |
| S2 One engine, three outputs | J02: same math change affects audible sound, SVG, 3D from shared evaluated steps | Differential/integration and safety checks; clear mapping | Innovation / tech |
| S3 Creator value | J04+J05: simple edit/draw and reliable export | Creator can make/export within 90 sec, round-trip checks | Impact / design |
| S4 Advanced graft | J06 guided map, preview, verify, apply, undo | Deterministic contract; relevant counterexample shown | Frankenstein / innovation |
| S5 Kiro provenance & quality | Authentic Kiro spec, hook, logs, no fake ready badge, accessible run | Valid run + CI/build/PBT + honest claims | Tech |
| S6 Judging handoff | Public deploy, YouTube, screenshots, Devpost, rights and credit checks | All mandatory submission fields complete and URL works in incognito | Presentation / eligibility |

**Non-negotiable sequencing:** No additional formula catalog, physics-sounding score, secondary navigation, or category bonus work should jump ahead of S1–S3 unless it removes a verified blocker. This is a proposed prioritization, not a mandate to discard existing features.

### Key deadlines and preservation

- **Kiro credit request:** December 1, 2026, 12:00 PM Pacific (21:00 Zürich). Enter correct Kiro/AWS ID; distribution subject to review; do not assume granted credits.
- **Submission deadline:** December 4, 2026, 2:00 PM Pacific (23:00 Zürich).
- **Judging ends:** January 29, 2027. Maintain public working URL, submitted repo and video without material changes through judging. Rules say preserve submitted materials after deadline until winners announcement; fork for ongoing post-deadline work.
- **Winners announced:** February 3, 2027.
- The public demo must be functional, free, and accessible to judges; private testing credentials go only in the private Devpost field.
- YouTube demo must be public and less than three minutes, show the product **and** how Kiro was used.
- Public GitHub must be open source (license visible), .kiro tracked, with instructions.
- Optional bonuses need their own evidence (separate Kiro Crew **app** repo, blog, social post starting #KiroweenHackathon26, startup website + founder credentials, etc.). No bonus auto-eligibility.

Official submission/rules:
- https://kiroween.devpost.com/rules
- https://kiroween.devpost.com/
- Existing project: https://devpost.com/software/harmoglyph

## 7. Decision register / next review

### Facts observed

- Harmoglyph's source has a working *conceptual pipeline* centered on spreadsheet-evaluated steps.
- The current live UI surfaces a dramatic visual, transport, three learning tiers, formula catalog, codex, algebra console, graft editor, a verification area, and a competition submission screen. In a first visit, it overwhelms the core instrument.
- No independently reproduced build/test/deploy or Kiro run was performed for this document.
- The live preview was mutable during inspection and showed changes available to push to GitHub; source parity is **not** established.

### Decisions **proposed, not accepted**

1. Product identity: creative math instrument (unless Dev chooses the different Verified Grafts pivot).
2. Primary audience: creators/educators as a pilot hypothesis.
3. Golden journey: J01 → J02 → J05, no advanced prerequisites.
4. Four layers: Discover, Explore, Make, Graft; separate Developer/Judge diagnostics.
5. One canonical session model; explicit truth labels for algorithm vs interpretation vs subjective aesthetics.
6. Strict G0–G9 release gates; Kiro provenance required for all new accepted slices.

### Decisions needed from Dev

- **P1:** Keep Harmoglyph creative instrument as entrant, or change concept to Verified Grafts? This is the largest product decision, not a naming tweak.
- **P2:** Does the three-step hero journey feel right: choose → play/transform → export?
- **P3:** Approve the 4-level information architecture and move Submission/Verify out of consumer navigation?
- **P4:** Permission to execute S0/S1 in Kiro using a pinned branch, then stage any code fixes as reviewable PRs?

No source code, deployed app, or Devpost submission status is changed by this map.
