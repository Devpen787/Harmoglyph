# W1 Design — shared musical timebase (candidate implementation)

**Status:** implementation candidate in [draft PR #4](https://github.com/Devpen787/Harmoglyph/pull/4). This document is for **Kiro independent review and correction** rather than asserting Kiro authored the code.

- Authoritative score: existing draft PR #3 MusicalComposition.
- Transport conversion: startBeat and bpm -> relative seconds via 60/bpm.
- Event scheduler: CompositionLookaheadCursor.pull(elapsedAudioSec, horizon=0.18)
  emits each note once in deterministic event order, including concurrent tracks.
- Audio: ChimeraAudioEngine.scheduleStepAt(note, absolute AudioContext seconds),
  preserving the existing FM synthesis instead of introducing Tone.js.
- UI: 30 ms look-ahead poll only queues future notes. Actual audible onset
  is set with Web Audio start(audioTime), independent of poll callback timing
  unless the poll becomes late.
- Visual playhead: requestAnimationFrame only samples the AudioContext-clock
  position. It does NOT trigger notes. Frame skipping changes visual cadence,
  not target sample timestamps.
- User gesture and safety: preparePlayback(0.15s) unlocks the context and
  reserves a short start lead; stopScheduledNotes() cancels scheduled sources.
- Known limitations: sound envelopes currently approximate arbitrary note
  duration; effect delay can retain a tail; recent notes that started before
  a seek are not reconstructed; hidden-tab resume and output latency have not
  been independently tested in a browser. The original sheet player is still
  setInterval-driven and is outside this first composer-only spike.

**Critical Kiro review question:** Do late callbacks, hidden tab suspension,
rapid pause/resume and browser unlock behavior preserve the event invariant?
Add virtual-clock and mocked AudioContext tests before claiming improvement.

**No zero-latency guarantee.** Hardware/different browser display onset timing
requires measurement, not a formulaic assumption.
