# Harmoglyph: Integrating Music, Math, Motion, and Art

We surveyed a wide range of music-visualization, generative-art, and audio-analysis research and tools to see what already exists and how to combine them into one coherent system.  The key is a layered architecture: **(1) musical analysis**, (2) **mathematical mapping rules**, (3) **motion/physics simulation**, and (4) **rendering/style choices**, all synchronized to a shared timeline.  Many prior projects handle one or two of these layers, but we need to connect them into an *inspectable* creative instrument.  Below we review relevant techniques and tools in each area, with citations, then propose a modular architecture, concrete “motion grammars”, and a test plan. 

## 1. Musical Intelligence and Audio Features

- **Symbolic vs. Audio Input**: Harmoglyph’s current prototype uses symbolic input (e.g. note spreadsheets and Web Audio FM synth).  Symbolic formats (MIDI or MusicXML) give exact notes, durations, velocities and timing.  This means pitch, rhythm, and dynamics are already explicit, avoiding the uncertainty of audio analysis.  (By contrast, audio-input systems must perform beat detection, onset detection, pitch estimation, etc. – see below.) 

- **MIR Features**: For audio (or to analyze the FM synth output), we can extract standard music features.  Libraries like [librosa](https://librosa.org/) compute **spectrograms, MFCCs, chromagrams, spectral centroids, onset strength**, and more.  For example, a chromagram summarizes energy by pitch class (C, C#, …, B) and onset strength highlights when notes or beats start.  These can inform mappings: e.g. use spectral centroid (brightness) to influence color, or onset strength for pulse.  However, since Harmoglyph’s input is symbolic, we can derive these deterministically (e.g. compute MIDI note frequencies, derive scales and chords, etc.) and bypass noisy audio analysis. 

- **Existing Tools (MIDI/Viz)**: Some projects directly visualize MIDI events.  For instance, the Python “Chromat” system parses MIDI and maps **time→x** and **pitch→y**, with velocity controlling color and note duration controlling how long a mark persists.  It creates a piano-roll style plot: notes become colored circles on a canvas (time horizontal, pitch vertical), revealing rhythm and form.  Harmoglyph can borrow this idea of a *symbolic timeline* and use it as one baseline “oracle” of the music.  Other tools like **Tone.js** (used in the existing code) or **WebMIDI** allow capturing live performance, but for hackathon scope we can stay with pre-defined MIDI or note arrays. 

- **Musicology Features**: Besides raw pitch/time, more semantic music features could be used: key/mode (major/minor), intervals and chords, rhythmic meter (4/4, 3/4, etc.), tempo, or motif repetition.  Some research (e.g. [13]) performs **beat grid and novelty detection** to find song sections.  We might compute simple analogs: e.g. recognize repeating motifs or chord changes.  At minimum, the system should tag each note with its pitch class, duration, and onset time.  This “score model” is the canonical event list that all later stages reference. 

**Key takeaway:** We will parse the musical score into time-stamped events (note on, note off, pitch, velocity, etc.) and perhaps compute basic derived features (chord ID, beat number).  We will use standard audio/MIR libraries (e.g. Tone.js, Web Audio APIs, or Python librosa in a backend analysis step) only as needed.  The crucial point is that the music side provides a *deterministic, timestamped sequence of events* that drives the visual/motion system, rather than relying on “audio-reactive” heuristics.

## 2. Mathematical Pattern Languages

At the heart of Harmoglyph is the idea that **mathematical forms** underlie both music and the artwork.  We surveyed common generative patterns:

- **Lissajous / Harmonograph (Parametric Oscillators):**  Two sine oscillators on perpendicular axes produce Lissajous curves:  
  \[
  x = A_1 \sin(\omega_1 t), \quad y = A_2 \sin(\omega_2 t + \delta).
  \]  
  If $\omega_1/\omega_2$ is a rational ratio (e.g. 3:2, 4:3), the figure eventually closes; if irrational, it fills the region.  Physically, a harmonograph (pair of pendulums) draws these curves.  In music, playing two sustained tones creates such a figure.  Gallozzi and Strollo (2023) note Lissajous curves are natural visualizations of musical intervals.  We could map one voice to $x(t)$, another to $y(t)$, or map a melody into polar coordinates.  Importantly, this mapping is *exactly mathematical* (no arbitrary distortion): the shape *is* the mathematical relationship between frequencies.  

- **Phyllotaxis / Vogel Spiral:**  Points placed with the “golden angle” produce the sunflower spiral.  The classic formula (Vogel’s formula) is 
  \[
  \theta_n = n\cdot\alpha, \quad \alpha \approx 137.508^\circ,\qquad r_n = c\sqrt{n},
  \] 
  where $\alpha=180^\circ(3-\sqrt5)$ is the golden angle.  This creates a tightly packed spiral.  Recent work (Ai & Park, 2026) dynamically modulated this spiral with music features: they let $\alpha(t)$, radial density, and curve curvature vary with beat intensity, spectral centroid, and amplitude envelope.  The result was a “breathing” spiral that reflects musical form.  In practice, Harmoglyph could place notes or particles along a growing spiral, adjusting spacing or petal width based on the music.  The math here (spiral growth) is fixed, but we would *drive its parameters* from the score.  

- **Fourier/Epicycles:**  Any shape can be drawn by a sum of rotating vectors (Fourier series).  Artistic tools like *spirographs* or *cycloidal drawings* (e.g. epicycloids) use circular motions to trace curves.  Harmoglyph could implement an epicycle synthesis: treat each note as an oscillation of some frequency, and visualize their vector sum.  This is mathematically well-founded (e.g. drawing a circle with rotating arrows).  However, designing a specific Fourier-based grammar might be complex to tune.  One simpler related idea is to interpret a melody as a 1D signal and plot its parametric curve $(x(t), y(t))$ in the plane, effectively creating a waveform “ribbon” in 2D.  

- **Fractals and IFS:**  Fractals (Julia sets, IFS, flame fractals) can produce intricate patterns.  Some visualizers let music modulate fractal parameters (see *resonance* scenes [13]).  Pure fractals are powerful but less obviously “musical” unless keyed to specific parameters (e.g. use pitch to choose a complex parameter in a Julia set).  We will list fractal scenes as possible styles, but since fractals often evolve independently, we must be careful to tie changes to the music explicitly (e.g. jump fractal seed on a beat).  

- **Phyllotactic & Natural Forms:**  Inspired by [28], we should consider other natural patterns: spirals (sunflowers, pinecones), leaf venation, flower petals, etc.  For example, a **flower-like petal** pattern could respond to four-bar phrases (as in our “Phrase Bloom” prototype), but as the user noted, tying bars to petals is arbitrary.  Instead, one could derive a petal count from chord count, or map timbre to petal curvature.  The key is: use mathematically defined patterns (e.g. polar equations, radial symmetry) but *drive them from music-derived parameters*.

- **Torus/Cylinders/3D Extensions:**  All the above can extend to 3D or to surfaces (e.g. phyllotaxis on a sphere or cylinder).  For example, arranging notes on the surface of a sphere via spherical phyllotaxis would create a globe-like sculpture.  Such dimensionality might be beyond the initial MVP, but worth mentioning for future expansion (especially with Three.js available).

**Mapping choices vs. artistic choices:** We must distinguish strict math from design.  For example, using the golden angle is a mathematical choice, but coloring each point or smoothing strokes is an artistic layer.  We should ensure any distortion or interpolation still allows tracing back to the original data (e.g. if points move, we know which note created each).

## 3. Dynamic Motion and Emergent Systems

Rather than simply “draw once and stop,” Harmoglyph aims for *continuous motion*.  We surveyed physical and emergent systems that could be driven by music:

- **Fluid Dynamics:**  Real-time fluid simulation (Navier–Stokes) can create smooth, organic motion.  The open-source “Chroma Flow” demonstrates a GPU-accelerated 2D fluid with vorticity confinement and dye advection.  We could treat each note as an injection of velocity/dye into a fluid field (e.g. a bass note creates a whirlpool, a cymbal adds turbulence).  This guarantees continuous, smooth movement.  However, fluids are computationally heavy (though WebGL shaders and WebGPU can help).  If used, we’d implement the classic “stable fluids” steps (advection, vorticity, pressure projection).  

- **Particle Systems and Boids:**  Flocking simulations (Craig Reynolds’ Boids) or swarms of particles can exhibit emergent harmony.  For example, the “resonance” project’s **boids scene** has 32k agents whose alignment tightens on calm music and scatters on drops.  We could spawn particles on notes (or treat notes as *field forces*) so particles flock or swarm according to music-driven rules.  PSCactux’s demo shows 4,000 CPU boids with separation/alignment/cohesion, and 262k GPU particles in a curl-noise flow.  These are examples of scaleable motion engines.  

- **Coupled Oscillators (Kuramoto):**  The Kuramoto model shows how oscillators synchronize through coupling.  An impressive WebGPU demo (“Circle of Life”) drives 250k particles by a Kuramoto coupling rule.  In Harmoglyph, each musical voice could be an oscillator (phase = note cycle); coupling could be driven by harmonic intervals or rhythmic locks.  When notes are consonant, clusters could sync up; when dissonant, they drift apart.  The equations $d\theta_i/dt = \omega_i + (K/N)\sum \sin(\theta_j-\theta_i)$ could animate objects’ phases.  However, implementing full Kuramoto physics is advanced (and might overshoot hackathon scope).  We may use simpler “spring” or “gravity” analogies instead (see below).

- **Reaction–Diffusion:**  Turing patterns (e.g. Gray-Scott) spontaneously create organic textures.  The open-source “gray-scott-reaction-lab” shows a real-time WebGL implementation with interactive disturbance.  We could feed notes as impulses into a reaction-diffusion grid (feed or kill rates), but the link to melody is subtle.  Such patterns tend to be quite abstract and not obviously responsive to specific musical structure.  Likely a lower priority for Harmoglyph unless a very direct mapping is found (e.g. frequency modulates reaction rate).

- **Chaos and Strange Attractors:**  Plotting an attractor (Lorenz, Rossler, etc.) yields swirling shapes.  The “resonance” project uses “strange-attractor phase space” for its attractor scene.  We could modulate attractor parameters with music (e.g. pitch shifts driving the Lorenz “rho” parameter).  This can be visually fascinating but may risk being less obviously tied to the music unless carefully explained (we’d need a “reasoning” feature).  

- **Other Flows:**  The user’s “universe/galaxy” analogy suggests a *cohesive dynamic*.  We interpret this as wanting multiple elements (stars, particles, ribbons) that *influence each other gracefully*.  One approach is using **vector fields** or **potential fields**: e.g. each note creates an attractor or vortex in a flow field, and continuous particles move along that field.  For instance, create a curl-noise field (like Perlin’s “curl noise”) and update it or inject energy at note times.  The math here ensures continuity (noise fields are smooth by design).  

**The key for motion is continuity and explainability:**  
We should ensure motion is smooth (target 60 fps, using accelerations/velocities not jumpy positional updates) and that each moving element’s behavior has a clear cause in the music.  For example, if a cluster of particles tightens on a downbeat, the link should be traceable (perhaps by metadata or a legend).

## 4. Artistic Rendering and Tools

Finally, whatever motion we generate must be rendered appealingly.  Key considerations:

- **2D vs 3D:**  The existing prototype uses SVG in 2D.  We have Three.js available for 3D or 2D WebGL.  3D allows deeper effects (volume, lighting, camera moves), but 2D (Canvas/SVG) is simpler and more directly “poster-like”.  Either is viable, but we should plan for both: design primitives in 2D that could be extruded or layered in 3D if desired.

- **Rendering primitives:**  We will want at least lines, points, and surfaces.  For instance:  
  - **Ribbons/curves:** as in our “Melodic Ribbon” mockup, parametric curves that flow.  
  - **Points/particles:** glowing particles or small spheres.  
  - **Brush strokes/textures:** e.g. simulate ink or neon glow. (Chromat used glowing circles.)  
  - **Solid meshes:** potentially extrude curves or form “clouds” of points into surfaces.  

- **Visual styles:**  Based on prototypes, we might allow e.g. *“Bloom”* (glowing strokes), *“Orbit”* (points orbiting), *“Weave”* (interlaced threads) as separate styles.  Each style would share the same underlying motion but differ in appearance.  For example, the same particle positions can be drawn as glowing dots, as lines connecting neighbors, or as ribbons following their paths.  We should treat style as a layer that “sits on top” of the motion/position data.

- **Software Frameworks:**  Among open tools, **Three.js** is a natural choice (we already use it for the 3D stage).  Other options include PixiJS (2D GPU), p5.js (2D), or writing raw WebGL/GLSL shaders for maximum control.  Given time constraints, Three.js + shaders (via raw GLSL or node materials) is practical for decent visuals.  We should also consider performance: aim to render 10k–100k elements smoothly (so use instanced draws or GPU particles).  

- **Existing Visuals:**  Inspiration can come from VJ and art history.  For example, Ryoji Ikeda’s visuals often map audio to stark geometric patterns, while Brian Eno’s generative album covers (like *77 Million Paintings*) use simple evolving shapes.  We should avoid random “audio-reactive” flicker (like typical music visualizers).  Instead, emphasize that *every shape has mathematical origin in the music*.  This means, e.g., if we draw a swirling dust cloud, we should allow the user to click or inspect a dot and see that it was caused by, say, note 5 of the melody at time t.  This traceability distinguishes our approach from typical VJ loops.

## 5. Proposed Architecture

Synthesizing the above, we outline a modular pipeline (to be implemented in React/TypeScript with Kiro):

1. **Music/Score Model:**  
   - Input: user loads or enters a melody (MIDI or custom array).  
   - Data: a list of events {time, pitch, velocity, duration, [other tags]}.  
   - Handle: a global clock or audio-context time, with all transformations tied to it.  
   - We keep the original “oracle” audio (e.g. Web Audio FM synth) running so we can verify sync.

2. **Feature/Analysis Stage:**  
   - Compute any higher-level features needed: tempo (BPM), beat times, phrase/chord segmentation, pitch class sets, etc.  For example, divide the score into bars or motifs.  Also compute timbral proxies (even though FM synth is basic, we can treat velocity as “loudness”, and maybe define a “brightness” measure from pitch).  
   - Optionally perform a quick offline analysis (e.g. FFT over the playback buffer) if we want real audio features.  

3. **Mapping/Rule Graph:**  
   - A user-configurable set of rules that map musical features to motion parameters.  For instance: “On each note-on, spawn a particle at center with velocity magnitude ∝ pitch, angle ∝ time modulo some value.”  Or “Bind each voice to an oscillator whose phase angle = note’s phase.”  We should support multiple, independent mappings (e.g. one for melody, one for harmony, one for rhythm).  This can be implemented as a small DSL or JSON schema, but even a fixed set of rules toggles is fine for MVP.  Crucially, all mappings must reference the music model (e.g. note index, time in bar, pitch interval to previous note, etc.).  

4. **Motion State / Simulation:**  
   - This is the core loop that steps each frame (aim 60 Hz).  It advances the physical state: e.g. particles move according to velocity fields, curves advance, system time increments.  It reacts to incoming events (notes) by injecting forces or creating new objects.  
   - Use physics formulas or update rules for the chosen “grammar” (see next section for examples).  All motion should be time-integrated (with `dt = frameTime`) and possibly use easing curves to smooth transitions.  
   - We must ensure determinism: use a fixed random seed or fully deterministic rules so that replaying the same score yields the same result.  Use Kiro’s vector or stable algorithms to guarantee reproducibility.

5. **Rendering Layer:**  
   - The simulation exposes a set of drawable objects each frame (lines, points, meshes with positions, colors, etc.).  We feed these into a renderer (e.g. Three.js scene or a Canvas draw).   
   - Visual style parameters (colors, stroke widths, glow intensity) can be chosen by the user.  We should provide 3–4 presets for “appearance” that artists can tweak (e.g. neon glyph, organic ink, crystalline, pastel fluid).  But these only affect the final look, not the underlying motion math.  

6. **Inspector/Labels:**  
   - To make the experience *inspectable*, we will attach metadata to rendered objects.  For example, each particle or curve segment can carry a reference to the note or interval that spawned it.  A hover or click can then show a label “Created by Note 8 (G4, time=1.2s)”.  This satisfies the requirement of explaining “why is this moving” and ties visual elements back to the music (like our earlier “reveal the math” overlay).  

7. **Synchronization & Export:**  
   - Keep everything locked to a single clock so audio and visuals stay in sync (requestAnimationFrame with audioContext currentTime is one approach).  - Ensure safe export: we should allow capturing a still image (SVG/PNG) of the final state and optionally recording a short video clip.  - Also export a “printable artwork”: since the motion is continuous, define the final art as the static result at the end of the piece (maybe via “show finished art” button).  

## 6. Motion Grammars (Candidate Designs)

We propose several **“motion grammars”**—mathematically grounded systems that will be parameterized by music.  Each grammar defines how objects move and interact over time.  (Styling can be mixed on top of any grammar.)

1. **Spiral Growth (Phyllotaxis as Motion):**  
   - **Mechanics:**  At each note, create a new point with angle $\theta_n = n\cdot\alpha(t)$ and radius $r_n = c\sqrt{n}$ (as in Vogel’s formula).  Let $\alpha(t)$ vary slowly with music (e.g. $\alpha = 137.5° + f(\text{timbre})$).  Over time, this point drifts outward along its radial line at a constant speed.   
   - **Math:** $\alpha$ (divergence angle) and $c$ (scaling) are time-varying parameters.  For note index $n$, position $(r_n \cos\theta_n,\,r_n \sin\theta_n)$.  If we want continuous motion, each point could also orbit or oscillate slightly (e.g. $r(t) = r_n + A\sin(\omega t)$).  
   - **Constraints:** Points don’t collide (treat as infinitesimal) or could have small repulsive forces to keep them distinct.  
   - **Appearance:** The result is a growing spiral of points or brush strokes.  This directly extends our phyllotaxis concept.  
   - **Complexity:** Computation is cheap (just trigonometric updates), scalable to thousands of points.  Note: careful with $n\sqrt{n}$ growth (limit total points or add “fade out” to not overload).

2. **Harmonic Ribbon (Lissajous Loop):**  
   - **Mechanics:**  Consider the melody as a continuous 1D signal $p(t)$ (pitch vs time).  We can interpret $x(t)=\cos(p(t))$, $y(t)=\sin(p(t))$ or similar, producing a curve.  Alternatively, choose two voices (or duplicate melody) as $x$ and $y$ oscillators: $\dot{x} = \omega_1(t)$, $\dot{y} = \omega_2(t)$ with $\omega$ driven by pitch/Frequency of two notes.   
   - **Math:** E.g. $x(t) = A \sin(\int_0^t \!2\pi f_{\text{melody}}(\tau)\,d\tau)$, $y(t)= B \sin(\int_0^t 2\pi f_{\text{bass}}(\tau)\,d\tau)$.  This is essentially a time-varying Lissajous.  
   - **Constraints:** Keep the curve smooth by low-pass filtering sudden pitch jumps, or interpolate between notes (since human music has discrete notes).  
   - **Appearance:** Yields a single continuous curve (a “ribbon”).  For example, a rising melody might spiral outward.  This generalizes our “melodic ribbon” idea.  
   - **Example Behavior:** If a melodic interval is 3:2, a Lissajous loop appears (as in [19]).  If intervals change, the shape warps.  We ensure determinism by not using random at all.  
   - **Computational cost:** Just integrate simple ODEs or accumulate phase; very cheap.

3. **Particle Flocking/Attractors:**  
   - **Mechanics:** Spawn $N$ particles (or “agents”) that follow simple rules (e.g. Reynolds’ rules: separation, alignment, cohesion) with musical influence.  For instance, treat each note as a “vortex” or “goal” that attracts particles when active.  Low-frequency (bass) notes could generate attractive fields, high-frequency (melody) repulsion, etc.  Or spawn a new particle for each note, with initial velocity from pitch.  
   - **Math:** Standard boids: 
     \[
       \mathbf{v}_i \leftarrow w_s \, \mathbf{v}_\text{sep} + w_a \, \mathbf{v}_\text{align} + w_c \,\mathbf{v}_\text{cohesion},
     \]
     then update $\mathbf{x}_i \leftarrow \mathbf{x}_i + \mathbf{v}_i$.  We add extra term $\mathbf{v}_{\text{music}}$ at a note event.  
   - **Constraints:** This is $O(N^2)$ naive, but we can limit $N$ to a few thousand or use spatial hashing (as done in [13] and [32]).  
   - **Appearance:** A flocking cloud that pulses and reorganizes with the music.  This matches “coupled behavior” we sought – notes cause clusters to form or disperse.  
   - **Example Behavior:** Calm music (long sustained notes) causes slow, swirling flock; staccato/rhythmic notes cause rapid jitter and splitting.  
   - **Reference:** The PSCactux fluid-particles example runs 4k boids on CPU.

4. **Flow-Field Particles:**  
   - **Mechanics:** Create a 2D **curl-noise** vector field (or fluid field), $\mathbf{F}(x,y,t)$, that is seeded or modulated by music.  Particles move according to $d\mathbf{x}/dt = \mathbf{F}(\mathbf{x},t)$.  For example, $\mathbf{F}$ could be a Perlin noise field that periodically “pulses” or shifts when a beat occurs, or individual notes inject velocity into $\mathbf{F}$ at specific positions.  
   - **Math:** Use Ken Perlin’s curl noise or a fluid solver (see Chroma Flow).  A simple approach: have a fixed 2D array of velocities. On each note, apply an impulse (add a Gaussian blob) to that field. Each frame, advect the field to simulate diffusion.  
   - **Appearance:** Many colored particles moving along smooth curves (like ink in water).  Without input, particles fade or swirl slowly; with notes, visible swirls propagate.  This yields very smooth and “mesmerizing” motion.  
   - **Performance:** With GPU shaders, 512×512 fluid fields at 60fps is feasible (as seen in [31]).  We must manage precision (e.g. use half-float textures) for performance.  

5. **Oscillating Springs (Mass-Spring Network):**  
   - **Mechanics:** Place points on a 2D lattice or graph, connect neighbors by springs.  When a note plays, perturb one or more points (e.g. displace them or change their rest length).  The network vibrates, creating waves.  
   - **Math:** Hooke’s law: $F = -k (x_i - x_j - d_{ij})$ between points $i,j$, plus damping.  Each frame, integrate masses via Verlet or RK.  The network’s normal modes depend on its geometry; by exciting specific modes (notes), complex oscillations emerge.  
   - **Appearance:** This can look like rippling cloth or mesh.  We can render connecting lines or a deformed surface.  It’s like a 2D drumhead.  
   - **Example:** If each note maps to a specific vertex, chords could excite multiple nodes, yielding interference patterns.  Useful for a “web of sound” visual.  

6. **Orbital (Circular) Motion:**  
   - **Mechanics:** Assign each musical element (note or instrument) an orbit path around a center.  For instance, each note becomes a satellite orbiting a central point; its radius might encode pitch, and its speed encode duration or tempo.  Or use epicycle layers: e.g. second voice orbits first orbit, etc.  
   - **Math:** Simple circular motion: $\theta(t)=\omega t + \phi_0$.  For resonance with music, let $\omega$ (angular speed) change with dynamics: a crescendo might accelerate the spin.  Or during a sustained note, the object spirals gradually inward/outward.  
   - **Appearance:** A set of rings or spiral arms.  Could produce a “galaxy” metaphor (but intentionally non-cosmic in style).  Many audio-visualizers use circular graphs (spectrogram discs); here we would make it smooth and interactive.  
   - **Constraint:** Keep orbits from colliding: ensure different radii or add non-overlap constraints.  

Each of the above grammars has *precise mathematics* behind it.  The artistic choices are in how to parameterize them from the music and how to style their rendering.  Crucially, we can mix-and-match these grammars: e.g. use the Spiral Growth for melody, and a Flow-Field for rhythm.  Each grammar would run concurrently on the shared timeline.  

**Testing different scores:** For evaluation, we would compare how each grammar handles two very different inputs (e.g. the 16-note *Glass Garden* vs. a percussive 20-note *Switchback*).  A good grammar will produce distinct, recognizable patterns for each.  A negative control could be a “flat” input (e.g. a simple scale or repeated single tone) to verify that the output isn’t just random noise (it should show clear repetition or a simple spiral for a repeated note, for instance).

## 7. Evaluation Metrics and Testing

We plan both **automated** and **user-testing** evaluations:

- **Correctness (Event-to-Motion):**  Verify that every musical event causes the intended visual change.  For example, if a note is supposed to spawn a particle at time $t$, check that in the simulation state at $t+\epsilon$ it appears.  We can write unit tests or visual diffs (like our “verified graft” tests) to ensure this pipeline.  Comparisons of *deterministic output* for fixed input will confirm mapping fidelity.

- **Synchronization (Audio–Visual Sync):**  Ensure the visuals stay in lockstep with the music clock.  We will measure drift by scheduling known events (like peaks in the art) and checking they align with the audio waveform peaks.  Using `requestAnimationFrame` tied to `audioContext.currentTime` should keep them synced to within a few ms.

- **Frame Rate and Performance:**  Aim for stable 60 fps on target hardware (common laptops/desktops).  We’ll measure rendering time per frame, and simplify or GPU-accelerate any bottleneck (e.g. particle count, shader complexity).  Use WebGL/WebGPU where possible (see [13][31][32] examples of GPU use).

- **Visual Quality:**  This is subjective, but we can test style consistency: e.g. a given music snippet rendered with two different styles should look distinctly different (color palettes, shapes) yet both “make sense” with the music.  We should also ensure no obvious artifacts (e.g. flicker, aliasing, objects disappearing abruptly).  If we include a “print” export, we test its fidelity (SVG lines not mis-placed).

- **Determinism/Reproducibility:**  Run the same input multiple times to confirm identical output (given fixed seed and no randomness in rendering).  Ensure PNG/SVG exports are bit-for-bit or pixel-for-pixel consistent.

- **Usability:**  Because user journeys matter, we’ll define simple tasks (see below) and ask a few users to try them, recording if they understand the mapping.  For example: “Load a melody, pick a visual style, press play – does the image grow in a meaningful way? Can you identify how the notes affected it?”  This qualitative feedback is crucial to verify that our designs communicate music–math correspondence.

We will also guard against overclaiming. Terms like “magnetic forces” or “sound energy” should be either justified or avoided. For instance, if we use gravity-like attraction between particles, clarify it’s an artistic metaphor, not actual physics of sound. Similarly, any “frequency = radius” mapping is a design choice. All such mappings will be documented as tunable parameters, not universal laws.

## 8. Existing Tools and Demos (Comparison)

We surveyed many existing visualizers and libraries, to ensure Harmoglyph adds value:

- **Chromat (GitHub)** – uses MIDI→2D-plot with time/pitch mapping.  It reveals form but is basically a (nice) piano roll.  Harmoglyph goes beyond by animating and using complex motions, not just plotting notes.

- **Resonance (GitHub)** – a state-of-the-art 3D music visualizer using Three.js/WebGPU.  It analyzes beat structure with FFT/neural models and renders many scene types (particles, boids, fractals).  It *does* something similar to our vision, but it’s closed-source and extremely complex (large neural models, LLM planning, GPU compute).  We can learn from its scene ideas (e.g. attractors, slime mold) and its pipeline (FFT→chroma, etc.), but we aim for a more lightweight, user-driven tool.

- **Hydra (Open Source)** – browser live-coding for visuals.  It is not music-driven by default, but it shows how to chain GPU shaders and mix outputs.  We might allow a “hydra-style” shader patch as a rendering style plugin in the future.

- **Fluid Simulation (Chroma-Flow)** – real-time WebGL fluid (based on Jos Stam’s solver).  This is *not* music-linked, but provides a code base for fluid advection and vorticity.  We can adapt its algorithms (stable fluids, semi-Lagrangian advection) to our needs.

- **Particle & Boids (fluid-particles)** – a TypeScript/WebGL demo combining fluid, flow, and boids.  This covers many of our planned grammars in one project.  We can reuse or learn from its implementation (e.g. how it achieves 1M particles with trails, or 4000 boids on CPU).

- **Gray-Scott Reaction Lab** – a WebGL Gray–Scott shader demo.  Again, not music-aware, but shows reactive, organic textures.  We can use it as a fallback visualizer when music is silent or as a layer modulated slowly.

- **Commercial VJ/Music-Vis Tools:** e.g. Magic Music Visuals, Resolume, TouchDesigner, Notch etc.  These are powerful but either closed or aimed at live performance with manual node-graph editing.  Harmoglyph’s niche is an *integrated compositional instrument* rather than a general VJ suite.  It would “know” the score and keep an **audiovisual correspondence** that persists into the final artwork.

**Summary:** Tools exist for music-driven visuals, but none combine live-coded math, explicit musical semantics, and generative art all in one user-friendly package.  Our contributions will include (a) **differential validation** (using hidden “oracle” apps as in the pivot idea), (b) **explainable mappings** (inspectable links between sound and motion), and (c) the flexible mixing of motion grammars/styles.  We’ll reuse algorithms (fluid, boids, react-diffuse) from open sources as needed, but glue them with the musical logic.

## 9. User Journeys (Example Workflows)

To ensure Harmoglyph is accessible yet deep, we envision multi-stage user flows.  For illustration, here are 3 progressive journeys:

1. **Melody → Ribbon (Simple)**: The user inputs or selects a single-voice melody (e.g. a 16-note tune).  They choose the “Melodic Ribbon” mode.  As the music plays, a colored curve traces out.  The user sees a smooth ribbon growing.  They can click the curve to hear the corresponding note (inspector says “Note 5: G4 at 2.5s”).  After playback, they click “Show Artwork” to freeze the final ribbon (exportable as SVG).  *This journey tests basic mapping: can a listener recognize the melody’s shape in the visual?*  

2. **Phrases → Orbiting Motifs (Intermediate)**: The user loads a multi-phrase song with two voices.  They break the composition into phrases (the UI might ask them to mark phrase boundaries).  They pick a combined style, say “Orbit”.  Now each phrase spawns a visual motif (e.g. a set of orbiting points).  As bars pass, the previous phrase’s orbit slows while the new one emerges.  The user can drag a phrase’s orbit to reorder it and see the effect on the animation.  They also inspect that when phrase A (with notes C-E-G) played, a triangular orbit pattern appeared.  At the end, “Reveal Math” highlights that phrase A contributed orbit radius X, and phrase B changed the color hue.  

3. **Full Composition → Immersive Gallery (Advanced)**: The user builds a piece layer by layer.  First they create a bassline (driving a fluid flow).  Then add a melody (driving particles), then chords (driving ribbons).  They choose an overall “color palette” (maybe from a photo or based on mood).  During playback, multiple elements move: ink-like tendrils from the bass, swirling dust from melody, and floating ribbons from harmony, all coordinated.  They can solo/mute layers or switch rendering (e.g. toggle “fluid mode” vs “particle mode”).  After, the system exports a final still image (combining all layers) and a short video with audio.  

At every step, we include an **explain panel** so the user isn’t lost: e.g. hover a control to see “This knob controls how many points each note spawns”.  And a “Why is this moving?” inspector lets them select an object (like a particle) and see, for example, “Particle created by Note D5 at 3.2s, moving under a flow field seeded by that note’s frequency”.

## 10. MVP Plan, Kiro Workflow and Risks

**Next 2 weeks (Kiroween deadline):** Focus on core pipeline and one or two grammars.  We suggest:

- **Week 1 – Core Framework:**  
  - Build the **timed score model** (reuse existing spreadsheet VM or Tone.js).  Output a sequence of note events with timestamps.  
  - Implement one grammar fully: e.g. the **Spiral Growth** (phyllotaxis) plus simple ribbon mapping.  Confirm we can animate smoothly and sync audio.  
  - Create basic UI: upload melody, play/pause, show visual canvas.  
  - Integrate Kiro tests: write a small PBT suite that checks e.g. “given input melody, final spiral has N points, first point’s position is correct”.  Use Kiro hooks to automatically run these on code changes.  
  - Publish an internal demo and gather quick feedback (maybe within the team or a few hackers).  

- **Week 2 – Extensions and Polish:**  
  - Add a second grammar (e.g. Flow-Field Particles or Harmonic Ribbon).  Allow switching between them.  
  - Implement the **inspector**: at least enable clicking on an element to log which note/event created it (this can be a console log if UI is tight).  
  - Optimize performance: ensure ~60fps on a typical laptop.  (Use Three.js InstancedMesh or WebGL2 buffers for thousands of points.)  
  - Build an image export (SVG or canvas snapshot) and audio sync export (if time, a short MP4).  
  - Prepare Devpost submission: write the project description using what we learned (focusing on the unified concept “song = art piece”), include screenshots or short demo video.
  - Define evidence gates for Kiro: e.g. we must **show** the code usage of Kiro (like .kiro config files, submission tests).  We’ll use Kiro’s hooks to run linters and tests.  

**Kiro-specific:** We will maintain the code in a Kiro workspace (leveraging the existing repo).  Hooks will enforce linting and run our PBTs on save (see docs).  We should also show Kiro-driven collaboration: for example, create a Kiro “Crew” task to refactor or to run the simulation automatically and check invariants.  In the final submission, we will include `.kiro/hooks/` JSON files (for lint or type-check) and `.kiro/submission/` for the existing differential tests from the creative-coding pivot.  We must **demonstrate actual use of Kiro features**, not just mention it.  For instance, we could have a Hook that triggers the Kiro Playground every time the user modifies the mapping graph schema to auto-generate a new sample visualization (showing deterministic output).

**Risks & Mitigation:**  
- *Too much fancy motion?*  We must ensure at least one mode is clearly “the music defines the image”.  Our Spiral and Ribbon grammars have obvious ties (mathematically exact).  If we add emergent systems (fluid/boids), we will accompany them with overlays or inspectors to reveal their data sources.  
- *Performance issues:*  Already identified heavy parts (fluid solver, boids).  If needed, we’ll scale down particles or freeze them once music ends (so still image).  
- *Competition:*  Some existing tools (like our search yields) do parts of this.  We will highlight Harmoglyph’s uniqueness: **multi-layer composition** (not just audio-reactive wallpaper) and **inspectability**.  

## 11. Final Recommendations

Based on the above research, we recommend focusing on these core ideas for Harmoglyph:

- **Phyllotactic Spiral + Ribbon as foundation:**  These are mathematically clean and were rated high in concept (spiral breathing was preferred).  Use [28]’s insight to modulate angle and radius by beat and spectrum.  
- **Smooth Particle Flow:**  Either a simple curl-noise flow or a fluid solver (Chroma Flow style).  This yields the graceful continuous motion the user requested (the “silk” or “flowing galaxies” feel).  We saw [32] a complete fluid+boids system; a subset of that (just fluid + particles) could be adapted.  
- **Explanatory Interface:**  Build the “why is this moving?” inspector from the start (metadata labels on objects).  Our research shows visuals need user guidance to be understood as meaningful (see [28] discussion of coherence).  
- **Deterministic Math:**  Avoid black-box randomness.  All graphics should have a clear formula.  We should cite any complex algorithm used (like Stam’s fluid solver or Kuramoto) to understand its guarantees.

**To Reject or Deprioritize:**  
- The original “flower petal per bar” scheme (Phrase Bloom) seems arbitrary and is out.  
- Overly diagrammatic styles (e.g. raw constellation graphs without aesthetics) unless stylized.  
- Overly complex ML pipelines or LLM directors (like Resonance’s Claude) – out of scope for hackathon.  
- Any “cosmic / gravity” metaphor unless purely aesthetic.  We will not pretend notes have physical magnetic forces; if we use attractors, they are just compute analogies.

We will borrow code patterns from existing projects (e.g. fluids from Chroma-Flow, boids from PSCactux) but *re-purpose them around our music-driven logic*.  By modularizing (score → mapping → motion → render), we allow remixing in the future (even post-hackathon, composers could script their own grammars).

**Conclusion:**  Harmoglyph’s vision is to let people *compose* music and simultaneously *compose* the motion laws of an artwork, seeing the immediate result.  With the proposed architecture, animation grammars, and careful alignment of music and math (supported by the literature), we can build a compelling instrument.  The MVP for Kiroween will validate the first proofs: e.g. “yes, note durations changed the spiral’s smoothness; the inspector correctly shows pitch→radius mapping”.  Given successful tests, we can confidently pitch that Harmoglyph truly turns “a song into an artwork” – a living piece whose beauty is grounded in its music.

**Sources:** As cited above (and in our browser research notes), including academic work on phyllotaxis, known generative projects, and open libraries and repositories. Each key design point above is either implemented in those examples or discussed in relevant literature, ensuring our plan is evidence-backed. Each proposed component will be implemented and tested against these references (e.g. we can show that our spiral truly follows Vogel’s formula with music-based divergence).
