import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  ArtModeId,
  EvaluatedRowStep,
  MathFoundationId,
} from '../types/chimera';
import { chimeraAudio } from '../engine/audioSynth';
import {
  GOLDEN_ANGLE_RAD,
  PHI,
  Sculpture3DParams,
  mapMathToSculpture3DParams,
} from '../engine/mathArtTheory';

interface HarmonicThreeStageProps {
  steps: EvaluatedRowStep[];
  activeRow: number;
  isPlaying: boolean;
  bpm: number;
  artMode: ArtModeId;
  foundation: MathFoundationId;
  imperfection?: number;
  waveform: number[];
  onSelectRow?: (row: number) => void;
}

const WAVE_BINS = 32;
const WAVE_RING_SEGMENTS = 128;
const MAX_NODE_INSTANCES = 48;

// Pre-allocated math helpers outside render loop (zero per-frame GC)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _liveWaveBuf = new Float32Array(WAVE_BINS);
const _smoothedWave = new Float32Array(WAVE_BINS);

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(0, 229, 204, 0.22)');
    grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.45)');
    grad.addColorStop(1, 'rgba(7, 9, 14, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Sample smoothed waveform buffer at normalized t in [0, 1) using cosine interpolation.
 */
function sampleSmoothedWaveAt(buf: Float32Array, t: number): number {
  const n = buf.length;
  const wrapped = ((t % 1) + 1) % 1;
  const pos = wrapped * n;
  const i0 = Math.floor(pos) % n;
  const i1 = (i0 + 1) % n;
  const frac = pos - Math.floor(pos);
  const mu = (1 - Math.cos(frac * Math.PI)) * 0.5;
  return buf[i0] * (1 - mu) + buf[i1] * mu;
}

/**
 * Writes a 3D harmonic manifold point into `target` for normalized parameter t in [0, 1].
 */
function computeHarmonicPoint(
  target: THREE.Vector3,
  t: number,
  steps: EvaluatedRowStep[],
  artMode: ArtModeId,
  foundation: MathFoundationId,
  timeSec: number,
  sculptParams?: Sculpture3DParams,
  imperfection = 0,
): THREE.Vector3 {
  const count = Math.max(1, steps.length);
  const floatIdx = t * count;
  const idx0 = Math.floor(floatIdx) % count;
  const idx1 = (idx0 + 1) % count;
  const frac = floatIdx - Math.floor(floatIdx);

  const s0 = steps[idx0];
  const s1 = steps[idx1];

  const freqHz = THREE.MathUtils.lerp(s0?.freqHz ?? 261.63, s1?.freqHz ?? 261.63, frac);
  const fmIndex = THREE.MathUtils.lerp(s0?.fmIndex ?? 2.0, s1?.fmIndex ?? 2.0, frac);
  const orbitX = THREE.MathUtils.lerp(s0?.orbitX ?? 50, s1?.orbitX ?? 50, frac);
  const modRatio = THREE.MathUtils.lerp(s0?.modRatio ?? 2.0, s1?.modRatio ?? 2.0, frac);

  const pitchNorm = THREE.MathUtils.clamp(Math.log2(Math.max(40, freqHz) / 110) / 4.2, 0.1, 1.4);
  const fmNorm = THREE.MathUtils.clamp(fmIndex / 8, 0.08, 1.25);
  const phaseRad = ((orbitX - 50) / 50) * Math.PI + imperfection * Math.sin(t * Math.PI * 3 * PHI) * 0.65;
  const orbitScale = sculptParams ? sculptParams.sampleOrbitScaleAt(t, s0) : 1.0;

  const foundationMult =
    foundation === 'golden-ratio'
      ? PHI
      : foundation === 'fibonacci'
        ? 1.6
        : foundation === 'pythagorean'
          ? 1.5
          : 1.0;

  const u = t * Math.PI * 2;
  const breathe = Math.sin(timeSec * 1.15 + u * (2 + imperfection * 2)) * (0.06 + imperfection * 0.12);

  if (artMode === 'mandala') {
    const petals = sculptParams?.lobeOrder ?? (foundation === 'fibonacci' ? 8 : foundation === 'golden-ratio' ? 5 : 6);
    const rBase = (2.45 + 0.78 * Math.cos(petals * u + phaseRad * 0.5) * (0.65 + 0.35 * pitchNorm)) * orbitScale;
    const zWave =
      1.02 * Math.sin(petals * u + timeSec * 0.6) * (0.5 + 0.5 * fmNorm) +
      0.3 * Math.cos(u * modRatio * foundationMult);
    return target.set(
      (rBase + breathe) * Math.cos(u),
      zWave,
      (rBase + breathe) * Math.sin(u),
    );
  }

  if (artMode === 'ribbon') {
    const turns = 3;
    const angle = u * turns + (sculptParams?.angularTwist ?? 0) * t * 0.5;
    const radius = (2.15 + 0.58 * Math.sin(u * 4 + phaseRad) * pitchNorm) * orbitScale + breathe;
    const yHeight = (t - 0.5) * 4.2 + 0.42 * Math.cos(angle * foundationMult + timeSec * 0.8) * fmNorm;
    return target.set(radius * Math.cos(angle), yHeight, radius * Math.sin(angle));
  }

  if (artMode === 'pitch-spiral') {
    const spiralAngle = t * GOLDEN_ANGLE_RAD * count * 1.35 + phaseRad * 0.25 + (sculptParams?.angularTwist ?? 0) * t;
    const r = (0.78 + 2.35 * Math.sqrt(t) * (0.78 + 0.25 * pitchNorm)) * orbitScale + breathe;
    const y = (0.5 - t) * 3.7 + 0.52 * Math.sin(t * Math.PI * 6 + timeSec) * fmNorm;
    return target.set(r * Math.cos(spiralAngle), y, r * Math.sin(spiralAngle));
  }

  // Default ('harmonograph'): 3D Parametric Torus-Knot Attractor
  const p = 2;
  const q = foundation === 'pythagorean' ? 3 : foundation === 'fibonacci' ? 5 : 3;
  const knotR = (2.15 + (0.68 + 0.32 * pitchNorm) * Math.cos(q * u + phaseRad * 0.35)) * orbitScale + breathe;
  const x = knotR * Math.cos(p * u);
  const z = knotR * Math.sin(p * u);
  const y =
    (1.22 + 0.44 * fmNorm) * Math.sin(q * u + phaseRad * 0.35) +
    0.26 * Math.cos(u * modRatio * 2 * foundationMult);

  return target.set(x, y, z);
}

export function HarmonicThreeStage({
  steps,
  activeRow,
  isPlaying,
  bpm,
  artMode,
  foundation,
  imperfection = 0,
  waveform,
  onSelectRow,
}: HarmonicThreeStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [orbitPaused, setOrbitPaused] = useState<boolean>(false);
  const [webglFallback, setWebglFallback] = useState<boolean>(false);

  const stateRef = useRef({
    steps,
    activeRow,
    isPlaying,
    bpm,
    artMode,
    foundation,
    imperfection,
    waveform,
    orbitPaused,
    onSelectRow,
    geometryDirty: true,
  });

  useEffect(() => {
    const prev = stateRef.current;
    const stepsChanged =
      prev.steps !== steps ||
      prev.artMode !== artMode ||
      prev.foundation !== foundation ||
      prev.imperfection !== imperfection;
    stateRef.current = {
      steps,
      activeRow,
      isPlaying,
      bpm,
      artMode,
      foundation,
      imperfection,
      waveform,
      orbitPaused,
      onSelectRow,
      geometryDirty: prev.geometryDirty || stepsChanged,
    };
  }, [steps, activeRow, isPlaying, bpm, artMode, foundation, imperfection, waveform, orbitPaused, onSelectRow]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    const gl = renderer.getContext();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x07090e, 1);

    const canvas = renderer.domElement;
    canvas.className = 'block w-full h-full cursor-grab active:cursor-grabbing focus:outline-none';
    container.innerHTML = '';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    const handleContextRestored = () => {
      setWebglFallback(false);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // Scene, Horizon Fog & Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.35, 8.4);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 15.5;
    controls.autoRotate = !isSoftwareGl;
    controls.autoRotateSpeed = 0.85;
    controls.target.set(0, 0, 0);

    // Balanced Three-Point Studio Lighting + Warm/Cool Hemisphere Contrast
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.0);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    scene.add(keyLight);

    const cyanRimLight = new THREE.PointLight(0x00e5cc, 4.4, 18, 1.45);
    cyanRimLight.position.set(-4.5, 2.5, -3.5);
    scene.add(cyanRimLight);

    const amberFillLight = new THREE.PointLight(0xf59e0b, 3.0, 18, 1.45);
    amberFillLight.position.set(4.5, -2.5, 3.0);
    scene.add(amberFillLight);

    const corePulseLight = new THREE.PointLight(0x38bdf8, 2.2, 11, 1.4);
    corePulseLight.position.set(0, 0, 0);
    scene.add(corePulseLight);

    // Acoustic Polar Stage Floor + Soft Contact Shadow Grounding
    const polarFloor = new THREE.PolarGridHelper(6.6, 12, 5, 64, 0x0f2b3c, 0x111827);
    polarFloor.position.y = -2.6;
    scene.add(polarFloor);

    const contactTex = createContactShadowTexture();
    contactTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const contactPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 8.5),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      }),
    );
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = -2.58;
    scene.add(contactPlane);

    resetCameraRef.current = () => {
      camera.position.set(0, 2.35, 8.4);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    // Composite Harmonic Sculpture Group
    const sculptureGroup = new THREE.Group();
    scene.add(sculptureGroup);

    // 1. Primary Waveform-Deformed Parametric Manifold Ribbon (TubeGeometry)
    const primaryMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0ea5e9),
      emissive: new THREE.Color(0x005248),
      emissiveIntensity: 0.52,
      metalness: 0.82,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      iridescence: 0.45,
      iridescenceIOR: 1.32,
    });
    const seedCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-2, 0, 0),
        new THREE.Vector3(0, 2, 0),
        new THREE.Vector3(2, 0, 0),
        new THREE.Vector3(0, -2, 0),
      ],
      true,
    );
    const tubularSegs = isSoftwareGl ? 80 : 144;
    const radialSegs = isSoftwareGl ? 8 : 12;
    const primaryMesh = new THREE.Mesh(
      new THREE.TubeGeometry(seedCurve, tubularSegs, 0.095, radialSegs, true),
      primaryMaterial,
    );
    primaryMesh.frustumCulled = false;
    sculptureGroup.add(primaryMesh);

    // 2. Secondary Counter-Phase Golden Filament
    const secondaryMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf59e0b),
      emissive: new THREE.Color(0x92400e),
      emissiveIntensity: 0.45,
      metalness: 0.88,
      roughness: 0.28,
    });
    const secondaryMesh = new THREE.Mesh(
      new THREE.TubeGeometry(seedCurve, Math.round(tubularSegs * 0.75), 0.036, 6, true),
      secondaryMaterial,
    );
    secondaryMesh.frustumCulled = false;
    sculptureGroup.add(secondaryMesh);

    // Cached base buffers for zero-GC real-time waveform vertex displacement on primary & secondary manifolds
    let primaryBasePos = new Float32Array(0);
    let primaryBaseNorm = new Float32Array(0);
    let primaryRingCount = tubularSegs + 1;
    let primaryVertsPerRing = radialSegs + 1;
    let secondaryBasePos = new Float32Array(0);
    let secondaryBaseNorm = new Float32Array(0);
    let secondaryRingCount = Math.round(tubularSegs * 0.75) + 1;
    let secondaryVertsPerRing = 6 + 1;

    // 3. 3D Equatorial Waveform Corona Loops (128-vertex dynamic oscilloscope geometry)
    const waveRingGeo = new THREE.BufferGeometry();
    const waveRingPos = new Float32Array(WAVE_RING_SEGMENTS * 3);
    waveRingGeo.setAttribute('position', new THREE.BufferAttribute(waveRingPos, 3));
    const waveRingMat = new THREE.LineBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.92,
    });
    const waveRingLoop = new THREE.LineLoop(waveRingGeo, waveRingMat);
    waveRingLoop.frustumCulled = false;
    sculptureGroup.add(waveRingLoop);

    const waveEchoGeo = new THREE.BufferGeometry();
    const waveEchoPos = new Float32Array(WAVE_RING_SEGMENTS * 3);
    waveEchoGeo.setAttribute('position', new THREE.BufferAttribute(waveEchoPos, 3));
    const waveEchoMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.7,
    });
    const waveEchoLoop = new THREE.LineLoop(waveEchoGeo, waveEchoMat);
    waveEchoLoop.frustumCulled = false;
    sculptureGroup.add(waveEchoLoop);

    // 4. 32 Radial Waveform Resonator Bars (InstancedMesh mapped 1:1 to waveform bins)
    const barGeo = new THREE.BoxGeometry(0.065, 1, 0.065);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00e5cc,
      emissiveIntensity: 0.55,
      metalness: 0.45,
      roughness: 0.25,
    });
    const waveformBarsMesh = new THREE.InstancedMesh(barGeo, barMat, WAVE_BINS);
    waveformBarsMesh.frustumCulled = false;
    waveformBarsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    waveformBarsMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(WAVE_BINS * 3),
      3,
    );
    sculptureGroup.add(waveformBarsMesh);

    // 5. 48 Spreadsheet Step Resonator Nodes (InstancedMesh Octahedra)
    const nodeGeo = new THREE.OctahedronGeometry(0.185, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00e5cc,
      emissiveIntensity: 0.35,
      metalness: 0.55,
      roughness: 0.22,
    });
    const instancedNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, MAX_NODE_INSTANCES);
    instancedNodes.frustumCulled = false;
    instancedNodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedNodes.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_NODE_INSTANCES * 3),
      3,
    );
    sculptureGroup.add(instancedNodes);

    // 6. Active Step Spotlight Halo Sphere
    const haloGeo = new THREE.IcosahedronGeometry(0.32, 1);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00e5cc,
      wireframe: true,
      transparent: true,
      opacity: 0.9,
    });
    const activeHaloMesh = new THREE.Mesh(haloGeo, haloMat);
    sculptureGroup.add(activeHaloMesh);

    // 7. Audio-Reactive Harmonic Core Crystal & Gyroscopic Cymatic Rings
    const coreGroup = new THREE.Group();
    sculptureGroup.add(coreGroup);

    const coreGeo = new THREE.IcosahedronGeometry(0.66, isSoftwareGl ? 1 : 2);
    const coreBasePos = new Float32Array(coreGeo.attributes.position.array);
    const coreBaseNorm = new Float32Array(coreGeo.attributes.normal.array);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x111622,
      emissive: 0x00e5cc,
      emissiveIntensity: 0.32,
      metalness: 0.35,
      roughness: 0.14,
      clearcoat: 1.0,
      flatShading: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreGroup.add(coreMesh);

    const coreWireGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.7, 1));
    const coreWireMat = new THREE.LineBasicMaterial({
      color: 0x00e5cc,
      transparent: true,
      opacity: 0.6,
    });
    const coreWire = new THREE.LineSegments(coreWireGeo, coreWireMat);
    coreMesh.add(coreWire);

    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x00e5cc,
      emissiveIntensity: 0.22,
      metalness: 0.92,
      roughness: 0.2,
    });
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.18,
      metalness: 0.88,
      roughness: 0.26,
    });

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(3.45, 0.022, 12, isSoftwareGl ? 64 : 110),
      ringMat1,
    );
    ring1.rotation.x = Math.PI / 2.3;
    coreGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(3.85, 0.018, 12, isSoftwareGl ? 64 : 110),
      ringMat2,
    );
    ring2.rotation.y = Math.PI / 3.1;
    ring2.rotation.x = Math.PI / 5;
    coreGroup.add(ring2);

    // 8. Harmonic Starfield Dust
    const dustCount = isSoftwareGl ? 90 : 240;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const r = 4.6 + (i % 17) * 0.28;
      const theta = i * GOLDEN_ANGLE_RAD;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / dustCount);
      dustPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dustPositions[i * 3 + 1] = r * Math.cos(phi) * 0.65;
      dustPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.045,
      transparent: true,
      opacity: 0.48,
      sizeAttenuation: true,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // 9. Post-Processing Composer with UnrealBloomPass + OutputPass (GPU path)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.72, // strength (modulated dynamically by audio energy)
        0.42, // radius
        0.52, // threshold
      );
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    const nodeBasePositions: THREE.Vector3[] = [];
    let activeSculptParams: Sculpture3DParams = mapMathToSculpture3DParams(
      stateRef.current.steps,
      stateRef.current.foundation,
      isSoftwareGl,
      stateRef.current.imperfection,
    );

    const rebuildSculptureGeometry = (timeSec: number) => {
      const { steps: curSteps, artMode: curMode, foundation: curFound, imperfection: curImp } = stateRef.current;
      const safeSteps = curSteps.length > 0 ? curSteps : [];
      activeSculptParams = mapMathToSculpture3DParams(safeSteps, curFound, isSoftwareGl, curImp);

      const sampleCount = activeSculptParams.vertexCount;
      const dynamicTubularSegs = activeSculptParams.tubularSegments;
      const primaryPts: THREE.Vector3[] = [];
      const secondaryPts: THREE.Vector3[] = [];

      for (let i = 0; i < sampleCount; i++) {
        const t = i / sampleCount;
        const pt = computeHarmonicPoint(
          new THREE.Vector3(),
          t,
          safeSteps,
          curMode,
          curFound,
          timeSec,
          activeSculptParams,
          curImp,
        );
        primaryPts.push(pt);

        const offsetPt = pt.clone().multiplyScalar(0.84);
        offsetPt.y += Math.cos(t * Math.PI * 6) * 0.22;
        secondaryPts.push(offsetPt);
      }

      const closed = curMode !== 'ribbon' && curMode !== 'pitch-spiral';
      const curve1 = new THREE.CatmullRomCurve3(primaryPts, closed);
      const curve2 = new THREE.CatmullRomCurve3(secondaryPts, closed);

      const nextPrimaryGeo = new THREE.TubeGeometry(curve1, dynamicTubularSegs, 0.095, radialSegs, closed);
      primaryMesh.geometry.dispose();
      primaryMesh.geometry = nextPrimaryGeo;
      primaryBasePos = new Float32Array(nextPrimaryGeo.attributes.position.array);
      primaryBaseNorm = new Float32Array(nextPrimaryGeo.attributes.normal.array);
      primaryRingCount = dynamicTubularSegs + 1;
      primaryVertsPerRing = radialSegs + 1;

      const secSegs = Math.round(dynamicTubularSegs * 0.75);
      const nextSecondaryGeo = new THREE.TubeGeometry(curve2, secSegs, 0.038, 6, closed);
      secondaryMesh.geometry.dispose();
      secondaryMesh.geometry = nextSecondaryGeo;
      secondaryBasePos = new Float32Array(nextSecondaryGeo.attributes.position.array);
      secondaryBaseNorm = new Float32Array(nextSecondaryGeo.attributes.normal.array);
      secondaryRingCount = secSegs + 1;
      secondaryVertsPerRing = 6 + 1;

      nodeBasePositions.length = 0;
      const totalRows = Math.min(MAX_NODE_INSTANCES, Math.max(1, safeSteps.length));
      for (let r = 0; r < totalRows; r++) {
        const u = totalRows <= 1 ? 0 : r / totalRows;
        nodeBasePositions.push(
          computeHarmonicPoint(
            new THREE.Vector3(),
            u,
            safeSteps,
            curMode,
            curFound,
            timeSec,
            activeSculptParams,
            curImp,
          ),
        );
      }
    };

    rebuildSculptureGeometry(0);
    stateRef.current.geometryDirty = false;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster for clicking & hovering formula step nodes
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const getIntersectedRow = (clientX: number, clientY: number): number | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(instancedNodes, false);
      if (hits.length > 0 && typeof hits[0].instanceId === 'number') {
        const rowNum = hits[0].instanceId + 1;
        if (rowNum <= stateRef.current.steps.length) {
          return rowNum;
        }
      }
      return null;
    };

    let pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist < 6) {
        const hitRow = getIntersectedRow(e.clientX, e.clientY);
        if (hitRow && stateRef.current.onSelectRow) {
          stateRef.current.onSelectRow(hitRow);
        }
      }
    };
    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;
      const hitRow = getIntersectedRow(e.clientX, e.clientY);
      setHoveredRow((prev) => (prev !== hitRow ? hitRow : prev));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);

    // ResizeObserver for crisp responsive sizing
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      if (bloomPass) bloomPass.resolution.set(w, h);
    });
    resizeObserver.observe(container);

    // Software WebGL GPU fence pacing (SKILL.md §2.3)
    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl2 = gl as WebGL2RenderingContext;
      if (typeof gl2.fenceSync !== 'function' || typeof gl2.getSyncParameter !== 'function') {
        timeoutId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl2.flush();
      if (!sync) {
        timeoutId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl2.deleteSync(sync);
          return;
        }
        const status = gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
        if (status === gl2.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          gl2.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    const clock = new THREE.Clock();
    let dampedRms = 0.14;
    let dampedPeak = 0.2;
    let dampedBloom = 0.72;
    let dampedOrbitScale = activeSculptParams.orbitRadiusScale;
    let dampedCoronaScale = activeSculptParams.coronaRadiusScale;

    function tick() {
      if (disposed) return;

      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const {
        steps: curSteps,
        activeRow: curActiveRow,
        isPlaying: curPlaying,
        bpm: curBpm,
        foundation: curFoundation,
        imperfection: curImperfection,
        waveform: curPropWave,
        orbitPaused: curOrbitPaused,
        geometryDirty,
      } = stateRef.current;

      if (geometryDirty) {
        rebuildSculptureGeometry(elapsed);
        stateRef.current.geometryDirty = false;
      }

      const activeIdx = Math.max(0, Math.min(curSteps.length - 1, curActiveRow - 1));
      const activeStep = curSteps[activeIdx];
      const modRatio = activeStep?.modRatio ?? 2;

      // 1. Sample real-time 60fps audio waveform (AnalyserNode when playing, FM synth + prop blend when idle)
      chimeraAudio.sampleWaveformInto(
        _liveWaveBuf,
        activeStep,
        curFoundation,
        curPlaying ? elapsed * 4.5 : elapsed * 1.4,
        curImperfection,
      );

      let sumSq = 0;
      let peakAbs = 0;
      for (let i = 0; i < WAVE_BINS; i++) {
        const propSample = curPropWave && curPropWave.length > 0 ? (curPropWave[i % curPropWave.length] ?? 0) : 0;
        const targetSample = curPlaying ? _liveWaveBuf[i] : _liveWaveBuf[i] * 0.65 + propSample * 0.35;
        _smoothedWave[i] = THREE.MathUtils.damp(_smoothedWave[i], targetSample, 18, delta);
        const absV = Math.abs(_smoothedWave[i]);
        sumSq += _smoothedWave[i] * _smoothedWave[i];
        if (absV > peakAbs) peakAbs = absV;
      }
      const rawRms = Math.min(1, Math.sqrt(sumSq / WAVE_BINS));
      dampedRms = THREE.MathUtils.damp(dampedRms, rawRms, 10, delta);
      dampedPeak = THREE.MathUtils.damp(dampedPeak, peakAbs, 12, delta);

      // 2. Map current waveform values directly onto Primary & Secondary TubeGeometry vertices
      const primPosAttr = primaryMesh.geometry.attributes.position;
      if (primPosAttr && primaryBasePos.length === primPosAttr.array.length) {
        const arr = primPosAttr.array as Float32Array;
        const rippleScale = curPlaying ? 0.34 : 0.18;
        for (let ring = 0; ring < primaryRingCount; ring++) {
          const t = ring / Math.max(1, primaryRingCount - 1);
          const wVal = sampleSmoothedWaveAt(_smoothedWave, t);
          const harmonicStanding = Math.sin(t * Math.PI * 2 * modRatio + elapsed * 3.2) * 0.04;
          const radialBoost = 1 + wVal * 0.14 + harmonicStanding;
          const tubeSwell = wVal * rippleScale;

          for (let v = 0; v < primaryVertsPerRing; v++) {
            const idx = (ring * primaryVertsPerRing + v) * 3;
            arr[idx] = primaryBasePos[idx] * radialBoost + primaryBaseNorm[idx] * tubeSwell;
            arr[idx + 1] = primaryBasePos[idx + 1] + primaryBaseNorm[idx + 1] * tubeSwell + wVal * 0.12;
            arr[idx + 2] = primaryBasePos[idx + 2] * radialBoost + primaryBaseNorm[idx + 2] * tubeSwell;
          }
        }
        primPosAttr.needsUpdate = true;
      }

      const secPosAttr = secondaryMesh.geometry.attributes.position;
      if (secPosAttr && secondaryBasePos.length === secPosAttr.array.length) {
        const arr = secPosAttr.array as Float32Array;
        const secSwellScale = curPlaying ? 0.24 : 0.12;
        for (let ring = 0; ring < secondaryRingCount; ring++) {
          const t = ring / Math.max(1, secondaryRingCount - 1);
          const wVal = sampleSmoothedWaveAt(_smoothedWave, 1 - t);
          const radialBoost = 1 - wVal * 0.11;
          for (let v = 0; v < secondaryVertsPerRing; v++) {
            const idx = (ring * secondaryVertsPerRing + v) * 3;
            arr[idx] = secondaryBasePos[idx] * radialBoost + secondaryBaseNorm[idx] * wVal * secSwellScale;
            arr[idx + 1] = secondaryBasePos[idx + 1] + secondaryBaseNorm[idx + 1] * wVal * secSwellScale;
            arr[idx + 2] = secondaryBasePos[idx + 2] * radialBoost + secondaryBaseNorm[idx + 2] * wVal * secSwellScale;
          }
        }
        secPosAttr.needsUpdate = true;
      }

      dampedOrbitScale = THREE.MathUtils.damp(dampedOrbitScale, activeSculptParams.orbitRadiusScale, 6, delta);
      dampedCoronaScale = THREE.MathUtils.damp(dampedCoronaScale, activeSculptParams.coronaRadiusScale, 6, delta);

      // 3. Map current waveform values onto 3D Equatorial Waveform Corona Loops
      const ringPosAttr = waveRingGeo.attributes.position as THREE.BufferAttribute;
      const echoPosAttr = waveEchoGeo.attributes.position as THREE.BufferAttribute;
      const baseCoronaR = 3.1 * dampedCoronaScale;
      for (let i = 0; i < WAVE_RING_SEGMENTS; i++) {
        const t = i / WAVE_RING_SEGMENTS;
        const angle = t * Math.PI * 2;
        const w = sampleSmoothedWaveAt(_smoothedWave, t);
        const r = baseCoronaR + w * (curPlaying ? 1.15 : 0.65);
        const y = w * (curPlaying ? 0.92 : 0.45);
        ringPosAttr.setXYZ(i, Math.cos(angle) * r, y, Math.sin(angle) * r);

        const wEcho = sampleSmoothedWaveAt(_smoothedWave, t + 0.25);
        const rEcho = baseCoronaR * 0.78 - wEcho * (curPlaying ? 0.7 : 0.35);
        const yEcho = -wEcho * (curPlaying ? 0.68 : 0.32) + 0.12 * Math.sin(angle * 3 + elapsed * 2);
        echoPosAttr.setXYZ(i, Math.cos(angle) * rEcho, yEcho, Math.sin(angle) * rEcho);
      }
      ringPosAttr.needsUpdate = true;
      echoPosAttr.needsUpdate = true;

      // 4. Update 32 Radial Harmonic Resonator Bars (1:1 waveform bin mapping)
      const barRadius = 1.55 * dampedOrbitScale;
      for (let i = 0; i < WAVE_BINS; i++) {
        const angle = (i / WAVE_BINS) * Math.PI * 2 + elapsed * 0.18;
        const w = _smoothedWave[i];
        const amp = Math.abs(w);
        const barHeight = 0.22 + amp * (curPlaying ? 1.65 : 0.95);

        _dummy.position.set(
          Math.cos(angle) * barRadius,
          w * 0.36,
          Math.sin(angle) * barRadius,
        );
        _dummy.rotation.set(0, -angle, w * 0.35);
        _dummy.scale.set(1, barHeight, 1);
        _dummy.updateMatrix();
        waveformBarsMesh.setMatrixAt(i, _dummy.matrix);

        // Shift hue smoothly from cyan (#00E5CC) toward golden amber (#F59E0B) on loud peaks
        const hue = THREE.MathUtils.lerp(0.48, 0.1, THREE.MathUtils.clamp(amp * 1.15, 0, 1));
        _color.setHSL(hue, 0.92, 0.52 + amp * 0.22);
        waveformBarsMesh.setColorAt(i, _color);
      }
      waveformBarsMesh.instanceMatrix.needsUpdate = true;
      if (waveformBarsMesh.instanceColor) waveformBarsMesh.instanceColor.needsUpdate = true;

      // 5. Update 48 Spreadsheet Step Resonator Nodes
      const totalRows = Math.min(MAX_NODE_INSTANCES, curSteps.length);
      for (let i = 0; i < MAX_NODE_INSTANCES; i++) {
        if (i >= totalRows || !nodeBasePositions[i]) {
          _dummy.position.set(0, 0, 0);
          _dummy.scale.setScalar(0.0001);
          _dummy.updateMatrix();
          instancedNodes.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        const step = curSteps[i];
        const basePos = nodeBasePositions[i];
        const binWave = _smoothedWave[i % WAVE_BINS];
        const isCurrent = i === activeIdx;
        const gateScale = step && step.gate <= 0.02 ? 0.45 : 1.0;
        const pulse = isCurrent
          ? 1.7 + dampedRms * 1.15
          : gateScale * (0.85 + Math.abs(binWave) * 0.45);

        _vec3A.copy(basePos).multiplyScalar(1 + binWave * 0.09);
        _vec3A.y += binWave * 0.14;
        _dummy.position.copy(_vec3A);
        _dummy.rotation.set(elapsed * 0.7 + i * 0.2, elapsed * 0.9 + i * 0.3, 0);
        _dummy.scale.setScalar(pulse);
        _dummy.updateMatrix();
        instancedNodes.setMatrixAt(i, _dummy.matrix);

        if (isCurrent) {
          _color.setHex(0x00e5cc);
          activeHaloMesh.position.copy(_vec3A);
          activeHaloMesh.rotation.set(-elapsed * 1.4, elapsed * 1.8, 0);
          activeHaloMesh.scale.setScalar(1.15 + dampedPeak * 0.95);
        } else if (step && step.gate <= 0.02) {
          _color.setHex(0x334155);
        } else {
          const hue = (0.52 + (i / Math.max(1, totalRows)) * 0.16) % 1;
          _color.setHSL(hue, 0.85, 0.54 + Math.abs(binWave) * 0.14);
        }
        instancedNodes.setColorAt(i, _color);
      }
      instancedNodes.instanceMatrix.needsUpdate = true;
      if (instancedNodes.instanceColor) instancedNodes.instanceColor.needsUpdate = true;

      // 6. Audio-Reactive Harmonic Core Vertex Morphing & Gyroscopic Rings
      const corePosAttr = coreGeo.attributes.position as THREE.BufferAttribute;
      const corePosArr = corePosAttr.array as Float32Array;
      const coreDispGain = curPlaying ? 0.32 : 0.16;
      for (let i = 0; i < corePosAttr.count; i++) {
        const idx = i * 3;
        const bx = coreBasePos[idx];
        const by = coreBasePos[idx + 1];
        const bz = coreBasePos[idx + 2];
        const angleNorm = (Math.atan2(bz, bx) + Math.PI) / (Math.PI * 2);
        const w = sampleSmoothedWaveAt(_smoothedWave, angleNorm + by * 0.25);
        const disp = 1 + w * coreDispGain + dampedRms * 0.12;
        corePosArr[idx] = bx * disp + coreBaseNorm[idx] * dampedPeak * 0.05;
        corePosArr[idx + 1] = by * disp + coreBaseNorm[idx + 1] * dampedPeak * 0.05;
        corePosArr[idx + 2] = bz * disp + coreBaseNorm[idx + 2] * dampedPeak * 0.05;
      }
      corePosAttr.needsUpdate = true;

      const beatSpeed = curPlaying ? (curBpm / 120) * 1.2 : 0.38;
      if (!curOrbitPaused) {
        sculptureGroup.rotation.y += delta * 0.16 * beatSpeed;
      }
      coreMesh.rotation.x = elapsed * 0.45 * beatSpeed;
      coreMesh.rotation.y = elapsed * 0.65 * beatSpeed;
      const targetCoreScale = 0.94 + dampedRms * (curPlaying ? 0.45 : 0.18);
      coreMesh.scale.setScalar(THREE.MathUtils.damp(coreMesh.scale.x, targetCoreScale, 12, delta));

      ring1.scale.setScalar(dampedCoronaScale);
      ring2.scale.setScalar(dampedCoronaScale);
      ring1.rotation.z = elapsed * 0.32 * modRatio * 0.5;
      ring2.rotation.x = Math.PI / 5 + elapsed * 0.24 * beatSpeed;
      dustPoints.rotation.y = -elapsed * 0.05;

      // 7. Dynamic Bloom Post-Processing & Emissive Energy Coupling
      const targetBloom = (curPlaying ? 0.72 : 0.56) + dampedRms * 0.68 + dampedPeak * 0.32;
      dampedBloom = THREE.MathUtils.damp(dampedBloom, targetBloom, 10, delta);

      primaryMaterial.emissiveIntensity = 0.38 + dampedRms * 0.95;
      secondaryMaterial.emissiveIntensity = 0.32 + dampedPeak * 0.65;
      coreMat.emissiveIntensity = 0.28 + dampedRms * 0.85;
      cyanRimLight.intensity = 3.8 + dampedRms * 4.5;
      corePulseLight.intensity = 1.8 + dampedPeak * 4.2;

      if (bloomPass) {
        bloomPass.strength = dampedBloom;
        bloomPass.radius = 0.36 + dampedRms * 0.26;
      }

      controls.autoRotate = !isSoftwareGl && !curOrbitPaused;
      controls.autoRotateSpeed = curPlaying ? 1.3 : 0.6;
      controls.update();

      if (isSoftwareGl || !composer) {
        renderer.render(scene, camera);
      } else {
        composer.render();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        rafId = window.requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      rafId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      if (composer) composer.dispose();
      contactTex.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat?.dispose();
        }
      });
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  const hoveredStep = hoveredRow ? steps[hoveredRow - 1] : null;

  return (
    <div className="relative w-full h-full bg-[#07090E] overflow-hidden select-none">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Interactive 3D Harmonic Sculpture — waveform-reactive Three.js scene with UnrealBloomPass, drag to orbit, scroll to zoom, click any node to trigger its formula step"
      />

      {/* Top-Right Camera & Orbit Controls + Hovered Node Telemetry */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOrbitPaused((v) => !v)}
            className="px-2.5 py-1 rounded-md border border-[#1E293B] bg-[#0B0F17] text-[11px] font-mono text-[#8A99B8] hover:text-[#00E5CC] hover:border-[#00E5CC] cursor-pointer shadow-lg whitespace-nowrap"
          >
            {orbitPaused ? 'Resume Orbit' : 'Pause Orbit'}
          </button>
          <button
            type="button"
            onClick={() => resetCameraRef.current?.()}
            className="px-2.5 py-1 rounded-md border border-[#1E293B] bg-[#0B0F17] text-[11px] font-mono text-[#8A99B8] hover:text-[#00E5CC] hover:border-[#00E5CC] cursor-pointer shadow-lg whitespace-nowrap"
          >
            Reset 3D View
          </button>
        </div>

        {hoveredStep && (
          <div className="pointer-events-none rounded-md border border-[#00E5CC]/60 bg-[#0B0F17] px-3 py-2 text-xs shadow-lg">
            <div className="font-mono-tabular font-semibold text-[#00E5CC]">
              Node Row #{hoveredStep.row} · {hoveredStep.noteName} ({hoveredStep.freqHz.toFixed(1)} Hz)
            </div>
            <div className="font-mono-tabular text-[11px] text-[#8A99B8] mt-0.5">
              FM Mod: {hoveredStep.fmIndex.toFixed(2)} · Ratio: {hoveredStep.modRatio.toFixed(2)}x · Click node to trigger
            </div>
          </div>
        )}
      </div>

      {/* Graceful Static Fallback if WebGL is unavailable */}
      {webglFallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#07090E] p-6 text-center">
          <div className="max-w-md rounded-lg border border-[#1F2A40] bg-[#0B0F17] p-5">
            <div className="font-display text-sm font-bold text-[#00E5CC]">
              Harmonic Geometry Engine Active
            </div>
            <p className="text-xs text-[#8A99B8] mt-1">
              3D WebGL hardware context is paused in this browser tab. All {steps.length} formula steps and FM audio synthesis remain active.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
