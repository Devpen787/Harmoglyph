# Executive Summary

We approve pursuing **Harmoglyph** as an integrated audio‐visual instrument, but with tightened scope and clearer architectural choices. In summary:

- **Music–Visual Coupling:** We will treat the input as a *symbolic score* (discrete notes with pitch, time, duration, etc.) rather than raw audio. This makes the mapping to visuals transparent and deterministic. Web Audio (e.g. Tone.js Transport) will be used for precise scheduling, but we will anchor animation to the audio clock (AudioContext.currentTime) to avoid drift. 
- **Motion Solvers:** We will support a small number of well-understood motion grammars, such as **parametric oscillators (Lissajous/harmonograph)**, **damped springs**, and **simple flocking (Boids) or flow fields**. Each has a clear formula (e.g. Hooke’s law or Kuramoto’s sine coupling) and gives musically meaningful behavior. We will **not** adopt arbitrary complex systems (like golden-angle phyllotaxis) without justification; phyllotaxis is a beautiful pattern, but it is essentially an optimization of packing rather than a music-driven rule.  
- **Rendering:** Initial rendering will use Canvas2D/SVG (via D3) for ease and inspectability, with optional WebGL (Three.js) for richer 3D scenes. All major libraries (Tone.js, D3, Three.js) are MIT-licensed, so re-use is safe.  
- **Verification & Testing:** We will build *property-based tests* and unit tests for all deterministic behaviors (e.g. “same score → same pattern”). We will *deliberately inject* a known bug (e.g. mis-scaling by 100x) to verify the test suite catches it. We will define clear invariants (e.g. “silence produces no motion”, “tempo scaling preserves shape”) that automated tests must check.  
- **Risk-First Prototyping:** Early prototypes will target core kernel functionality (score→oscillator→point positions) before fancy UI. For example, we will first prove “one note = one parametric curve” and “two interacting notes give the expected Lissajous loops”.  

**Verdict:** It is feasible and promising, provided we narrow focus to achievable core features and validate each step (in the spirit of the ETHWinner audit). We make *one hard promise* – “**verified determinism:** for any given input score (and random seed, if any), the same audio-visual output will result every time” – and back it with tests. Complex aesthetic aspects (e.g. “beauty of swirl”) will be acknowledged as subjective and handled via user evaluation (since they can’t be unit-tested). This ADR documents all decisions, alternatives, and plans, with citations to authoritative sources.

---

## Reviewed Claims

- **Harmoglyph Implementation (Verified):** The project as described uses a 48-row formula sheet (columns: pitch, gate, modulation, spatial, decay, harmonic ratio) controlling all outputs. It generates sound with a **web‐audio FM synthesizer** and produces vector 2D art (harmonographs, ribbons, spirals) plus a Three.js 3D stage.  These claims come directly from the project description and have been *implicitly verified* by inspecting the Devpost write-up and technology list. We will treat them as factual for planning. 

- **Property-Based Tests (Reported):** The Devpost notes that *deterministic PBT code covers formula cycles, audio bounds, CSV and WAV formats, etc.*. We have not seen the repository, but we infer that some testing is planned. We will verify this when code is available. 

- **Lissajous/Harmonograph Equations (Verified):** The plan is to use Lissajous-type or harmonograph patterns. The mathematics is well-established: a Lissajous curve arises from two perpendicular sine oscillators, e.g.  
  ```  
  x(t) = A_x e^{-d_x t} sin(f_x t + φ_x),  
  y(t) = A_y e^{-d_y t} sin(f_y t + φ_y)  
  ```  
  (possibly with damping factors d_x,d_y).  These formulas are correct and can produce rich patterns.  

- **Phyllotaxis/Golden Angle (Questioned):** The report suggests mapping phrases via a golden‐angle spiral. In botany, using a golden angle (~137.507°) indeed gives an optimal packing, but *this is a design choice*, not an inherent musical law. No primary source links the golden angle to melody structure. We classify the golden‐angle mapping as **aesthetic/inferred**, not strictly “true.” It may be used as a visual motif, but we will not treat it as a musical mapping without user justification. 

- **Kuramoto/Bohids/Curl Noise (Verified):** These are standard motion models. Kuramoto’s oscillator model (synchronizing phases via sinusoidal coupling) is given by  
  $$\frac{d\theta_i}{dt} = \omega_i + \frac{K}{N}\sum_{j=1}^N\sin(\theta_j-\theta_i)$$  
 . Boids uses simple rules of separation, alignment, cohesion. Curl-noise flow fields (taking curl of a 3D Perlin noise vector field) produce a smooth incompressible flow. We accept these as mathematically valid options. The question is not their correctness, but whether they are musically useful; that we will judge in UX testing. 

- **Spectral-Centroid vs Pitch (Clarified):** The report mentions spectral centroid. In audio analysis, the **spectral centroid** is defined as the weighted mean frequency of a spectrum, which correlates with “brightness.” It is *not* a direct proxy for musical pitch. Since we work with discrete notes, we will use the **symbolic pitch** (e.g. MIDI note or frequency) for mappings, not spectral features (which would be redundant). This corrects any confusion in the report: spectral features are mostly for timbre analysis, not needed for note‐based animation. 

- **Deterministic Playback and Sync (Qualified):** The report implies perfect synchronization (millisecond-level). In reality, Web Audio scheduling is **sample-accurate**, but actual sound output can have device latency. Tone.js Transport offers sub-ms scheduling by abstracting AudioContext times. We will aim for precise scheduling (Tone.js or AudioBufferSourceNode with start(time)), but we *warn* that absolute hardware latency (audioContext.baseLatency/outputLatency) may differ and cannot be fully eliminated. We will measure and compensate for drift but make no impossible promise of zero-latency. 

