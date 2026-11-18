# Harmoglyph — Kiroween 2026 Winner-Grade Roadmap (ETHGlobal Finalist Framework Crosswalk)

> **Status: PROPOSED / documentation only — not a merge, app release, accepted product redesign, or verified competition readiness.**  
> Prepared: **18 November 2026**. Targets [Kiroween 2026](https://kiroween.devpost.com/) **Frankenstein** category and potentially the overall awards, **not an ETHGlobal sponsor track**.  
> Deadline: **4 December 2026, 14:00 PST / 23:00 Europe/Zurich**; submit with a buffer.  
> Owning documents: [Foundation Map](FOUNDATION_MAP_KIROWEEN.md) and [69-item research review register](research/RESEARCH_12_13_SYNTHESIS_AND_REVIEW_CHECKLIST.md). This roadmap interprets and **prioritizes** those existing review items; it is not a new competing task tracker.

## 0. Evidence hierarchy and sources

**Competition truth (current 2026):** [Official Kiroween 2026 event](https://kiroween.devpost.com/), [2026 rules](https://kiroween.devpost.com/rules), [Kiro hooks documentation](https://kiro.dev/docs/hooks/). On 18 November 2026 the official 2026 search-indexed rules were updated 16 November; some direct/cached reads of the same /rules route still display **2025** rules. **Do not use 2025 existing-project eligibility wording for 2026.** Re-open the dated 2026 version in the user's browser before submitting or seek organizer clarification for any ambiguity.

**Our ETHGlobal lessons:** *ETHOnline_2026_Finalist_Teardown_and_Playbook.md* (17 September 2026, user's private ChatGPT Library; inspected), plus the project-attached *Analyze ETH Global Winners.txt* summary of the Technical Execution Atlas and Finalist Gate. The two standalone files *ETHOnline_2026_Technical_Execution_Atlas.md* and *ETHGlobal_Finalist_Gate.md* were **not directly retrievable** from this workspace; do not claim this document independently audited their full original text. The earlier finalist study covers **eight ETHOnline 2026 finalists**, not necessarily eight overall/prize winners. Treat the common patterns as a design/evidence benchmark, not a causal formula guaranteeing victory.

**Our Harmoglyph evidence:** both user-supplied deep research originals ([R12](research/sources/deep-research-report-12-original.md), [R13](research/sources/deep-research-report-13-original.md)), their [critical comparison and 69-item queue](research/RESEARCH_12_13_SYNTHESIS_AND_REVIEW_CHECKLIST.md), inspected GitHub [main](https://github.com/Devpen787/Harmoglyph/tree/main) and unmerged [draft PR #3](https://github.com/Devpen787/Harmoglyph/pull/3), with full qualification in [PR3 handoff](https://github.com/Devpen787/Harmoglyph/blob/codex/unified-song-art-slice/docs/SONG_ART_COMPOSITION_SLICE.md). We have **not** in this review measured runtime FPS, audio sync, independent listening, Kiro execution, or Google AI Studio parity.

## 1. Strategic call — convert the finalist formula to a creative instrument

**The ETHGlobal finalist pattern:** real problem → non-obvious technical insight → hard promise/invariant → success and deliberate failure → independent evidence → completed consequence → memorable demonstration.

**Proposed judge-facing product pitch:**

> **Compose a song. Watch its musical relationships become a living artwork. Remix how it moves and looks, inspect the math, then preserve the result.**

**Audience hypothesis:** people creating audiovisual artworks, music learners, creative coders, and educators. We have not measured willingness to use/pay or demonstrated that general music producers need it.

**Problem hypothesis:** music composition, expressive motion graphics, and visual art commonly live in separate authoring tools; reactive music visualizers often show *reactions* rather than a persistent, remixable artwork with inspectable links to its score. This is NOT a proven unique market gap. Compare with actual competing products before claiming novelty.

**Hard technical claim (proposal):** One canonical scored composition controls the sound, note/interval relationships, a deterministic *motion state*, and distinct artistic renderers. The maker can ask **“why does this part move?”**, edit a note/rule, and trace the effect. Its enduring output is an artwork or replayable audiovisual composition, not only transient visualizer frames.

**Safe invariants to implement and independently verify:**
- For a pinned composition+mapping+motion configuration+seed+version, canonical simulation **checkpoints and source/event IDs reproduce** under the documented deterministic engine. No claim of identical pixels or recorded hardware sound on every platform.
- Every **score-derived** visual contribution refers to real note/phrase/interval and mapping IDs; deliberately decorative effects are labeled as style, not misrepresented as acoustic forces.
- Changing **appearance only** preserves scored audio and underlying motion states; changing a motion law changes movement but not the score.
- Invalid musical or mapping inputs are rejected/contained without breaking playback, exposing a comprehensible reason and retaining the last valid state. Unsupported monophonic grid handoff **must not silently flatten** simultaneous voices.
- A completed and saved artwork/score can be reopened and produces the declared visual result within the supported replay contract.

**Deliberate failure is not a contrived “security” stunt:** demonstrate a legitimately invalid mapping (unsafe magnitude, nonfinite parameter or nonexistent source) being refused, or the existing PR3 supported/unsupported polyphonic-to-A1:F48 handoff, **while preserving the valid composition**. An unstable oscillator with zero damping is *not* by itself an invalid input.

**Memorable consequence:** A user starts from one note, builds a passage, plays a graceful connected artwork, changes a note/relationship, sees/hears the causal difference, inspects *why*, and exports a lasting and re-playable piece. The end frame is the person's creation, not a diagnostic dashboard.

**Frankenstein fit:** sheet/formula VM + native FM audio + 2D mathematical vector plotting + evolving 3D stage become *one genuine bidirectional/causal creative instrument*. Keep the mathematical/formula engine genuinely load-bearing, not an invisible legacy checkbox. If reverse geometry→sheet is used as a WOW moment, demonstrate only its verified supported input class—do not claim general visual→polyphonic-music inversion.

## 2. ETHGlobal Finalist lessons → Harmoglyph crosswalk

| ETH finalist pattern / example | Does it transfer? | Current baseline | Harmoglyph winning action / proof | Existing checks |
| --- | --- | --- | --- | --- |
| **One-sentence tension** — Cordon/TARE/OpenBook | **Yes**, formulate an artist's problem not a fake blockchain threat | Product story split between formula laboratory and song art | Test proposed pitch on 3–5 newcomers: understand within 15 seconds, name what they make | G01, G07, H03 |
| **One hard invariant** — LeekWallet/OnchainRouter | **Yes**, causal trace + reproducible core | Main deterministic math; PR3 note ID/geometry mapping | Tests for score→motion provenance and controlled recomputation | C01, C03–C05, D07, D09 |
| **Deliberate failure** — OpenBook/Petri | **Adapt**, genuine boundary rather than artificial refusal | PR3 rejects unsupported multi-voice A1:F48 transfer | Invalid mapping/unsupported projection shown as clear, non-destructive refusal with test log | B02–B04, C04, X6 |
| **Proof density** — TARE/Petri | **Yes**, evidence matching actual claim | Five PBT categories source present; PR3 composition tests; execution not independently logged | Timebase traces, replay fixtures, source-trace inspection, exports, controlled before/after and negative test | A03, C08, E01–E08, F03, I04 |
| **Load-bearing integrations** — OpenBook/ETH Arcade | **Translate**, NOT sponsor count | Formula/synth/vector/3D pieces exist but source parity unclear | Architecture/demonstration where removing sheet/synth/geometry/motion loses a genuine part of creative workflow | A04–A05, F01 |
| **Full user consequence** — OnchainRouter/ETH Arcade | **Yes** | PR3 proposes note→song→show and JSON/SVG export | Actual novice creates, changes, finishes, saves/reopens artwork with no forced spreadsheet navigation | G01–G02, F03–F04 |
| **Reusable primitive** — OnchainRouter/Petri | **Optional enhancement** | PR3 structured score JSON; main math engine | Portable versioned composition package and documented mapping schema. No new SDK unless proven necessary | F04, C04, X7 |
| **Honest limitations** — Petri | **Yes** | PR3 handoff documents sustain and polyphony loss | README: what is source-backed, tested, simulated, approximated, unsupported | B02, B04, I04–I05 |
| **Depth before breadth** — Cordon | **Yes** | Main large 3D system; potential 69-item scope explosion | One polished motion family + deliberate contrast rather than 6 shallow effects; second grammar only if baseline succeeds | D02–D06, G05–G07 |
| **Judge-first repo/docs** — Novi Corpus | **Yes**, but no ETH continuity exemption | Docs branch/PR3 open; README and .kiro exist | One README landing, evidence, reproducible tests, before/after event provenance, Kiro record, limitations | A01, H01–H05, I01–I07 |
| **WOW without gimmick** — ETH Arcade | **Yes** | Earlier Song→Art lab visually tangled; PR3 composition arcs not independently judged attractive | Movie-like *one note→complex living art* reveal where a specific score edit causes an elegant, explainable transformation | D06, D09, G05–G07 |
| **Risk-first tech spikes + agent discipline** — technical-execution research summary | **Yes** | Existing setInterval and independent PR3 performance.now visual clock | Prove audio scheduling and valid Kiro hook *before* aesthetic expansion; Kiro specs/tests/evidence per change | E01–E05, I02–I04 |

**ETH-only rules that do not transfer:** crypto necessity, sponsor bounty stacking, on-chain authority, cryptographic signatures, transaction receipts, ETHGlobal continuity-track exemptions. Do not bolt blockchain or agent features into Harmoglyph to imitate a finalist.

## 3. Actual Kiroween 2026 judging crosswalk (five equal 20% criteria)

| Judging dimension | Present strength | Largest judge-facing gap | Evidence judges should see | Gate |
| --- | --- | --- | --- | --- |
| **Potential Impact** (20%) | Accessible browser instrument idea; PR3 beginner journey | Audience/problem unvalidated; difficult to immediately explain why user would use it | 15-second pitch, 3–5 creator/learner tests, successfully exported artwork somebody values | W0, W4 |
| **Technological Implementation / Kiro** (20%) | Specs/steering/hooks and PBT code files present | Real Kiro development and hook execution are **not yet proven**; hook schema appears legacy | Actual Kiro IDE/CLI work log/screenshots, one migrated hook firing, Kiro specs→code→failing/passing tests | W0, W1, W5 |
| **Design** (20%) | 2D/3D rich foundation, PR3 composed art journey | Animation continuity, note-to-art intuitive causality, print-worthy visual aesthetics and novice flow | Smooth, visibly music-related performance with usable note/phrase controls and export | W2, W3, W4 |
| **Innovation/Idea** (20%) | Shared formula state and bidirectional geometric capabilities | “No one has done this” unsupported; music-responsive visuals widely exist | Prior-art matrix, precise unique combination, reproducible score→motion→art and bounded inverse operation | W1, W2, W5 |
| **Presentation** (20%) | Clear conceptual story; saved experiments | Public judge-ready release, <3 min demo and 30-second explanation unverified | Uncut end-to-end demo, visible failure/control proof, result artifact, short truthful Kiro story | W4, W5 |

**No numerical score is assigned:** these are source- and proposal-based gaps, not observed judge scores. Passing implementation tests cannot award the visual-design or impact points.

### Eligibility and rules are W0, not a final administrative chore

The **2026** official page/rules state:
- **New projects only**, created during **30 October–4 December 2026**; generic libraries/templates allowed and **pre-existing incorporated work must be disclosed**. The first GitHub commit for \`Devpen787/Harmoglyph\` is \`c6b55866342147a4de0eff01551b6a26ad6cf317\` dated **17 November 2026**, but that alone does **not prove all AI Studio/source work started in the eligible period**. Audit source provenance and ask the Devpost organizer if ambiguous. ETHGlobal continuity eligibility **does not apply**.
- **Meaningful Kiro IDE/CLI/Web/Crew usage** mandatory; insufficient usage is disqualifying. Kiro hooks/spec files alone are insufficient.
- **Public GitHub** source and detectable OSI license with root tracked \`/.kiro\`; **functional app URL** and judge instructions; **public YouTube** demo under 3 min; Kiro development write-up; truthful third-party ownership/rights.
- **Category:** Frankenstein is the natural initial fit. Do not switch to Costume Contest solely for aesthetics; it requires a functionally coherent spooky UI. Overall and category prize eligibility follow official rules; do not promise prize money.
- **Final deadline:** 4 Dec 2026 14:00 PST = 23:00 Zürich. No extensions. Ensure working demo remains accessible during judging.

## 4. Winning demo storyboard (draft — under 3 min, original/licensed music)

| Moment | What the judge sees | Hard claim it helps prove |
| --- | --- | --- |
| **0:00–0:15** Problem → promise | Empty canvas. “A note can become part of a lasting artwork, not just a bouncing visualizer.” | Immediate user hook/impact |
| **0:15–0:40** One note → song | Start *First Mark*, add notes or load *Glass Garden*, hear an original melody | Canonical score drives sound |
| **0:40–1:15** Movement with meaning | One smooth motion builds into connected artwork; tweak pitch/phrase/velocity and hear/see causal response | Score→relationships→motion |
| **1:15–1:37** Remix form versus law | Same song and motion; switch ink/ribbon/particles. Change motion rule and see coherent dynamics change | Modular art/motion separation |
| **1:37–1:55** Explain and negative control | Click visual element “why?” to reveal source note/interval/rule. Show invalid rule/unsupported projection refusal without losing composition | Inspectable invariant and honest failure |
| **1:55–2:15** Complete consequence | Finish the song; save/download a visual artifact and editable score; show replay or restored result | Complete user journey, not just animation |
| **2:15–2:40** Underlying craft and Kiro | Architecture: formula VM ↔ score ↔ synth/motion ↔ render; one real spec→hook→test/checkpoint | Frankenstein technicality + demonstrated Kiro |
| **2:40–2:50** Close | Finished artwork and concise invitation to try public demo; credible limitation | Memorable final image |

**Do not fabricate missing beats:** if any feature is not implemented and verified, cut that claim and redesign the demo around actual working outcomes. Script is a target and must be filmed with the shipped build.

## 5. Six gated milestones to the deadline (do not build all 69 checks)

### W0 — ELIGIBILITY + BASELINE + MESSAGE · Nov 18–19 · **P0, cannot defer**

**Deliverables:** one pinned source baseline and AI Studio provenance note; list all existing/borrowed code and dates; confirm Frankenstein fit; demonstrate pitch to a newcomer; identify what user wants to save; decide Kiro execution path. Open draft PRs remain separated until comparison complete.

**Review checklist:** A01–A05, B01–B04, G01, H04, I01.  
**Pass when:** project origin within allowed window or organizer-confirmed interpretation; code source and unmerged changes are reconciled; core problem/wow in one sentence; clean lint/build/tests from exact commits recorded.  
**Fail / hold when:** material pre-Oct30 origin unresolved, ambiguous ownership, or PR3 silently breaks original features. Do not treat a GitHub timestamp alone as proof.

### W1 — TECHNICAL INVARIANT + REAL KIRO · Nov 20–22 · **P0**

**Deliverables:** timed score playback and shared event/playhead origin, first reliable event-to-art provenance tests, one genuine Kiro spec/steering→implemented change→current-v1 hook firing with output, documented reject/error test. Compare native Web Audio lookahead against existing setInterval/PR3 RAF before adding Tone.js.

**Review checklist:** E01–E05, C01–C04, I02–I04, H04.  
**Pass when:** note events remain ordered, chord/retrigger overlap safe, each shown note has source ID, seek/pause/replay behavior specified, measured scheduling/frame baseline and real Kiro logs exist.  
**Fail / hold when:** no real Kiro execution evidence, event timing not repeatable, unsafe data accepted, or incorrect claim of hardware-perfect sync.

### W2 — SIGNATURE MUSIC→MOTION ENGINE · Nov 23–25 · **P0**

**Deliverables:** one **musically meaningful** and artistically compelling motion grammar implemented through reusable state (initially evaluate melodic ribbon or bounded coupled spring), smooth transitions and persistent final artwork. Build a contrasting proof under *Glass Garden*, *Ascending Light*, *Pulse Study*, *Leap Dialogue* plus negative controls. Keep older mathematical and 3D stages available.

**Review checklist:** C05–C06, C08, D01–D07, D09, E06, G05.  
**Pass when:** different scores produce explainably distinct compositions; source-event edits change related behavior; all states finite; same config+seed produces repeatable checkpoints; target motion looks continuous on a real display.  
**Fail / pivot when:** it is merely decorative equalizer motion, impossible to attribute, cluttered, choppy or visually indistinguishable across songs. **One compelling grammar beats six weak ones.**

### W3 — CREATIVE REMIX + CLOSED USER JOURNEY · Nov 26–28 · **P0**

**Deliverables:** simplify into *start with one note → add a phrase/voice → play/view artwork → change form/motion/relationship → inspect why → export/reopen*. One polished visual material switch is enough to prove independent styling. Preserve the advanced formula lab but do not force novice into it.

**Review checklist:** G01–G04, F01–F04, F07, D06–D09, B07.  
**Pass when:** a new user can complete the entire journey unaided; style-only changes leave audio/motion intact; SVG/PNG or score JSON downloads actually open; no silent loss to old A1:F48; user leaves with artwork and composition.  
**Fail / cut when:** export cannot reopen, controls mislead, audio fails autoplay unlocking or sound/art diverge. Video export is a **stretch**, not a dependency.

### W4 — EVIDENCE, VISUAL QUALITY, PRIOR ART · Nov 29–Dec 1 · **P0**

**Deliverables:** verify on 2 browsers/target laptop and mobile or reduced-motion case; p50/p95 frame-time, source-to-motion checkpoint, held-note and polyphony audio observations; export decoding; 3–5 user feedback notes; a proper competitor/novelty comparison (TouchDesigner, Max/Jitter, Magic Music Visuals or another close product) and *what ours does not prove*; first 2:50 demo rehearsal.

**Review checklist:** G05–G08, F03–F07, H01–H05, E06–E08, I04.  
**Pass when:** visual result is coherent and at least some testers would willingly save/share the piece; judge can independently run a test/replay; every headline claim has proof or is explicitly qualified.  
**Fail / repair when:** art looks random/tangled, motion stutters, claims of unique music physics are unsupported, or test numbers are merely self-reported from docs.

### W5 — JUDGE-READY RELEASE + SUBMISSION · Dec 2–4 · **P0**

**Deliverables:** working unauthenticated or judge-accessible public app; clean public GitHub with license, tracked \`/.kiro\`, Kiro run/evidence, install commands, audit trail, demo instructions, 2:50-or-shorter **public YouTube** video, correct Frankenstein and bonus fields, Devpost preview, final smoke on the actual submitted URL.

**Review checklist:** I01–I09, A04, G01–G02.  
**Pass when:** first-time judge on a clean browser can understand the pitch, hit Play, hear music, observe an explainable artwork, change something, reach a saved outcome, and read actual source/tests in minutes.  
**Go/no-go decision by Dec 3:** prioritize one complete, beautiful, demonstrable flow with real Kiro provenance over adding new effects. **Do not wait until the Dec 4 23:00 Zürich deadline to begin uploading.**

## 6. Evidence packet — each claim has an owner and proof

Maintain **one evidence index in the existing project docs**, not separate marketing claims or systems. Suggested entries:
- \`EVIDENCE-01\` baseline/eligible development timestamp, source inventory and disclosed pre-existing code.
- \`EVIDENCE-02\` exact branch/SHA, clean install, typecheck/build, 5×100 seeded PBT and PR3 composition tests **as actually executed** (not merely present).
- \`EVIDENCE-03\` one measurable scheduling comparison, display frame timing and output-limit disclosure.
- \`EVIDENCE-04\` replay fixtures for five scores + silence + invalid mapping, canonical checkpoint hashes/metrics, note-to-element provenance.
- \`EVIDENCE-05\` a valid refusal: illegal mapping or polyphonic sheet conversion, including intact original composition.
- \`EVIDENCE-06\` SVG/PNG/score JSON or WAV checked by opening/decoding and comparing claims.
- \`EVIDENCE-07\` usability/art-direction feedback with raw observations and what changed.
- \`EVIDENCE-08\` Kiro CLI/IDE sessions and hook trigger output connected to source commits, specs and changed behavior.
- \`EVIDENCE-09\` published app, public GitHub source/license, fully tested judge path, video, Devpost submission details and backup screenshots.

Suggested honest README: **One-line promise → GIF/screenshot → Try live → 2-minute judge path → how it works → source diagram → one success & one intentional refusal → actual evidence/test commands → what it proves/doesn't prove → Kiro development record → install/license/provenance.**

## 7. Cut list, stretch list, and escalation risks

**P0 — never cut:** eligibility/provenance, meaningfully demonstrated Kiro use, one truly synchronized and understandable music-driven motion scene, valid user editing, safe mapping/negative case, real export, public working demo and video, truthful reproducible code.

**P1 — only after P0 succeeds:** second motion grammar, more than two visual materials, full score-to-math rule editor, independently routed per-track motion, more complex 3D, optional reverse draw→formula support where tested.

**P2 — not required for Kiroween winning hypothesis:** complex fluids, 100k GPU particles, boids/Kuramoto swarm, arbitrary fractals, live microphone transcription, AI orchestrators, full video encoder, NFT/blockchain integration, large plugin marketplace. Preserve these as Harmoglyph's future vision, not automatic rejection.

### Hard blockers and who can resolve them

| Risk | Severity | Next evidence / decision |
| --- | --- | --- |
| **Eligibility: new project** versus preexisting AI Studio work | **Critical** | Inspect creation/export history and first code; if substantive pre-Oct30 work appears, resolve rules with Devpost before continuing submission positioning |
| **Kiro execution not recorded** despite .kiro folder | **Critical** | Have Kiro implement real code and run current hook; save exact session/trigger/log |
| **Main and PR3 are not merged; Studio parity unknown** | High | Pin diffs, select integration base only after tests, avoid overwrite |
| **Visual art quality not good enough to share** | High | User-test 2 contrasting songs; focus hierarchy/smoothing/connections before effects |
| **No unified audio/visual clock** | High | Native lookahead scheduler, fixed-step timebase, measured playback/jitter |
| **Questionable originality** | High | Primary-source competitor matrix; narrow differentiation to verified abilities |
| **Overpromising “math is physics” or 1:1 audio visuals** | Medium–High | Label aesthetic mappings, source IDs, stable output contract |
| **Huge 69-item backlog under 16 days** | High | Work by W0–W5 gates, trace to IDs, defer P2 explicitly |

## 8. What would actually make this a top contender?

**Winning hypothesis (must be validated, not assumed):** The same musical phrase can be heard, seen as graceful interconnected motion, *changed in a way a person can understand*, and then saved as a cohesive work. A visitor can explain “this note/relationship made that happen,” and a judge can replay/check the claim without trusting narration.

**Three decisive judges' reactions we should optimize for:**
1. **Within 10 seconds:** “I understand what this helps me make and why it is different from a typical music visualizer.”
2. **Within 60 seconds:** “That is beautiful *and* the mathematical/musical relationship actually drives it.”
3. **Within 3 minutes:** “I can try it, reproduce the technical proof, see Kiro's real role, and keep the finished artwork.”

**No guaranteed win:** this framework is based on observed finalists and the published Kiroween rubric. We cannot know competitors' entries or judges' decisions. The roadmap is a falsifiable plan, not a prize prediction.

## 9. Governance / approvals

- Review and approve the **product promise and intended user**, **demo end state**, **winner-grade acceptance criteria**, and **which first motion grammar to test** before merging or changing production code. This document's presence **does not** approve implementation or release.
- Keep accepted findings, proposal status, and raw evidence attached to this same Harmoglyph doc/PR. Do not silently replace existing priorities, delete advanced math, or redefine the product as “a galaxy.”
- Next actual engineering work should start with **W0 eligibility & baseline**, followed by **W1 scheduler/Kiro proof**. If those fail, repair them before extending the art engine.

---
**Source references:** [R12](research/sources/deep-research-report-12-original.md) · [R13](research/sources/deep-research-report-13-original.md) · [69-item review queue](research/RESEARCH_12_13_SYNTHESIS_AND_REVIEW_CHECKLIST.md) · [Foundation Map](FOUNDATION_MAP_KIROWEEN.md) · [Compose & Art PR #3](https://github.com/Devpen787/Harmoglyph/pull/3) · [Kiroween 2026](https://kiroween.devpost.com/) · [2026 rules](https://kiroween.devpost.com/rules) · [Kiro hooks](https://kiro.dev/docs/hooks/).
