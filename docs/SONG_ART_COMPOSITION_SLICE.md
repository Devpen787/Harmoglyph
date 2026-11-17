# Harmoglyph — one score, five perspectives

Status: **working first integration slice**, not a completed release or verified hackathon submission. This document describes the implementation in `codex/unified-song-art-slice` and records explicit limitations for review.

## Why

The earlier five experience mockups (one motif, build a piece, full show, song → art, and Math Lab) showed promising visual directions but did not share a score. Their artwork could read as attractive squiggles rather than transparent mathematics. The new Compose & Art mode is the connective tissue for the existing spreadsheet instrument, not a replacement for it.

## Product journey

1. **One note** — "Start with one note" loads *First Mark*, shows its one-to-one mark, and lets the user audition and edit it.
2. **Build a piece** — add notes, change pitch, onset, duration, velocity, title, or tempo; add another musical voice; the same data drives score, sound, visual art, and math inspector. Valid drafts are preserved in this browser's local storage; JSON export is also available.
3. **Understand** — select a note and read its frequency, ratio, angular onset, angular length, visual radius and width. Distinguish the actual music values from our choices of visual grammar.
4. **See the full show** — "See a finished song + show" loads *Glass Garden* in presentation mode. Play reveals the artwork in time, while Complete art previews the final object.
5. **Explore the instrument** — a supported monophonic song is projected into the existing formula-grid/3D stage, while the original formula editing, presets, verification, and Kiroween surfaces remain accessible in navigation.

## Single canonical composition

`src/engine/composition.ts` defines the canonical score in terms of note onset, duration, MIDI pitch, velocity, track/voice, tempo, meter, and 12-tone equal temperament. The formulas for visible geometry are deterministic:

- `frequencyHz = 440 × 2^((MIDI − 69) / 12)`.
- `ratioToRoot = frequencyHz / frequencyHz(referenceMidi)`.
- `startAngle = −π/2 + 2π × onsetBeats / totalBeats`.
- `sweepAngle = 2π × durationBeats / totalBeats`.
- `radius = clamp(105 + 3.8 × (MIDI − 48) + 10 × trackIndex, 64, 268)`, keeping notes within the canvas.
- `strokeWidth = 3.5 + 5.5 × velocity`.
- The inspector additionally reports the first five integer harmonic partial frequencies, *not* measured overtones.

The **first four quantities** are derived from the score and the selected tuning. The geometry's *visual scale*, colors, stroke width curve, arc/bloom/weave grammar and glow are **artistic design choices** applied consistently to those values. No cymatics or acoustic measurement is claimed. Changing a mark's visual grammar does not change its note or timing.

## Built-in comparison set

| Score | Purpose | Sound/visual invariant |
|---|---|---|
| First Mark | Single-note first-run explanation | One source note → one mark |
| Glass Garden | Multi-phrase completed song | Consecutive notes build one coherent ring |
| Ascending Light | Controlled pitch sweep | Increasing pitch increases frequency and radius |
| Pulse Study | Repetition/rhythm | Repeated notes give repeated radii at different angles |
| Leap Dialogue | Counterpoint | Simultaneous notes survive as separate marks and voices |

## Handoff limitation

The existing A1:F48 engine represents an eighth-beat step sequence with a **single timbre**. Monophonic songs can be projected into it as onsets, velocity gates and approximate envelope decays. They do **not** preserve arbitrary note-length envelopes exactly, or the multiple simultaneous voices of polyphonic songs. To avoid silent loss, transfer is disabled if notes overlap or use distinct tracks/timbres. The new composition mode itself retains both voices.

The existing Web Audio synth has a constrained amplitude envelope; long durations are approximate acoustically even though the score, timing and visual arc record the full duration. The UI must not promise precise sustain, physically faithful cymatic geometry, or lossless bidirectional editing at this stage.

## Verification and evidence

- `npm run lint`: TypeScript compile validation.
- `npm run test:composition`: deterministic pitch/time/shape mapping, five sample scores, old spreadsheet integration and polyphony/different-voice negative controls.
- `npm run build`: production bundle.
- `.kiro/hooks/pbt-on-formula-save.json`: typecheck + composition tests + existing seeded PBT, five groups × 100 trials (500 total).
- Separate pre-existing server smoke tests cover health/audit/hook APIs; the new composer has no new API dependency.

### Open release gates

- Review in an accessible, running browser for layout at desktop/mobile sizes, audio permission/unlocking, score editing and note hit-targets. The local shell server is not currently reachable from the shared Cloud browser; automated builds are **not** proof of visual UX or sound quality.
- Independent listening comparison of the five scores, including the simultaneous counterline, with particular attention to note duration and timing drift.
- Check SVG and JSON downloads in a real browser; validate exported SVG round-trip and keyboard navigation.
- Decide whether genuine user-authored formula grammars are a v2 creation mode; the present composer exposes **traceable mappings**, not an arbitrary formula programming language.
- Kiroween participation has separate provenance requirements: the repository's `.kiro` assets and hooks are not evidence that this change was actually built with the Kiro IDE/CLI. Kiro execution and judge-access confirmation must be supplied from an environment where Kiro is available.
- Review source scope and merge only after approval. This is not an assertion of 100% hackathon compliance.