- **Performance Targets (Inferred):** No formal claims were found about frame rate or polyphony. We infer the goal is real-time (≈60 FPS) for modest complexity (tens–hundreds of points). We will define realistic budgets: e.g. 1000 points at 60 FPS on a recent laptop, with fallbacks (reduce detail) if exceeded. 

- **Library Licenses (Verified):** Core libs are open-source: React, D3, Three.js, Tone.js, etc. Tone.js is MIT-licensed. Hydra (if considered) is also MIT, whereas Max/TouchDesigner are proprietary. We will stick to MIT/BSD components to ensure compatibility. 

- **Originality Claim (Inferred):** The report claims *“none combine these features”*. We did not find any existing product that tightly couples spreadsheet music, vector art, and 3D. There are related demos (Hydra for live visuals, or music-viz apps), but none exactly this. This seems plausible but is an *unverified assertion*. It does not affect our design except to justify that we are in new territory. 

In summary, **verified claims** (with sources) include the correctness of oscillatory motion equations, scheduling precision via Web Audio/Tone.js, and known properties of phyllotaxis. **Inferred claims** (plausible but unproven) include the exact usage of golden-angle in mapping and the uniqueness claim. **Unverified claims** (needing evidence) include any performance numbers and the actual content of the repository. We will validate these during development (e.g. by inspecting code or profiling). 

## Alternatives Matrix

We consider multiple design dimensions and compare alternatives:

- **Music Representation:**  
  - *Discrete Score (chosen):* Represent music as an array of note events `(time, pitch, duration, velocity, etc.)`. This matches the 48-step spreadsheet model and is easy to map. It allows symbolic operations (transposition, tempo changes).  
  - *Raw Audio/Sample:* Play an existing WAV/MP3 and extract features (FFT, onsets). This is **rejected** for now: it adds complexity (need real-time analysis) and is less controllable. We aim for generative composition, not fixed tracks.  
  - *Custom DSL/Formula:* The existing spreadsheet *is* a DSL. We can either use it directly or convert it to note events internally. We will import the formula values as parameters (pitch, gate, etc.) into our score structure.  

- **Audio Synthesis:**  
  - *Tone.js Transport (chosen):* Provides a timeline in musical units (bars/beats) and sample-accurate scheduling. It simplifies tempo changes and scheduling callbacks. (License: MIT.)  
  - *Web Audio API directly:* More manual but no extra dependency. We could create OscillatorNodes or AudioBuffers. This is viable (and may be needed for custom FM), but scheduling has to use `audioCtx.currentTime`.  
  - We decide to prototype with Tone.js for speed, with fallback to raw API if needed. All sound parameters will ultimately come from our score data.  

- **Visual Mapping Rules:**  
  - *Geometry via Parametric Curves:* Map note parameters to curve equations. For example, let each note define an oscillator with frequency = `pitch * harmonicRatio` and draw x,y from sine/cosine. This yields smooth “harmonograph” visuals.  
  - *Spatial Layout:* Map pitch → radius or height, time → angle. (E.g. polar plots or spirals). Golden ratio could be used to distribute points, but we will use it only if musically meaningful (perhaps for radial spacing) not just arbitrarily.  
  - *Color/Style:* Map musical features (pitch, volume, interval) to color/hue or line thickness. These are design choices but should be parametric (e.g. hue = f(pitch)).  
  - We will **explicitly document** each mapping (see Data Contracts below) and allow it to be changed. No single rule will be hardcoded except a basic one (e.g. higher pitch → shorter period).  

- **Motion Solvers (Dynamics):**  
  - *Parametric Oscillators (Lissajous/Harmonograph):* Each note spawns a decaying sine-based motion. This directly ties time and pitch to a path. **Decision:** Implement at least one “harmonograph” mode.  
  - *Coupled Oscillators (Kuramoto-inspired):* Notes as phases θ_i with coupling constant K, evolving by sin-differences. Can create synchronized patterns (e.g. pendulum-like). **Decision:** Consider as an advanced mode (requires tuning K).  
  - *Spring-Mass Systems:* Treat notes as masses connected by springs (Hooke’s law). Can smoothly interconnect notes in sequence or harmony. **Decision:** Include a simple 1D spring for pitch-time (like mass at pitch position). This produces harmonic oscillation and is intuitive.  
  - *Boids (Flocking):* Use separation/alignment/cohesion rules. Could let “note-agents” swarm. **Decision:** Only if time permits, as a demo mode; it is less musically intuitive.  
  - *Flow Fields (Curl Noise):* A global fluid-like field to advect particles. Visually pleasing (eddy patterns) but disconnected from music semantics. **Decision:** Defer to future work (it adds complexity and no immediate musical mapping).  

- **Rendering Technology:**  
  - *SVG/Canvas (chosen initially):* Great for crisp lines and easy hit-testing. For up to ~500 objects, 2D Canvas or SVG (via D3) is sufficient. The prototype already mentions D3/SVG.  
  - *WebGL / Three.js:* Better for many thousands of points or real 3D shapes. The project uses Three.js for 3D views. **Decision:** Use Three.js only for the 3D mode or if we need instanced geometry. For 2D we stick to Canvas/SVG for simplicity and inspectability. All chosen libraries (D3, Three, Tone, etc.) are MIT-licensed, so no license conflicts.  
  - *Performance/Graceful Degradation:* If GPU is weak or WebGL unavailable, fall back to 2D. We will ensure the core is decoupled so we can disable fancy visuals and keep sound running (or vice versa) gracefully.  

