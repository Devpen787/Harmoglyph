---
inclusion: manual
---

# Kiroween 2026 Manual Submission Steering (#kiroween-submission-guide)

Invoke this steering file on-demand in Kiro (`#kiroween-submission-guide`) when preparing Devpost submission text, demo scripts, or repository audits so it does not consume context tokens during routine coding turns:

1. **Mandatory Repository Checks**:
   - Root `/LICENSE` file (MIT) present and tracked.
   - `/.gitignore` preserves `/.kiro/` and excludes `.env*` secrets.
   - Public GitHub repository linked with `/.kiro/specs.json` and `/.kiro/agent.yaml` committed.
2. **Video Walkthrough (< 3:00 Hard Cap)**:
   - `0:00–0:35`: Live Frankenstein stitch demo (`A1:F48` formulas driving Web Audio FM synth + parametric SVG curve).
   - `0:35–1:15`: Switch mathematical foundations (`Fibonacci`, `Golden Ratio φ`, `Pythagorean`) and reverse-compile geometry into formulas.
   - `1:15–1:55`: Upload a score or edit a formula live, then export `.wav` and `.svg`.
   - `1:55–2:45`: Run the 500-trial seeded PBT suite and inspect the live D3 `SpecDependencyGraph` & `KiroFreeTierHub`.
