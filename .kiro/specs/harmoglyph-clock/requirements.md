# Harmoglyph — Audio/Visual Clock Requirements (W1)

**Status:** reviewable requirements prepared for Kiro; not proof that Kiro implemented them.
**Source:** winner roadmap W1, review checks E01–E05, B03–B04, D07, I02–I04, draft PR #3.

## Purpose
A composed song's note starts, playhead and visual note contributions shall be
derived from the same score and an explicit audio-time origin. Do not replace
the original formula engine, imply universal visual physics or reduce product scope.

### R1 — Single score and unit contract
WHEN a valid MusicalComposition and playhead beat are given,
THE SYSTEM SHALL derive an ordered list of distinct note events with onset in
beats and seconds, preserving track ID, note ID, duration, and simultaneous starts.

### R2 — Audio scheduling
WHEN playback begins from a user gesture,
THE SYSTEM SHALL establish one AudioContext-clock origin and schedule note
starts for a bounded future horizon without using display frame callbacks to
decide nominal audio onset time.

### R3 — Playhead
WHEN the display renders at irregular frame intervals,
THE SYSTEM SHALL compute the playhead from the same audio clock origin,
while preserving score ordering and preventing duplicate notes.

### R4 — Interruption and seek
WHEN a user pauses, edits, navigates away, or seeks,
THE SYSTEM SHALL cancel or safely end scheduled sounds and avoid unwanted
future notes. Resume semantics for partially held notes MUST be documented.

### R5 — Failure controls
IF the score, unit, or timeline parameters are invalid or non-finite,
THE SYSTEM SHALL reject them without corrupting the last valid composition.
Polyphonic scores MUST NOT be silently projected into the monophonic sheet.

### R6 — Verification honesty
WHEN Kiro, CI or the browser checks are recorded,
THE SYSTEM SHALL distinguish static/unit-test success from measured audio
output, human-perceived sync and successful execution inside Kiro.

### R7 — Preservation
WHEN the clock mechanism is reviewed or replaced,
THE SYSTEM SHALL preserve existing FM voices, formula VM, mathematical
foundations, vector exports, original 3D stage and new composer use cases.