- **Audio-Visual Synchronization:**  
  - *AudioContext as Clock:* We will use the audio context’s high-resolution clock. For visuals, either use `requestAnimationFrame` but compute all positions based on the authoritative audio time (e.g. `t = audioCtx.currentTime`). This approach (cf. [27]) aligns visuals to audio without relying on setTimeout precision.  
  - *Alternate:* Tone.js has a `Tone.Draw.schedule()` method that synchronizes drawing with its Transport. We can use that if using Tone.js.  
  - *Decision:* Anchor all simulation steps to `audioCtx.currentTime`. We do fixed-step updates (e.g. 60 Hz or as needed) so that outputs are deterministic. The RAF loop will interpolate between steps if needed, but state updates use fixed intervals. This ensures **deterministic, sample-accurate timing**.  

- **Export (WAV/Video):**  
  - *Audio:* We will record output as WAV by rendering the AudioBuffer (most Web Audio libraries offer buffer export). That can be done sample-accurately.  
  - *Video:* We may support frame-by-frame rendering to create a video (e.g. using `canvas.captureStream()`), but performance may limit frame rate. We will not guarantee >30 FPS video export for high-res without quality loss – instead we may sample at 30 FPS. Any video sync will still be based on the AudioContext timeline.  

- **Licensing and Reuse:**  
  We plan to reuse existing modules wherever possible: Tone.js (MIT), Three.js (MIT), D3 (BSD), etc. These are compatible and widely maintained. We will avoid any GPL libraries to not complicate distribution. (Hydra, Chromat, and similar creative-code tools are interesting, but they are specialized live-coding frameworks and don’t directly solve our problem.)  

The above alternatives were carefully weighed. In each case, we select the most practical option (marked “*chosen*”) and *justify it*. For example, we choose symbolic score representation because it aligns with the spreadsheet formula model and is easy to reason about (unlike raw audio FFT which would require complex mapping). We choose Tone.js for scheduling because it is battle-tested for music apps. We will explicitly **document each chosen mapping** so that it can be tested and tweaked.  

## Decided Design and Rejected Options

1. **Score vs. Audio** – **Decision:** Use a discrete event score (e.g. JSON list of notes).  
   **Reason:** Enables direct control of musical structure and easy mapping to visuals. Raw audio analysis is not needed and would hurt determinism.  
   **Rejected:** Live audio input or analysis, as it falls outside hackathon scope and adds latency/complexity.

2. **Time Representation** – **Decision:** Internally use audioContext time (seconds) or beats. Tempo is an explicit parameter.  
   **Reason:** Tone.js Transport can work in musical time, but we will compute everything in real seconds behind the scenes.  
   **Rejected:** Relying on `setTimeout` or JS timers, which are imprecise.

3. **Musical Parameters** – **Decision:** Keep the original formula columns. Define a typed data contract (see below) so each parameter’s role is explicit (pitch → frequency, gate → amplitude envelope, etc.).  
   **Reason:** This retains the powerful spreadsheet approach while making mapping explicit.  
   **Rejected:** Implicit heuristics (e.g. “first column is always pitch, second is always velocity”) without clear specification.

4. **Motion Grammar** – **Decision:** Start with **Harmonograph (oscillators)** for melodic lines, plus a **1D spring** for rhythm/pitch binding. Optionally implement a simple **Boids** mode (flocking) as a “bonus”.  
   **Reason:** Harmonographs directly reflect pitch ratios. Springs provide a physically intuitive “rubber band” linking notes. Boids can create pleasing motion without complex tuning.  
   **Rejected:** Kuramoto for primary mode (too abstract) and fluid/curl noise (too indirect) – these may be added later only if core is solid.

5. **Visual Technology** – **Decision:** Use Canvas/SVG for 2D and Three.js for 3D.  
   **Reason:** D3/SVG was already part of the plan, and Three.js is ideal for 3D scenes. Both are open-source and well-maintained.  
   **Rejected:** Canvas2D only (not needed for 3D), or WebGL-only (overkill for 2D graph). No library is being avoided except any non-JS environment.

6. **Synchronization** – **Decision:** Drive visuals from the AudioContext timeline. E.g. in each RAF callback, compute `t = audioCtx.currentTime` and update all animated positions for that time. Optionally use `Tone.Transport.schedule()` for drawing.  
   **Reason:** This method is known to yield tight sync. Tone.js explicitly uses AudioContext under the hood for sub-ms accuracy.  
   **Rejected:** Having separate clocks or ignoring audioContext; that would break audio-visual coherence.

7. **Deterministic Simulation** – **Decision:** Implement the simulation with fixed time steps (e.g. 1/60 s per tick). The rendering layer interpolates if needed.  
   **Reason:** Fixed steps ensure reproducibility (every run steps the same way). We can tie them to AudioContext (e.g. step for each new 1/60s of audio time).  
   **Rejected:** Tying simulation solely to RAF, since frame rate can vary and cause nondeterminism.

8. **Export and Persistence** – **Decision:** Provide WAV export via offline AudioBuffer rendering. For visuals, either export keyframes or allow screen-record. The core data (score + mapping) can be serialized (e.g. JSON).  
   **Reason:** These cover the hackathon criteria. We will not promise a foolproof video export pipeline (that’s outside current scope).  
   **Rejected:** Real-time video encoding or server-side render, as beyond browser scope.

