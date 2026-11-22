import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MusicalComposition } from '../engine/composition';
import { buildScoreSculpture, type SculptureDepth, type SculptureModel } from '../engine/scoreSculpture';
import { FILAMENT_PALETTE } from '../engine/filamentMaterial';

/**
 * Static, rotatable 3D sculpture of a score's completed motion paths.
 * Follows HarmonicThreeStage's three.js conventions (OrbitControls, RoomEnvironment,
 * auto-rotate) but renders the polyphonic score directly instead of the monophonic sheet.
 * The model never changes with playback; rotation runs independently of the transport.
 */
interface Props {
  composition: MusicalComposition;
  depth: SculptureDepth;
  anchorBeats: number[];
}

type ViewName = 'front' | 'side' | 'oblique';

export function ScoreSculptureView({ composition, depth, anchorBeats }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<{ setView: (v: ViewName) => void; setAutoRotate: (on: boolean) => void } | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const model: SculptureModel = useMemo(() => buildScoreSculpture(composition, depth, { anchorBeats }), [composition, depth, anchorBeats]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const width = host.clientWidth || 600, height = host.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(FILAMENT_PALETTE.ground);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xfff2dc, 1.4); key.position.set(200, 300, 400); scene.add(key);

    // Model, centred on its bounds.
    const group = new THREE.Group();
    const { min, max } = model.bounds;
    const centre = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    group.position.copy(centre).multiplyScalar(-1);
    scene.add(group);
    const disposables: Array<{ dispose: () => void }> = [];
    const hue = (i: number) => new THREE.Color(FILAMENT_PALETTE.voices[i % FILAMENT_PALETTE.voices.length]);

    for (const v of model.voices) {
      // One tube per contiguous note / rest run, so every note is its own piece (selectable later).
      let start = 0;
      for (let i = 1; i <= v.points.length; i++) {
        if (i < v.points.length && v.noteIds[i] === v.noteIds[start] && v.kinds[i] === v.kinds[start]) continue;
        const end = Math.min(i, v.points.length - 1);
        const pts = v.points.slice(start, end + 1).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
        if (pts.length >= 2) {
          const radius = v.radii.slice(start, end + 1).reduce((a, b) => a + b, 0) / (end - start + 1);
          const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), radius, 10, false);
          const isRest = v.kinds[start] === 'rest';
          const color = isRest ? new THREE.Color(FILAMENT_PALETTE.bone) : hue(v.trackIndex);
          const mat = new THREE.MeshStandardMaterial({ color, emissive: color.clone().multiplyScalar(isRest ? 0.05 : 0.28), roughness: 0.35, metalness: 0.25, transparent: isRest, opacity: isRest ? 0.35 : 1 });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.userData = { noteId: v.noteIds[start], trackId: v.trackId, kind: v.kinds[start] };
          group.add(mesh);
          disposables.push(geom, mat);
        }
        start = i;
      }
    }
    if (model.bridges.length) {
      const pos: number[] = [], col: number[] = [];
      const c = new THREE.Color(FILAMENT_PALETTE.bone);
      for (const b of model.bridges) { pos.push(...b.from, ...b.to); for (let k = 0; k < 2; k++) col.push(c.r * b.strength, c.g * b.strength, c.b * b.strength); }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 });
      group.add(new THREE.LineSegments(geom, mat));
      disposables.push(geom, mat);
    }
    const anchorWorld: Array<{ beat: number; pos: THREE.Vector3 }> = [];
    const sphere = new THREE.SphereGeometry(3.2, 16, 12);
    const sphereMat = new THREE.MeshStandardMaterial({ color: FILAMENT_PALETTE.bone, emissive: new THREE.Color(FILAMENT_PALETTE.bone).multiplyScalar(0.6) });
    disposables.push(sphere, sphereMat);
    for (const a of model.anchors) {
      for (const n of a.notes) {
        if (!n.position.every(Number.isFinite)) continue;
        const m = new THREE.Mesh(sphere, sphereMat);
        m.position.set(...n.position);
        group.add(m);
      }
      const ps = a.notes.filter((n) => n.position.every(Number.isFinite)).map((n) => new THREE.Vector3(...n.position));
      if (ps.length) anchorWorld.push({ beat: a.beat, pos: ps.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / ps.length).sub(centre) });
    }

    // Camera framed on the bounding sphere.
    const radius = Math.max(60, new THREE.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]).length() / 2);
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, radius * 20);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.9;
    const dist = radius / Math.sin((38 / 2) * Math.PI / 180) * 1.08;
    const setView = (name: ViewName) => {
      const [az, el] = name === 'front' ? [0, 0] : name === 'side' ? [90, 0] : [42, 24];
      const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
      camera.position.set(dist * Math.sin(a) * Math.cos(e), dist * Math.sin(e), dist * Math.cos(a) * Math.cos(e));
      controls.target.set(0, 0, 0);
      controls.update();
    };
    setView('oblique');
    apiRef.current = { setView, setAutoRotate: (on) => { controls.autoRotate = on; } };

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      host.dataset.azimuth = ((controls.getAzimuthalAngle() * 180) / Math.PI).toFixed(2);
      host.dataset.polar = ((controls.getPolarAngle() * 180) / Math.PI).toFixed(2);
      host.dataset.ready = '1';
      const labels = labelsRef.current;
      if (labels) anchorWorld.forEach((a, i) => {
        const el = labels.children[i] as HTMLElement | undefined;
        if (!el) return;
        const p = a.pos.clone().project(camera);
        el.style.transform = `translate(${((p.x + 1) / 2) * width}px, ${((1 - p.y) / 2) * height}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, [model]);

  useEffect(() => { apiRef.current?.setAutoRotate(autoRotate); }, [autoRotate, model]);

  return (
    <div className="relative w-full max-w-[640px] aspect-square">
      <div ref={hostRef} role="img" aria-label={`3D sculpture of ${composition.title}, ${depth === 'relief' ? 'shallow relief' : 'voices separated in depth'}. Drag to rotate.`} className="absolute inset-0 rounded-2xl overflow-hidden cursor-grab" data-depth={depth}/>
      <div ref={labelsRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
        {model.anchors.map((a) => (
          <div key={a.beat} data-anchor-beat={a.beat} data-note-ids={a.notes.map((n) => n.noteId).join(',')} className="absolute left-0 top-0 -translate-x-1/2 text-[10px] tracking-[.18em] uppercase text-[#EEEBE4]/80 whitespace-nowrap" style={{ marginTop: '-26px' }}>
            beat {a.beat + 1} · {a.notes.map((n) => n.name).join(' + ')}
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex gap-1" aria-label="Sculpture view">
          {(['front', 'side', 'oblique'] as ViewName[]).map((v) => <button key={v} type="button" onClick={() => apiRef.current?.setView(v)} className="rounded-full border border-[#EEEBE4]/30 px-3 py-1 capitalize text-[#EEEBE4] hover:bg-[#EEEBE4]/10">{v}</button>)}
        </div>
        <button type="button" aria-pressed={autoRotate} onClick={() => setAutoRotate((x) => !x)} className="rounded-full border border-[#EEEBE4]/30 px-3 py-1 text-[#EEEBE4] hover:bg-[#EEEBE4]/10">{autoRotate ? 'Auto-rotate on' : 'Auto-rotate off'}</button>
      </div>
    </div>
  );
}
