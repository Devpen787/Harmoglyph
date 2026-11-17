---
inclusion: fileMatch
fileMatchPattern: "src/engine/**/*.ts"
---

# Audio Safety & Spreadsheet VM Contract

1. **Cycle Termination Guarantee**:
   Every cell evaluation in `spreadsheetVm.ts` MUST maintain a recursion `visiting` set. Any cycle (direct or transitive) MUST terminate immediately, record `#CYCLE!`, and yield a finite numeric fallback (`0`).
2. **Acoustic Safety Clamps**:
   - Carrier frequency `freqHz` clamped strictly to `[20, 4000]` Hz.
   - Trigger gate `gate` clamped strictly to `[0, 1]`.
   - FM modulation index `fmIndex` clamped strictly to `[0, 12]`.
   - Envelope decay `decayMs` clamped strictly to `[40, 900]` ms.
   - Modulator ratio `modRatio` clamped strictly to `[0.25, 8]`.
   - Peak audio gain MUST never exceed `0.35` in live Web Audio or `0.95` peak normalized PCM in offline `.wav` rendering.
3. **Binary RIFF/WAVE Integrity**:
   Offline `.wav` export MUST emit an exact 44-byte `RIFF` / `WAVE` / `fmt ` / `data` PCM header with byte length matching `44 + dataByteLen`.