9. **Scope Guardrails:** We explicitly **limit** input to *self-contained web components*: no external APIs (auth, DB) or multi-server. If any AI assistance (e.g. Kiro/Gemini) is used, its output will be validated by our tests.

Overall, each decision is deliberate. For example, we **choose not** to blindly follow the original “golden-angle” idea. Instead, we will evaluate if any golden-ratio mapping makes musical sense (e.g. maybe use φ for rotation per beat if it feels good, but not because “it’s a fractal rule”). 

Where we reject an alternative, we note it. E.g. **We reject using spectral analysis** as a feature extractor – if in future someone asks “can this animate a microphone input?”, we would handle that separately. For now, any *requirement* not explicitly decided is considered outside our MVP.

## Data Contracts (Typed Schemas)

We define canonical JSON/TypeScript-like contracts to ensure clarity and testability. These will guide both code and documentation. Example schemas:

```ts
interface NoteEvent {
  /** Time offset from start (in seconds) */
  time: number;
  /** MIDI note number (0–127) or frequency (Hz) */
  pitch: number;
  /** Duration of the note (in seconds) */
  duration: number;
  /** Gate (0 or 1) indicating note off/on (optional if duration suffices) */
  gate?: number;
  /** Amplitude or velocity (0–1) */
  velocity?: number;
  /** Additional modulation or harmonic ratio (unitless factor) */
  modulation?: number;
  /** Spatial pan (-1 left to +1 right, if stereo) */
  pan?: number;
}
```

```ts
interface Score {
  notes: NoteEvent[];
  /** Tempo in beats per minute */
  tempo: number;
  /** (Optional) Time signature or other metadata */
  meter?: { beatsPerBar: number, beatUnit: number };
}
```

```ts
interface MappingRule {
  /** Source parameter name (from NoteEvent or derived features) */
  source: 'pitch' | 'time' | 'duration' | 'interval' | 'velocity';
  /** Target graphic property or formula variable */
  target: 'x' | 'y' | 'radius' | 'angle' | 'color' | 'size' | 'phase';
  /** Scaling or transformation function expressed as JavaScript code */
  transform: string; // e.g. "value => value * 10" or "Math.log(value+1)"
}
```

```ts
interface MotionGrammar {
  /** Type of motion system */
  type: 'harmonograph' | 'spring' | 'boids' | 'rotation';
  /** Parameters for the system */
  params: {
    /** Amplitude of oscillation */
    amplitude?: number;
    /** Frequency multiplier (for harmonograph) */
    freqRatio?: number;
    /** Damping factor (for decays) */
    damping?: number;
    /** Spring constant k (for spring) */
    k?: number;
    /** Damping c (for spring) */
    c?: number;
    /** Boids alignment weight */
    alignment?: number;
    /** Boids cohesion weight */
    cohesion?: number;
    /** Boids separation distance */
    separation?: number;
    // ...etc
  };
}
```

```ts
interface VisualizationSpec {
  score: Score;
  mapping: MappingRule[];
  grammar: MotionGrammar;
  /** Rendering options, e.g., 2D vs 3D */
  render: { mode: '2D' | '3D', width: number, height: number };
}
```

**Provenance:** In practice, a “Score” may come from the spreadsheet formula (read by our spreadsheet parser) or user entry. For example, a 2-row score might be:  

```jsonc
{
  "tempo": 120,
  "notes": [
    { "time": 0.0, "pitch": 60, "duration": 0.5, "velocity": 0.8, "modulation": 0.2 },
    { "time": 0.5, "pitch": 64, "duration": 0.5, "velocity": 0.7, "modulation": 0.5 }
  ]
}
```

A mapping could be:

```js
const mapping = [
  { source: "pitch", target: "angle", transform: "v => v * (Math.PI/12)" },
  { source: "time", target: "radius", transform: "t => 50 + 20*t" },
  { source: "velocity", target: "color", transform: "v => `hsl(${v*120},80%,50%)`" }
];
```

And a grammar:

```js
const grammar = {
  type: "harmonograph",
  params: { amplitude: 1.0, freqRatio: 1.0, damping: 0.05 }
};
```

These contracts allow automated checks. For example, a test can verify that a NoteEvent’s `pitch` in [0,127] and `duration`≥0, or that the transform functions are valid JS. They also serve as documentation: every data field has meaning. In code, we will use TypeScript interfaces or JSON schema to enforce these.

## Motion Grammars and Equations

We present **two specific motion grammars** (plus notes on a third) that tie musical data to motion, each with mathematical formulation:

1. **Damped Harmonic Oscillators (Harmonograph):**  
   Each note spawns an oscillator in **X–Y plane**. For note *i*, let its pitch determine an angular frequency ω_i (e.g. linear mapping or just use midi→Hz). We can draw a Lissajous-style curve by using *two* decaying oscillators, one for X and one for Y:

   \[
   \begin{aligned}
     x_i(t) &= A_i\,e^{-d_i t}\sin(\omega_{x,i} t + \phi_{x,i}),\\
     y_i(t) &= B_i\,e^{-e_i t}\sin(\omega_{y,i} t + \phi_{y,i}),
   \end{aligned}
   \]

   where \(A_i,B_i\) are amplitudes (maybe derived from velocity or modulation), \(d_i,e_i\) are damping factors, and \(\omega_{x,i},\omega_{y,i}\) could be the same or harmonic multiples of the note’s base frequency. For example, one oscillator could use the fundamental (ω) and the other an overtone (ratio R). This yields classic Lissajous/harmonograph figures. We can control stability by adjusting damping and ensure smooth stops.

   *Stability Control:* Damping \(d_i,e_i\) > 0 ensures motion eventually decays (stable equilibrium). Amplitudes \(A_i,B_i\) can be linked to volume or set constant. Phase offsets \(\phi_{x,i},\phi_{y,i}\) allow displacing the curve. This grammar smoothly converts each note into a graceful curve.

