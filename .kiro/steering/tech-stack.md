---
inclusion: always
---

# Harmoglyph Tech Stack Steering

- **Runtime & UI**: React 19, TypeScript (strict `tsc --noEmit`), Vite 8, Tailwind CSS v4 (`@import "tailwindcss";`).
- **Backend Proxy**: Node.js + Express (`server.ts`) mounting Vite middleware in development and serving `dist/` in production on port `3000`.
- **AI Integration**: Server-side `@google/genai` SDK (`gemini-4-hydrogen`) only via `/api/formula/compose` and `/api/submission/pack`. Never expose `GEMINI_API_KEY` to browser code.
- **Visual Design Tokens**: Obsidian Lab aesthetic (`#07090E` ground, `#111622` surface, `#1F2A40` hairline borders, `#00E5CC` bioluminescent cyan, `#38BDF8` formula blue, `#F59E0B` active step amber, `#F43F5E` error crimson) with `tabular-nums` monospace precision.
- **Visualization**: Real-time SVG Lissajous plotter, live FM waveform scope, and D3 v7 interactive force-directed `.kiro` topology graph.