2. **Spring-Mass Chain:**  
   Treat notes as *masses* placed along a line (or circle) with springs between successive notes. For simplicity, map each note *i* to a 1D position \(x_i\) (for instance \(x_i\) ∝ pitch or time). Each mass obeys Hooke’s law and damping:

   \[
   F_i = -k (x_i - x_{i-1}) + k(x_{i+1} - x_i) - c\,v_i,
   \]
   \[
   \ddot{x}_i = F_i / m,
   \]
   
   where \(k\) is the spring constant and \(c\) the damping (friction). The endpoints can attach to fixed walls or loop around. This yields oscillatory adjustments around the rest configuration. We can visualize this by drawing each mass and spring, or by moving points representing notes along x (or both x,y for 2D spring systems). 

   *Stability:* With \(k>0\) and \(c>0\), this is a damped linear system (harmonic oscillator network) that will settle without blow-ups. By tuning \(k\) and \(c\), we control elasticity vs rigidity. This is easy to implement and provides intuitive cohesion between notes.

3. **(Optional) Boids/Flocking:**  
   Each note is an agent with position \(\mathbf{p}_i\) and velocity \(\mathbf{v}_i\). On each timestep:
   
   \[
   \mathbf{v}_i \leftarrow \mathbf{v}_i 
     + a[\underbrace{\text{(centering)} }_{\textstyle \propto (\bar{\mathbf{p}} - \mathbf{p}_i)} 
     + \underbrace{\text{(alignment)}}_{\propto (\bar{\mathbf{v}} - \mathbf{v}_i)} 
     + \underbrace{\text{(separation)}}_{\displaystyle \sum_{j\ne i} \frac{\mathbf{p}_i - \mathbf{p}_j}{\|\mathbf{p}_i-\mathbf{p}_j\|^2}}],
   \]
   then \(\mathbf{p}_i \leftarrow \mathbf{p}_i + \mathbf{v}_i\,dt\). Here \(\bar{\mathbf{p}},\bar{\mathbf{v}}\) are local averages. The constants \(a\) weight the rules. This produces emergent flocking/swarming motion. Because it’s heuristic, we treat boids as an advanced “sandbox” mode. It is flexible but less directly tied to melody (we might drop musical data as initial positions or desired headings). 

   *Stability:* To avoid chaotic divergence, one typically normalizes or limits \(\mathbf{v}_i\) (max speed) and strongly weights separation to prevent collisions. The boids rules by design produce a stable flock if tuned (original source code used them for natural-looking motion). 

These formulas will be implemented in code as part of the animation loop. For each selected grammar, we will have parameters (e.g. damping, spring constant, boids weights) that can be tweaked. We will embed these equations in comments and documentation so that they are testable (e.g. we can compute expected equilibrium states).

## Simulation vs Rendering

To ensure reproducibility and sync, we adopt a **fixed-step simulation strategy**:

- We will advance the motion simulators (oscillators, springs, boids) at fixed small time increments (e.g. Δt = 1/60 second) tied to the audio clock. Specifically, at each RAF callback or audio callback, we compute the target audio time `t = audioCtx.currentTime` and run the simulation loop forward from the last time to `t`, stepping by Δt. All state updates (positions, velocities, oscillator phases) occur in these fixed steps. This deterministic stepping (with no randomness except a fixed seed) guarantees that given the same inputs, the exact same state sequence results.  

- For rendering, we use *interpolation* within each step if needed. For example, if the display refreshes at 75 Hz but our simulation step is 60 Hz, we can interpolate linearly between the last and next simulated state based on fractional time. This hides jitter without changing physics. The user will not notice the stepping since we render smoothly at 60+ FPS.

- Using `requestAnimationFrame` alone to drive physics is rejected because it’s variable. Instead, we either:
  - Use `Tone.Draw.schedule()` if employing Tone.js (which triggers callbacks aligned with audio samples).  
  - Or manually compute `audioCtx.currentTime` in each RAF to know exactly how far to simulate.

In practice, a pseudocode loop is:

```js
function updateFrame() {
  const t = audioCtx.currentTime;
  while (lastSimTime + deltaT < t) {
    simulateStep(deltaT); 
    lastSimTime += deltaT;
  }
  // Optionally interpolate for the overshoot time
  renderScene();
  requestAnimationFrame(updateFrame);
}
```

This ensures visuals never outrun the audio and always lag by at most one step. It also means that the visual progression of notes will precisely match the scheduled audio events. We will **validate sync** by measuring timestamps (e.g. log the actual oscillator start times vs render marks) to ensure drift is within a few ms. We cite that methods like this can achieve sample-level sync.

## Audio-Clock Synchronization

Given known browser audio behavior, our strategy is:

- **Scheduling**: Pre-schedule all audio events using the AudioContext (or Tone.Transport) well ahead of playback. Tone.js will let us say “play Note C at beat 1” and handle the mapping to `audioCtx.currentTime`. This yields *sample-accurate* timing.

- **Playback**: We begin Tone.Transport (or start the AudioContext) once setup is done, so `audioCtx.currentTime` starts ticking from 0. If using Tone, we call `Tone.Transport.start()` at time 0 (or after a brief delay).  

- **Visual Drive**: In the render loop, use `audioCtx.currentTime` as the single source of truth for “current position” in the score. For example, compute a playhead beat = `time * (tempo/60)` and highlight the corresponding note in the sheet. Move particles according to the formulas at that `time`.

- **Latency Compensation**: There will be an initial audio output latency (the device delay). We may detect this via `audioCtx.baseLatency` or by measuring (e.g. play a click and measure when the `ended` event fires). We can introduce a fixed offset so visuals don’t start too soon. For example, if baseLatency is 20 ms, we wait that long after `start()` before animating. However, as pointed out by experts, after the first buffer all subsequent scheduling has no additional offset. We will simply measure the first-beep delay via experiments and subtract it.

- **No False Promises**: We will not promise absolute millisecond perfect audio-visual lock under all hardware. Instead, we measure and log the sync error in testing. If needed, we will expose a manual audio/video “sync” slider as a fallback (as one commenter did). But our design goal is to rely on AudioContext to drive both mediums.

Invariants to test: the **time difference** between an audio event (e.g. oscillator start) and its visual cue (e.g. highlight) should be near zero (within a few ms) across multiple browsers/systems. If it drifts, our tests (see below) will catch discrepancies (e.g. “the nth note started an average of X ms before highlight”). The architecture explicitly avoids using two independent timers (no `setInterval` separate for visuals) to sidestep drift.

## Testable Invariants and Cases

We will define a suite of invariant tests to validate core behavior. These include:

- **Consistent Input → Output:** Given the same `Score` and mapping, two runs produce bitwise-identical outputs (we can check deterministic JSON state or compare rendered frames). This verifies “no randomness” leaks in our sim.

- **Same Score, Different Style:** If we change only the **MappingRule** (e.g. a pitch-to-angle factor), the *audio* must remain identical. Visually, the structure will rotate or scale differently, but the underlying motion curves should still have the same shape (just transformed). We’ll test that audio buffers match and that key visual metrics (e.g. number of loops) stay consistent.

- **Different Score, Same Style:** Using two different musical scores with identical mapping, the *visual patterns* should differ accordingly. For example, “twinkle twinkle” vs “row your boat” should produce distinguishable curves. We will verify by either visual diffing or by checking property-based features (e.g. length of path correlates with total duration).

- **Silence (All notes off):** Should produce no sound and no visible motion. We test that a blank score yields a silent WAV and a blank canvas.

- **Repeated Notes/Unison:** If all notes have the same pitch, the visual should exhibit symmetry (e.g. particles on top of each other or a single path). We can test that all simulated positions coincide when pitches are identical.

- **Tempo Variation:** Doubling tempo should halve durations but preserve shape. We will test that doubling `tempo` and halving each note `duration` leads to the same position-vs-time trajectories (i.e. shapes are time-compressed). 

- **Polyphony:** Overlapping notes (chords) should produce multiple simultaneous curves or particles. Our invariant: the combination of two notes played together should equal overlaying each note’s output (linearity in at least the visual domain). For audio, mixing should sum. We can play a chord and compare to mixing the separate notes’ audio buffers.

- **Invalid Input Handling:** E.g. a negative duration or pitch outside [0,127]: our code should clamp or ignore these gracefully. We’ll test that such inputs don’t crash the system but either skip the note or clamp it to a valid range (and log a warning).  

- **Error Demonstration:** As part of the ETH-winner style audit, we will create a *deliberate failure test*: for instance, if a user incorrectly swaps the units (treating centimes as francs), our tests should catch the discrepancy. In our context, we might encode a known faulty mapping (e.g. `transform: v => v * 100` vs `v => v`) and verify that the visual outcome is obviously wrong (e.g. a 100× scale error) and flagged. 

Each of these invariants will be encoded as automated tests (using Jest/fast-check or similar) where possible. Complex visuals (colors, smoothness) will have some programmatic checks (e.g. “no NaN positions”) and most aesthetics will be verified via user inspection (see below). 

## Performance and Fallback

**Target Performance:** We aim for smooth 60 FPS on a typical mid-tier laptop (e.g. 2020 i5 with integrated GPU) at 1080p. Specific targets:

- Support up to **N ≈ 500–1000** animated points/particles or parametric curve segments at 60 FPS. This should cover moderately complex patterns. 
- Allow bursts of complexity (e.g. a rapid melody) by dropping unused details (e.g. reduce trail length) rather than frame rate. 

**Budgeting:** We will measure frame time during development:
- If frame time >16 ms (below 60 FPS), we can dynamically reduce rendering resolution (e.g. fewer Canvas points, simpler shapes, lower pixel ratio).
- We’ll design the code so that motion physics and drawing are separate: if drawing is slow, we can throttle it (e.g. draw every second frame).
- **Resource Limits:** If a user input would exceed our performance (e.g. 5000 notes simultaneously), we will clamp or queue notes, or display a warning. Failing gracefully is better than freezing.

**Fallbacks:** 
- On low-end devices or high load, we can switch from WebGL to Canvas, or disable fancy 3D. If even Canvas is too slow, we can revert to a simple static wireframe (no motion trails, just endpoints). 
- If Web Audio isn’t available (rare in modern browsers), we can disable sound and still show visuals (or vice versa, though we expect audio to be primary). 
- We will not promise VR or cross-device sync.

**Export Integrity:** For offline export (WAV or video), timing fidelity should be maintained. For video, if real-time export is not feasible, we will allow frame-by-frame capture at a lower FPS (e.g. output one image per audio buffer segment). The exported audio must match exactly what the in-browser engine plays (we will compare buffer checksums in tests).

These performance targets and fallbacks will be verified in system tests: e.g. measuring FPS on sample patterns, and running on multiple browsers (Chrome/Firefox) to ensure the frame drops handled well.

## UX Journeys

We envision three user flows, from simple to advanced, each with strong inspectability of the data/logic:

1. **Quick Play (Beginner):**  
   - **Flow:** User loads a preset formula (or the default). They press “Play.” The canvas animates and audio plays. Controls are simple (Play/Stop, tempo slider).  
   - **Inspectability:** As the piece plays, the current formula row is highlighted in the spreadsheet. On hover/click of any visual object (point/curve), a tooltip shows the underlying note parameters (time, pitch, duration). A side panel displays the MappingRules in plain English (“Pitch → X-axis speed, Time → angle”) so the user sees why things move.  
   - *Objective:* Immediately see “music and math together.” 

2. **Draw-to-Music (Intermediate):**  
   - **Flow:** User switches to “Draw” mode. They sketch a simple shape (e.g. a spiral or curve) on the canvas. The tool converts this geometry back into a formula/score (e.g. by sampling the curve at steps). The user then hits play: the corresponding music/geometry pattern emerges, which may differ from naive expectation (learning opportunity). They can tweak the shape or formula and replay.  
   - **Inspectability:** The drawn curve is shown in semi-transparent overlay, and the extracted formula is shown line-by-line. A “why” panel explains e.g. “The loop at t=0.5 created a pitch jump of +12 semitones.” They can click a note to highlight the part of the drawn shape it came from.  
   - *Objective:* Reveal the reverse process and let users explore math→music interplay.

3. **Custom Mapping (Advanced):**  
   - **Flow:** User starts from an existing score (maybe imported MIDI or typed). They have access to a “Mapping editor”: a UI where they assign any parameter to any graphic variable (e.g. pitch → radius, interval → color). They also choose the MotionGrammar (dropdown: Harmonograph, Spring, etc.) and its parameters (sliders for damping, spring constant, boid weights). They press play to hear/see.  
   - **Inspectability:** As the simulation runs, a split view shows (a) the data flow: e.g. in a panel, arrows animate from “Pitch:64” → “Angle” with value tags. (b) A live plot of key values (e.g. oscillator amplitude decay vs time). The user can pause and adjust mapping rules on the fly, with immediate effect. A log console prints timestamps and errors.  
   - *Objective:* Empower expert users to understand and customize every aspect. They can, for instance, deliberately break an invariant (“make duration negative”) and observe the safe failure.

Each journey can escalate in complexity. At all levels, we maintain “inspectability”: every visual element is linked back to the music data, and vice versa. For instance, we might implement a debug mode that overlays graph of pitch vs time or draws lines showing note–>particle associations. These are not trivial to automate but will be part of manual QA and demo.

## Risk-First Experiments (Pass/Fail Criteria)

We propose **three focused proofs-of-concept**, executed early:

1. **Single-Note Harmonograph (High Priority):**  
   - *Task:* Given one note (pitch P, duration D) and fixed formula, generate the (x,y) Lissajous path using our oscillator model. Render the path and play the note.  
   - *Pass criteria:* The rendered curve should match the expected analytic shape. For example, if ω_x = 1 Hz and ω_y = 2 Hz, we expect a 2:1 Lissajous figure (two loops). We can programmatically check that the path closes correctly after `LCM(periods)` time. The audio should play exactly once for duration D (verify by comparing to a reference WAV).  
   - *Risk Addressed:* Validates that our oscillator equations and scheduling work, and that visuals reflect pitch correctly (avoids “cents vs francs” style unit bugs).  

2. **Chord vs Sequence (Medium):**  
   - *Task:* Test polyphony and motion synthesis. First, play two notes sequentially (melody), then play them as a chord (simultaneous), using the same harmony model.  
   - *Pass criteria:* When sequential, two separate curves appear one after the other. When simultaneous, either two curves or one combined pattern should appear. For audio, the waveform of the chord run should equal the mix of the two sequential runs (within a small epsilon). Compare audio buffers for equality (after normalization). For visuals, verify that the final frame of the sequential run matches part of the chord run (since order shouldn’t matter for linear superposition).  
   - *Risk Addressed:* Checks linearity and independence of notes; ensures our system can handle overlapping events without artifacts.

3. **Synchronization Test (High):**  
   - *Task:* Measure audio–visual sync under timing stress. For example, schedule a metronome tick every second and have the code flash the screen on each tick. Record via `audioContext` events the times of actual output (e.g. using an Analyser or event callback) and compare to the render timestamp.  
   - *Pass criteria:* The discrepancy between “tick played” and “tick drawn” must be <5 ms on average. If >20 ms, attempt adjusting for baseLatency or looping until stable.  
   - *Risk Addressed:* Validates our timing strategy and reveals any systemic latency. This addresses the critical sync issue flagged earlier.

4. **Stress Test (Low):**  
   - *Task:* Create a worst-case scenario (e.g. 500 notes triggering 500 particles) and measure FPS and memory.  
   - *Pass criteria:* Maintain ≥30 FPS. If not, identify bottlenecks (e.g. rendering each point vs using an instanced mesh).  
   - *Risk Addressed:* Ensures scalability and guides performance optimizations early.

Each experiment will have automated checks (except sync which may need manual review of console logs or recorded output). Failures are expected (that’s the point): e.g. if our sync error is 30 ms, we know to refine. We will document each outcome. By Dec 4, at least experiments 1–3 must pass before finalizing the build.

## Plan and Timeline (Nov 18 – Dec 4)

We adopt an incremental, Kiro-driven development plan:

- **Nov 18–19:** *Architecture and Specification.* Finalize this ADR (Decision Record) and translate it into Kiro tasks/When→Then specs (e.g. “When a NoteEvent is given, Then synthesizer plays correct pitch”). Set up repository structure. Prepare stub modules (audio engine, visual engine).  

- **Nov 20–23:** *Core Audio Engine.* Implement the score parser and scheduler. Choose Tone.js and test simple note playback. Create tests for single-note tuning (Exp#1). Document results.  

- **Nov 24–26:** *Basic Visualization.* Hook up Canvas2D/SVG and draw a test oscillator path (no real data yet). Integrate the motion math: code the Lissajous formula with damping. Verify static output. Write tests for curve closure.  

- **Nov 27–28:** *Audio–Visual Integration.* Tie the visual update to the audio clock. Run the synchronization experiment (Exp#3). Adjust as needed. Ensure “Play Note A produces expected curve at expected time.”  

- **Nov 29–30:** *Secondary Grammar.* Add spring/mass solver and a simple boids mode. Allow switching grammars. Test invariants (e.g. same input shape at diff tempos). Run stress test (Exp#4) and optimize if needed.  

- **Dec 1–2:** *UI & Interaction.* Build the basic user interface: play/pause, tempo control, mapping editor, debugging overlays. Implement inspect features (show note data on hover). Conduct all tests from **Testable Invariants**. Fix any violations.  

- **Dec 3:** *Final Verification.* Polish features, finalize documentation. Use Kiro to produce a changelog of implemented specs. Demo the full user journey with example scores. Package for submission.  

Throughout, we will use **Kiro IDE/CLI** to enforce our specs: each feature (audio routing, mapping application, etc.) will have a corresponding `.kiro` file. For example, a Kiro goal might be: “The system shall schedule NoteEvent.time=1.0 to play at audio time=0.5s (given tempo 120 BPM)”. We will capture logs or screenshots from Kiro runs as evidence. Every code change goes through review (pull request with tests) and references this ADR section.

### Kiro and PR Structure

- Each major decision (audio engine, visual grammar, mapping, testing) will become an ADR or issue. We already have this ADR for architectural decisions. Smaller decisions (e.g. which library version) will be noted in commit messages. 
- We will create issues or Kiro tasks for experiments (exp1, exp2, exp3) with explicit pass/fail criteria.  
- Proof of test-driven development: each significant feature implementation will have at least one automated test (preferably property-based). For example, after implementing the harmonograph, a test like “harmonograph with ω_x=1,ω_y=2 loops exactly after 1 second” will be written.  
- All bibliographic references in this ADR will be cited in PR descriptions or comments to show due diligence.  

### Open Issues

- *Mapping Flexibility:* We must decide on a UI or data format for **MappingRule**. Will users write JS expressions, or a limited form? This needs clarification (maybe use a safe eval or domain-specific expressions).  
- *3D Mode:* The role of the Three.js stage is still vague. We can defer details (maybe visualize the spring chain in 3D) if time. The priority is 2D.  
- *User Data Import:* If time allows, enabling MIDI import or saving scores to JSON should be considered. For now, we treat that as future work.  
- *Accessibility:* Ensure the app has accessible colors/contrast and optional audio-only mode (maybe a separate short-term issue if needed).

## ETH-Winner Audit Compliance

- **One Hard Promise:** We promise *deterministic, verifiable mapping from score to output*. This means if the same inputs are fed, the output audio and key visual metrics will not vary. We back it with tests (fixed-step sim, no hidden randomness).  
- **Deliberate Failure:** We will include a known “defect mode” (e.g. setting damping=0 or an extreme mapping) to show our test suite catches it (e.g. an oscillator with no damping never stops). This transparency shows we do not hide failures.  
- **Independent Proof:** Each invariant is testable without user guesswork. For instance, the synchrony test independently logs actual vs expected times. Any performance claims will be backed by measured logs.  
- **Full User Journey:** We have outlined actual user scenarios (pages/screens) and plan to demonstrate them live. We will record one end-to-end demo (as required) showing a user creating a shape and seeing/hearing the result, highlighting our inspectability features.  
- **No Fabricated Evidence:** All evidence comes from either the scientific literature (which we cite) or from our planned tests and code. We will not claim any feature that we haven’t implemented or measured. For example, we won’t say “runs at 1000 FPS” without evidence.  

By December 4, we will have a working prototype that fulfills Experiments 1–3, passes our test suite, and demonstrates the core vision: **a musical score drives a cohesive, inspectable visual artwork**. Complex aesthetic evaluation (is the phyllotactic spiral “beautiful enough”?) will be left to user feedback, but our ADR ensures everything mechanical is sound.

**Sources:** We have cited authoritative references for all key technical claims (Lissajous/harmonograph, boids, Kuramoto, Hooke’s law, curl noise, audio timing, spectral centroid, etc.). These underpin the mathematics and timing strategies we will use. Any claim not covered above is either directly from the project (Devpost) or a decision explained in this document. This completes the reviewed technical decision record for Harmoglyph.