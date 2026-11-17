import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize2, RefreshCw } from 'lucide-react';

interface ParsedHookMeta {
  path: string;
  name: string;
  version?: string;
  event: string;
  filePattern?: string;
  enabled: boolean;
  command?: string;
  checks?: string[];
  description: string;
}

interface ColumnBindingSpec {
  parameter: string;
  label: string;
  unit: string;
  clamp: [number, number];
}

interface ParsedSpecsJson {
  name: string;
  category: string;
  version: string;
  description: string;
  kiroSpecsDir: string;
  pipeline: {
    stage1_spreadsheetVm: {
      module: string;
      gridDimensions?: { columns: string[]; rows: number };
      columnBindings?: Record<string, ColumnBindingSpec>;
      supportedFunctions: string[];
      safetyGuarantees: string[];
    };
    stage2_fmSynthesizer: {
      module: string;
      topology: string;
      exports: Record<string, string>;
    };
    stage3_vectorPlotter: {
      module: string;
      viewBox: string;
      projection: string;
      export: string;
    };
  };
  verification: {
    module: string;
    seedDefault: number;
    trialsPerInvariant: number;
    invariants: string[];
  };
}

type NodeKind = 'manifest' | 'spec-doc' | 'stage' | 'binding' | 'verifier' | 'invariant' | 'hook';
type FilterMode = 'all' | 'core' | 'bindings' | 'verification';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  kind: NodeKind;
  filePath: string;
  summary: string;
  details: string[];
  hookMeta?: ParsedHookMeta;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
}

const KIND_META: Record<NodeKind, { color: string; badge: string; radius: number }> = {
  manifest: { color: '#38BDF8', badge: 'Manifest', radius: 15 },
  'spec-doc': { color: '#22D3EE', badge: 'EARS Spec', radius: 12 },
  stage: { color: '#00E5CC', badge: 'Pipeline Stage', radius: 15 },
  binding: { color: '#34D399', badge: 'Col Binding', radius: 10.5 },
  verifier: { color: '#A78BFA', badge: 'PBT Suite', radius: 14 },
  invariant: { color: '#C084FC', badge: 'Invariant', radius: 10.5 },
  hook: { color: '#F59E0B', badge: 'Agent Hook', radius: 13.5 },
};

const INVARIANT_DESCRIPTIONS: Record<string, { targetStage: string; summary: string }> = {
  'cycle-termination': {
    targetStage: 'stage-vm',
    summary: 'Verifies cyclic formula graphs (A1->B1->A1) terminate deterministically with #CYCLE!.',
  },
  'acoustic-clamp': {
    targetStage: 'stage-synth',
    summary: 'Verifies extreme/NaN cell outputs clamp strictly to 20–4000 Hz and master gain <= 0.35.',
  },
  'csv-roundtrip': {
    targetStage: 'stage-vm',
    summary: 'Verifies parseCsvToGrid(gridToCsv(grid)) preserves 100% of formulas and values.',
  },
  'wav-header': {
    targetStage: 'stage-synth',
    summary: 'Verifies offline 16-bit PCM .wav export writes valid 44-byte RIFF/WAVE/fmt/data headers.',
  },
  'math-foundation-symmetry': {
    targetStage: 'stage-vector',
    summary:
      'Verifies all 4 mathematical foundations (Sine, Fibonacci, φ, Pythagorean) and geometryToFormulaGrid produce finite, error-free FM/SVG outputs.',
  },
};

export function SpecDependencyGraph() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomResetRef = useRef<() => void>(() => {});
  const [specs, setSpecs] = useState<ParsedSpecsJson | null>(null);
  const [hooks, setHooks] = useState<ParsedHookMeta[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<
    Array<{ sourceId: string; targetId: string; relation: string }>
  >([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reheatCount, setReheatCount] = useState<number>(0);

  const styleUpdateRef = useRef<(animate?: boolean) => void>(() => {});
  const focusStateRef = useRef<{ selectedId: string | null; hoveredId: string | null }>({
    selectedId: null,
    hoveredId: null,
  });
  focusStateRef.current = {
    selectedId: selectedNode?.id ?? null,
    hoveredId: hoveredNode?.id ?? null,
  };

  // 1. Parse /.kiro/specs.json directly + load hook metadata via useEffect
  useEffect(() => {
    let cancelled = false;
    async function loadSpecsAndHooks() {
      try {
        const [directSpecsRes, metaRes] = await Promise.all([
          fetch('/.kiro/specs.json'),
          fetch('/api/kiroween/specs'),
        ]);

        let parsedSpecs: ParsedSpecsJson | null = null;
        let parsedHooks: ParsedHookMeta[] = [];

        if (directSpecsRes.ok) {
          parsedSpecs = (await directSpecsRes.json()) as ParsedSpecsJson;
        }
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (!parsedSpecs && metaData.specsJson) {
            parsedSpecs = metaData.specsJson as ParsedSpecsJson;
          }
          if (Array.isArray(metaData.hooks)) {
            parsedHooks = metaData.hooks as ParsedHookMeta[];
          }
        }

        if (!parsedSpecs) {
          throw new Error('Failed to parse /.kiro/specs.json');
        }

        if (!cancelled) {
          setSpecs(parsedSpecs);
          setHooks(parsedHooks);
          setLoadError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load /.kiro/specs.json');
        }
      }
    }
    void loadSpecsAndHooks();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Construct complete node & dependency edge model from parsed /.kiro/specs.json
  const fullGraph = useMemo(() => {
    if (!specs) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const specsDir = specs.kiroSpecsDir || '.kiro/specs/harmoglyph';
    const bindingsObj = specs.pipeline.stage1_spreadsheetVm.columnBindings ?? {};

    const baseNodes: GraphNode[] = [
      {
        id: 'specs-json',
        label: 'specs.json',
        kind: 'manifest',
        filePath: '/.kiro/specs.json',
        summary: specs.description,
        details: [
          `Project: ${specs.name} (${specs.category})`,
          `Spec Directory: ${specsDir}`,
          `Version: ${specs.version}`,
        ],
      },
      {
        id: 'spec-requirements',
        label: 'requirements.md',
        kind: 'spec-doc',
        filePath: `/${specsDir}/requirements.md`,
        summary: 'EARS-syntax functional & acoustic safety requirements governing all 3 stages.',
        details: [
          'Defines WHEN/THE SYSTEM SHALL clauses for VM, FM Synth, Plotter, and PBT',
          'Enforces deterministic #CYCLE! termination and 20–4000 Hz clamping',
        ],
      },
      {
        id: 'spec-design',
        label: 'design.md',
        kind: 'spec-doc',
        filePath: `/${specsDir}/design.md`,
        summary: 'Architectural design specifying unidirectional dataflow and DSP/SVG couplings.',
        details: [
          'Maps A1:F48 evaluated rows into Web Audio FM nodes and SVG paths',
          'Specifies server-side Express proxy contracts',
        ],
      },
      {
        id: 'spec-tasks',
        label: 'tasks.md',
        kind: 'spec-doc',
        filePath: `/${specsDir}/tasks.md`,
        summary: 'Sequenced implementation waves and verification gates for Harmoglyph.',
        details: [
          'Wave 1: Spreadsheet VM & CSV round-trip',
          'Wave 2: 2-Op FM Synth & 16-bit PCM WAV',
          'Wave 3: Parametric Vector Plotter & 400-trial PBT',
        ],
      },
      {
        id: 'stage-vm',
        label: 'Spreadsheet VM',
        kind: 'stage',
        filePath: `/${specs.pipeline.stage1_spreadsheetVm.module}`,
        summary: 'Recursive-descent formula compiler across A1:F48 with #CYCLE! termination.',
        details: [
          `Functions (${specs.pipeline.stage1_spreadsheetVm.supportedFunctions.length}): ${specs.pipeline.stage1_spreadsheetVm.supportedFunctions.slice(0, 9).join(', ')}...`,
          ...specs.pipeline.stage1_spreadsheetVm.safetyGuarantees,
        ],
      },
      {
        id: 'stage-synth',
        label: 'FM Synth & WAV',
        kind: 'stage',
        filePath: `/${specs.pipeline.stage2_fmSynthesizer.module}`,
        summary: specs.pipeline.stage2_fmSynthesizer.topology,
        details: [
          `Live: ${specs.pipeline.stage2_fmSynthesizer.exports.liveAudio}`,
          `WAV: ${specs.pipeline.stage2_fmSynthesizer.exports.offlineWav}`,
        ],
      },
      {
        id: 'stage-vector',
        label: 'Vector Plotter',
        kind: 'stage',
        filePath: `/${specs.pipeline.stage3_vectorPlotter.module}`,
        summary: specs.pipeline.stage3_vectorPlotter.projection,
        details: [
          `ViewBox: ${specs.pipeline.stage3_vectorPlotter.viewBox}`,
          `Export: ${specs.pipeline.stage3_vectorPlotter.export}`,
        ],
      },
      {
        id: 'pbt-suite',
        label: 'PBT Verifier',
        kind: 'verifier',
        filePath: `/${specs.verification.module}`,
        summary: `${specs.verification.trialsPerInvariant} trials per invariant (Seed ${specs.verification.seedDefault}).`,
        details: specs.verification.invariants.map((inv) => `Invariant: ${inv}`),
      },
    ];

    const bindingNodes: GraphNode[] = Object.entries(bindingsObj).map(([col, spec]) => ({
      id: `col-${col}`,
      label: `Col ${col} (${spec.label})`,
      kind: 'binding',
      filePath: `/.kiro/specs.json#columnBindings.${col}`,
      summary: `Spreadsheet Column ${col} maps to '${spec.parameter}' (${spec.unit}) clamped to [${spec.clamp[0]}, ${spec.clamp[1]}].`,
      details: [
        `Column: ${col}`,
        `Parameter: ${spec.parameter}`,
        `Unit: ${spec.unit}`,
        `Safety Clamp: [${spec.clamp[0]}, ${spec.clamp[1]}]`,
      ],
    }));

    const invariantNodes: GraphNode[] = (specs.verification.invariants ?? []).map((inv) => {
      const meta = INVARIANT_DESCRIPTIONS[inv] ?? {
        targetStage: 'stage-vm',
        summary: `Seeded property-based invariant '${inv}' (${specs.verification.trialsPerInvariant} trials).`,
      };
      return {
        id: `inv-${inv}`,
        label: inv,
        kind: 'invariant',
        filePath: `/${specs.verification.module}#${inv}`,
        summary: meta.summary,
        details: [
          `Invariant ID: ${inv}`,
          `Trials: ${specs.verification.trialsPerInvariant}`,
          `Default PRNG Seed: ${specs.verification.seedDefault}`,
        ],
      };
    });

    const hookNodes: GraphNode[] = hooks.map((h, i) => ({
      id: `hook-${i}`,
      label: h.path.split('/').pop() ?? h.name,
      kind: 'hook',
      filePath: `/${h.path}`,
      summary: h.description,
      details: [
        `Event: ${h.event}`,
        `Enabled: ${String(h.enabled)}`,
        ...(h.filePattern ? [`File Pattern: ${h.filePattern}`] : []),
      ],
      hookMeta: h,
    }));

    const allNodes = [...baseNodes, ...bindingNodes, ...invariantNodes, ...hookNodes];

    const allLinks: GraphLink[] = [
      // Manifest -> EARS Spec Chain -> Pipeline Stages
      { source: 'specs-json', target: 'spec-requirements', relation: 'Declares EARS requirements root' },
      { source: 'spec-requirements', target: 'spec-design', relation: 'Governs system architecture' },
      { source: 'spec-design', target: 'spec-tasks', relation: 'Decomposes into build waves' },
      { source: 'specs-json', target: 'stage-vm', relation: 'Defines A1:F48 VM contract' },
      { source: 'specs-json', target: 'stage-synth', relation: 'Defines 2-op FM topology' },
      { source: 'specs-json', target: 'stage-vector', relation: 'Defines SVG plotter projection' },
      { source: 'spec-tasks', target: 'stage-vm', relation: 'Implements Stage 1 VM' },
      { source: 'spec-tasks', target: 'stage-synth', relation: 'Implements Stage 2 Synth' },
      { source: 'spec-tasks', target: 'stage-vector', relation: 'Implements Stage 3 Plotter' },

      // Direct Stage-to-Stage Dataflow
      { source: 'stage-vm', target: 'stage-synth', relation: 'Streams clamped EvaluatedRowStep[]' },
      { source: 'stage-vm', target: 'stage-vector', relation: 'Streams harmonic ratios & phase' },
      { source: 'stage-vector', target: 'stage-vm', relation: 'Inverse geometryToFormulaGrid()' },

      // Column Bindings (A..F) -> Downstream Consumers
      ...Object.keys(bindingsObj).flatMap((col) => {
        const edges: GraphLink[] = [
          { source: 'stage-vm', target: `col-${col}`, relation: `Evaluates & clamps Col ${col}` },
        ];
        if (['A', 'B', 'C', 'E', 'F'].includes(col)) {
          edges.push({
            source: `col-${col}`,
            target: 'stage-synth',
            relation: `Modulates FM Synth (${bindingsObj[col].parameter})`,
          });
        }
        if (['A', 'C', 'D', 'E', 'F'].includes(col)) {
          edges.push({
            source: `col-${col}`,
            target: 'stage-vector',
            relation: `Drives Vector Plotter (${bindingsObj[col].parameter})`,
          });
        }
        return edges;
      }),

      // Verification & Invariants
      { source: 'specs-json', target: 'pbt-suite', relation: 'Declares 400-trial PBT contract' },
      { source: 'stage-vm', target: 'pbt-suite', relation: 'Audited by VM invariants' },
      { source: 'stage-synth', target: 'pbt-suite', relation: 'Audited by DSP/WAV invariants' },
      ...(specs.verification.invariants ?? []).flatMap((inv) => {
        const targetStage = INVARIANT_DESCRIPTIONS[inv]?.targetStage ?? 'stage-vm';
        return [
          { source: 'pbt-suite', target: `inv-${inv}`, relation: 'Runs 100 seeded trials' },
          { source: targetStage, target: `inv-${inv}`, relation: `Verifies ${inv}` },
        ];
      }),

      // Agent Hooks
      ...hooks.map((_, i) => ({
        source: i === 0 ? 'pbt-suite' : 'specs-json',
        target: `hook-${i}`,
        relation:
          i === 0
            ? 'postFileSave triggers 400 PBT trials'
            : 'stop hook audits Kiroween repo compliance',
      })),
    ];

    return { nodes: allNodes, links: allLinks };
  }, [specs, hooks]);

  // 3. Filter active nodes & edges based on selected filterMode
  const filteredGraph = useMemo(() => {
    const allowedKinds = new Set<NodeKind>(['manifest', 'stage', 'verifier', 'hook']);
    if (filterMode === 'all') {
      allowedKinds.add('spec-doc');
      allowedKinds.add('binding');
      allowedKinds.add('invariant');
    } else if (filterMode === 'core') {
      allowedKinds.add('spec-doc');
    } else if (filterMode === 'bindings') {
      allowedKinds.add('binding');
    } else if (filterMode === 'verification') {
      allowedKinds.add('invariant');
    }

    const nodes = fullGraph.nodes
      .filter((n) => allowedKinds.has(n.kind))
      .map((n) => ({ ...n }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = fullGraph.links
      .filter((l) => {
        const s = typeof l.source === 'string' ? l.source : l.source.id;
        const t = typeof l.target === 'string' ? l.target : l.target.id;
        return nodeIds.has(s) && nodeIds.has(t);
      })
      .map((l) => ({ ...l }));

    return { nodes, links };
  }, [fullGraph, filterMode]);

  // 4. Render & animate interactive D3 force-directed graph
  useEffect(() => {
    if (!svgRef.current || filteredGraph.nodes.length === 0) return;

    const width = 700;
    const height = 420;
    const nodes = filteredGraph.nodes;
    const links = filteredGraph.links;

    // Compute stratified target coordinates per architectural layer so labels never bunch into a hairball
    const kindGroups: Record<NodeKind, GraphNode[]> = {
      binding: [],
      'spec-doc': [],
      manifest: [],
      stage: [],
      verifier: [],
      hook: [],
      invariant: [],
    };
    nodes.forEach((n) => {
      kindGroups[n.kind].push(n);
    });

    const targetCoords = new Map<string, { x: number; y: number }>();

    const assignColumn = (list: GraphNode[], xPos: number, topY: number, bottomY: number) => {
      const count = list.length;
      if (count === 0) return;
      if (count === 1) {
        targetCoords.set(list[0].id, { x: xPos, y: (topY + bottomY) / 2 });
        return;
      }
      const step = (bottomY - topY) / (count - 1);
      list.forEach((node, idx) => {
        // Slight horizontal stagger on dense columns so adjacent text labels never collide
        const xJitter = count >= 5 ? (idx % 2 === 0 ? -12 : 12) : 0;
        targetCoords.set(node.id, { x: xPos + xJitter, y: topY + idx * step });
      });
    };

    assignColumn(kindGroups.binding, 78, 48, 366);
    assignColumn(kindGroups['spec-doc'], 218, 96, 324);
    assignColumn([...kindGroups.manifest, ...kindGroups.stage], 354, 64, 346);
    assignColumn([...kindGroups.verifier, ...kindGroups.hook], 486, 62, 316);
    assignColumn(kindGroups.invariant, 626, 48, 368);

    nodes.forEach((n) => {
      const target = targetCoords.get(n.id) ?? { x: width / 2, y: height / 2 };
      if (typeof n.x !== 'number' || !Number.isFinite(n.x)) n.x = target.x;
      if (typeof n.y !== 'number' || !Number.isFinite(n.y)) n.y = target.y;
    });

    setGraphNodes(nodes);
    setGraphLinks(
      links.map((l) => ({
        sourceId: typeof l.source === 'string' ? l.source : l.source.id,
        targetId: typeof l.target === 'string' ? l.target : l.target.id,
        relation: l.relation,
      })),
    );
    setSelectedNode((prev) => {
      if (prev && nodes.some((n) => n.id === prev.id)) return prev;
      return nodes.find((n) => n.id === 'specs-json') ?? nodes[0];
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'spec-dep-arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4Z')
      .attr('fill', '#4A5B7D');

    defs
      .append('marker')
      .attr('id', 'spec-dep-arrow-active')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4Z')
      .attr('fill', '#00E5CC');

    defs
      .append('marker')
      .attr('id', 'spec-dep-arrow-hook')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4Z')
      .attr('fill', '#F59E0B');

    const viewport = svg.append('g').attr('class', 'spec-zoom-viewport');

    // Subtle column lane headers for immediate architectural scannability
    const laneHeaders = [
      { x: 82, label: 'COL BINDINGS' },
      { x: 224, label: 'EARS SPECS' },
      { x: 362, label: 'CORE PIPELINE' },
      { x: 498, label: 'HOOKS & PBT' },
      { x: 624, label: 'INVARIANTS' },
    ];
    viewport
      .append('g')
      .attr('class', 'spec-lanes')
      .selectAll('text')
      .data(laneHeaders)
      .join('text')
      .attr('x', (d) => d.x)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4A5B7D')
      .attr('font-size', 8.5)
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('letter-spacing', '0.06em')
      .text((d) => d.label);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 2.4])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);
    zoomResetRef.current = () => {
      svg
        .transition()
        .duration(260)
        .call(zoomBehavior.transform, d3.zoomIdentity);
    };

    const linkGroup = viewport
      .append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#34466B')
      .attr('stroke-width', 1.25)
      .attr('stroke-opacity', reducedMotion ? 0.65 : 0)
      .attr('stroke-dasharray', (d) => {
        const t = typeof d.target === 'string' ? d.target : d.target.id;
        return t.startsWith('hook-') || t.startsWith('inv-') ? '4 3' : null;
      })
      .attr('marker-end', 'url(#spec-dep-arrow)');

    const nodeGroup = viewport
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.label} (${KIND_META[d.kind].badge})`)
      .style('cursor', 'pointer')
      .style('opacity', reducedMotion ? 1 : 0);

    nodeGroup
      .append('circle')
      .attr('class', 'spec-halo')
      .attr('r', (d) => (reducedMotion ? KIND_META[d.kind].radius + 5 : 0))
      .attr('fill', 'none')
      .attr('stroke', (d) => KIND_META[d.kind].color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0);

    nodeGroup
      .append('circle')
      .attr('class', 'spec-core')
      .attr('r', (d) => (reducedMotion ? KIND_META[d.kind].radius : 0))
      .attr('fill', (d) => KIND_META[d.kind].color)
      .attr('fill-opacity', 0.92)
      .attr('stroke', '#EDF2F9')
      .attr('stroke-width', 1.5);

    // High-contrast dark pill behind each node label so edges never obscure text
    nodeGroup
      .append('rect')
      .attr('class', 'spec-label-bg')
      .attr('x', (d) => -Math.max(46, d.label.length * 5.2 + 10) / 2)
      .attr('y', (d) => KIND_META[d.kind].radius + 3)
      .attr('width', (d) => Math.max(46, d.label.length * 5.2 + 10))
      .attr('height', 14)
      .attr('rx', 3)
      .attr('fill', 'rgba(7, 9, 14, 0.88)')
      .attr('stroke', 'rgba(31, 42, 64, 0.85)')
      .attr('stroke-width', 0.8);

    nodeGroup
      .append('text')
      .attr('class', 'spec-label')
      .attr('dy', (d) => KIND_META[d.kind].radius + 13)
      .attr('text-anchor', 'middle')
      .attr('fill', '#EDF2F9')
      .attr('font-size', 9.5)
      .attr('font-family', 'JetBrains Mono, monospace')
      .style('opacity', reducedMotion ? 1 : 0)
      .text((d) => d.label);

    let entranceDone = Boolean(reducedMotion);

    const applyFocusStyles = (animate = false) => {
      const { selectedId, hoveredId } = focusStateRef.current;
      const focusId = hoveredId ?? selectedId;
      const dur = animate && !reducedMotion ? 170 : 0;

      nodeGroup.each(function (d) {
        const g = d3.select(this);
        const baseR = KIND_META[d.kind].radius;
        const isHov = d.id === hoveredId;
        const isSel = d.id === selectedId;
        const isConnected =
          !focusId ||
          d.id === focusId ||
          links.some((l) => {
            const s = typeof l.source === 'string' ? l.source : l.source.id;
            const t = typeof l.target === 'string' ? l.target : l.target.id;
            return (s === focusId && t === d.id) || (t === focusId && s === d.id);
          });

        const halo = g.select<SVGCircleElement>('.spec-halo');
        const core = g.select<SVGCircleElement>('.spec-core');
        const label = g.select<SVGTextElement>('.spec-label');

        if (dur > 0 && entranceDone) {
          halo
            .transition()
            .duration(dur)
            .ease(d3.easeCubicOut)
            .attr('r', isHov ? baseR + 7 : isSel ? baseR + 5 : baseR + 3)
            .attr('stroke-opacity', isHov ? 0.95 : isSel ? 0.6 : 0);
          core
            .transition()
            .duration(dur)
            .ease(d3.easeCubicOut)
            .attr('r', isHov ? baseR + 2 : isSel ? baseR + 1 : baseR)
            .attr('fill-opacity', isConnected ? 0.95 : 0.25)
            .attr('stroke', isHov || isSel ? '#FFFFFF' : '#1F2A40')
            .attr('stroke-width', isHov || isSel ? 2.4 : 1.4);
        } else {
          halo.attr('stroke-opacity', isHov ? 0.95 : isSel ? 0.6 : 0);
          core
            .attr('fill-opacity', isConnected ? 0.95 : 0.25)
            .attr('stroke', isHov || isSel ? '#FFFFFF' : '#1F2A40')
            .attr('stroke-width', isHov || isSel ? 2.4 : 1.4);
        }

        label.attr('fill', isConnected ? '#EDF2F9' : '#5E6E8E');
      });

      if (entranceDone) {
        linkGroup.each(function (d) {
          const s = typeof d.source === 'string' ? d.source : d.source.id;
          const t = typeof d.target === 'string' ? d.target : d.target.id;
          const activeEdge = !focusId || s === focusId || t === focusId;
          const isHookEdge = t.startsWith('hook-');
          const line = d3.select(this);
          const strokeColor =
            activeEdge && isHookEdge ? '#F59E0B' : activeEdge ? '#00E5CC' : '#34466B';
          const markerUrl =
            activeEdge && isHookEdge
              ? 'url(#spec-dep-arrow-hook)'
              : activeEdge
                ? 'url(#spec-dep-arrow-active)'
                : 'url(#spec-dep-arrow)';

          if (dur > 0) {
            line
              .transition()
              .duration(dur)
              .attr('stroke', strokeColor)
              .attr('stroke-width', activeEdge ? 1.85 : 1.05)
              .attr('stroke-opacity', activeEdge ? 0.88 : 0.16)
              .attr('marker-end', markerUrl);
          } else {
            line
              .attr('stroke', strokeColor)
              .attr('stroke-width', activeEdge ? 1.85 : 1.05)
              .attr('stroke-opacity', activeEdge ? 0.88 : 0.16)
              .attr('marker-end', markerUrl);
          }
        });
      }
    };

    styleUpdateRef.current = applyFocusStyles;

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(115)
          .strength(0.18),
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-95))
      .force(
        'x',
        d3
          .forceX<GraphNode>((d) => targetCoords.get(d.id)?.x ?? width / 2)
          .strength(0.78),
      )
      .force(
        'y',
        d3
          .forceY<GraphNode>((d) => targetCoords.get(d.id)?.y ?? height / 2)
          .strength(0.78),
      )
      .force('collide', d3.forceCollide<GraphNode>((d) => KIND_META[d.kind].radius + 22));

    const tickPositions = () => {
      nodeGroup.attr('transform', (d) => {
        const nx = Math.max(58, Math.min(width - 58, d.x ?? width / 2));
        const ny = Math.max(38, Math.min(height - 34, d.y ?? height / 2));
        d.x = nx;
        d.y = ny;
        return `translate(${nx.toFixed(1)},${ny.toFixed(1)})`;
      });

      linkGroup
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);
    };

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeGroup
      .call(drag)
      .on('click', (_event, d) => setSelectedNode({ ...d }))
      .on('mouseenter', (_event, d) => setHoveredNode({ ...d }))
      .on('mouseleave', () => setHoveredNode(null))
      .on('focus', (_event, d) => setHoveredNode({ ...d }))
      .on('blur', () => setHoveredNode(null));

    if (reducedMotion) {
      simulation.stop();
      simulation.tick(120);
      tickPositions();
      applyFocusStyles(false);
    } else {
      simulation.on('tick', tickPositions);
      simulation.tick(110);
      tickPositions();
      applyFocusStyles(false);

      nodeGroup
        .transition()
        .duration(360)
        .delay((_d, i) => i * 25)
        .ease(d3.easeCubicOut)
        .style('opacity', 1);

      nodeGroup
        .select<SVGCircleElement>('.spec-core')
        .transition()
        .duration(420)
        .delay((_d, i) => i * 25)
        .ease(d3.easeBackOut.overshoot(1.25))
        .attr('r', (d) => KIND_META[d.kind].radius);

      nodeGroup
        .select<SVGCircleElement>('.spec-halo')
        .transition()
        .duration(420)
        .delay((_d, i) => i * 25)
        .ease(d3.easeBackOut.overshoot(1.15))
        .attr('r', (d) => KIND_META[d.kind].radius + 5);

      nodeGroup
        .select<SVGTextElement>('.spec-label')
        .transition()
        .duration(300)
        .delay((_d, i) => i * 25 + 60)
        .ease(d3.easeCubicOut)
        .style('opacity', 1);

      linkGroup
        .transition()
        .duration(380)
        .delay((_d, i) => 90 + i * 15)
        .ease(d3.easeCubicOut)
        .attr('stroke-opacity', 0.72)
        .on('end', (_d, i, group) => {
          if (i === group.length - 1) {
            entranceDone = true;
            applyFocusStyles(true);
          }
        });
    }

    return () => {
      simulation.stop();
    };
  }, [filteredGraph, reheatCount]);

  useEffect(() => {
    styleUpdateRef.current(true);
  }, [selectedNode, hoveredNode]);

  const activeNode = hoveredNode ?? selectedNode;

  // Direct incoming & outgoing dependency edges for the focused node
  const focusedDependencies = useMemo(() => {
    if (!activeNode) return { upstream: [], downstream: [] };
    const upstream = graphLinks
      .filter((l) => l.targetId === activeNode.id)
      .map((l) => ({
        node: graphNodes.find((n) => n.id === l.sourceId),
        relation: l.relation,
      }))
      .filter((x): x is { node: GraphNode; relation: string } => Boolean(x.node));

    const downstream = graphLinks
      .filter((l) => l.sourceId === activeNode.id)
      .map((l) => ({
        node: graphNodes.find((n) => n.id === l.targetId),
        relation: l.relation,
      }))
      .filter((x): x is { node: GraphNode; relation: string } => Boolean(x.node));

    return { upstream, downstream };
  }, [activeNode, graphLinks, graphNodes]);

  // Transitive dependent hooks highlighted on hover/focus
  const dependentHooks = useMemo(() => {
    const hookNodes = graphNodes.filter((n) => n.kind === 'hook');
    if (!activeNode) {
      return hookNodes.map((hook) => ({
        hook,
        isDependent: false,
        pathText: null as string | null,
      }));
    }

    const visited = new Set<string>([activeNode.id]);
    const queue: Array<{ id: string; trail: string[] }> = [
      { id: activeNode.id, trail: [activeNode.label] },
    ];
    const trails = new Map<string, string[]>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const edge of graphLinks) {
        if (edge.sourceId === curr.id) {
          const target = graphNodes.find((n) => n.id === edge.targetId);
          if (!target) continue;
          const nextTrail = [...curr.trail, target.label];
          if (target.kind === 'hook' && !trails.has(target.id)) {
            trails.set(target.id, nextTrail);
          }
          if (!visited.has(target.id)) {
            visited.add(target.id);
            queue.push({ id: target.id, trail: nextTrail });
          }
        }
      }
    }

    if (activeNode.kind === 'hook') {
      trails.set(activeNode.id, [activeNode.label]);
    }

    return hookNodes.map((hook) => ({
      hook,
      isDependent: trails.has(hook.id),
      pathText: trails.get(hook.id)?.join(' → ') ?? null,
    }));
  }, [activeNode, graphLinks, graphNodes]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      <div className="flex-1 border border-[#1F2A40] rounded-lg bg-[#07090E] p-3.5 flex flex-col gap-2.5 min-w-0">
        {/* Top Controls: Layer Filter + Re-run / Reset Zoom */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All Elements (${fullGraph.nodes.length})` },
                { id: 'core', label: 'Pipeline & EARS Docs' },
                { id: 'bindings', label: 'Col Bindings (A–F)' },
                { id: 'verification', label: 'PBT Invariants & Hooks' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2.5 py-1 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                  filterMode === tab.id
                    ? 'border-[#00E5CC] bg-[#00E5CC]/12 text-[#00E5CC] font-semibold'
                    : 'border-[#1F2A40] bg-[#111622] text-[#8A99B8] hover:text-[#EDF2F9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => zoomResetRef.current()}
              className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#111622] text-[11px] text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1 cursor-pointer shrink-0"
              title="Reset zoom and pan"
            >
              <Maximize2 className="w-3 h-3" aria-hidden="true" />
              <span>Reset View</span>
            </button>
            <button
              type="button"
              onClick={() => setReheatCount((c) => c + 1)}
              className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#111622] text-[11px] text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>Re-run d3-force</span>
            </button>
          </div>
        </div>

        {/* SVG Force-Directed Canvas */}
        {loadError ? (
          <div className="p-4 text-xs text-[#F43F5E] font-mono">{loadError}</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 700 420"
            className="w-full h-[355px] block select-none"
            role="img"
            aria-label="Interactive D3 force-directed SpecDependencyGraph parsed from /.kiro/specs.json"
          />
        )}

        {/* Color Legend & Interaction Hint */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#8A99B8] pt-2 border-t border-[#1F2A40]">
          <div className="flex flex-wrap items-center gap-3 font-mono">
            {(Object.entries(KIND_META) as Array<[NodeKind, (typeof KIND_META)[NodeKind]]>).map(
              ([kind, meta]) => (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span>{meta.badge}</span>
                </span>
              ),
            )}
          </div>
          <span className="font-mono text-[10px] text-[#8A99B8]">
            {graphNodes.length} nodes · {graphLinks.length} dependency edges · Drag or scroll to zoom
          </span>
        </div>
      </div>

      {/* Sidebar showing hovered/clicked node + upstream/downstream edges + dependent hooks */}
      <aside
        aria-label="Spec Dependency and Hook Metadata Sidebar"
        className="w-full lg:w-80 shrink-0 border border-[#1F2A40] rounded-lg bg-[#111622] p-3.5 flex flex-col gap-2.5 overflow-y-auto max-h-[440px]"
      >
        {activeNode ? (
          <>
            <div className="pb-2 border-b border-[#1F2A40]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-[#8A99B8]">
                  {hoveredNode ? 'Hover Focus' : 'Selected Spec Node'}
                </span>
                <span
                  className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border"
                  style={{
                    color: KIND_META[activeNode.kind].color,
                    borderColor: `${KIND_META[activeNode.kind].color}66`,
                    backgroundColor: `${KIND_META[activeNode.kind].color}15`,
                  }}
                >
                  {KIND_META[activeNode.kind].badge}
                </span>
              </div>
              <div className="text-xs font-semibold text-[#EDF2F9] mt-1">{activeNode.label}</div>
              <div className="text-[11px] font-mono text-[#00E5CC] mt-0.5 break-all">
                {activeNode.filePath}
              </div>
            </div>

            <p className="text-[11px] text-[#EDF2F9] leading-snug">{activeNode.summary}</p>

            {/* Direct Dependency Edges (Upstream & Downstream) */}
            <div className="grid grid-cols-1 gap-1.5">
              {focusedDependencies.upstream.length > 0 && (
                <div className="p-2 rounded border border-[#1F2A40] bg-[#07090E] flex flex-col gap-0.5">
                  <div className="text-[10px] font-mono font-semibold text-[#38BDF8] uppercase">
                    Depends On ({focusedDependencies.upstream.length})
                  </div>
                  {focusedDependencies.upstream.slice(0, 3).map(({ node, relation }) => (
                    <button
                      key={`up-${node.id}`}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className="text-left text-[11px] font-mono text-[#EDF2F9] hover:text-[#00E5CC] truncate cursor-pointer"
                    >
                      ← {node.label}: <span className="text-[#8A99B8]">{relation}</span>
                    </button>
                  ))}
                </div>
              )}

              {focusedDependencies.downstream.length > 0 && (
                <div className="p-2 rounded border border-[#1F2A40] bg-[#07090E] flex flex-col gap-0.5">
                  <div className="text-[10px] font-mono font-semibold text-[#00E5CC] uppercase">
                    Feeds / Verifies ({focusedDependencies.downstream.length})
                  </div>
                  {focusedDependencies.downstream.slice(0, 4).map(({ node, relation }) => (
                    <button
                      key={`down-${node.id}`}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className="text-left text-[11px] font-mono text-[#EDF2F9] hover:text-[#00E5CC] truncate cursor-pointer"
                    >
                      → {node.label}: <span className="text-[#8A99B8]">{relation}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dependent Hooks highlighted on hover/focus */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-[#F59E0B]">
                Dependent Hooks ({dependentHooks.filter((h) => h.isDependent).length})
              </div>
              {dependentHooks.map(({ hook, isDependent, pathText }) => (
                <button
                  key={hook.id}
                  type="button"
                  onClick={() => setSelectedNode(hook)}
                  onMouseEnter={() => setHoveredNode(hook)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`text-left px-2 py-1.5 rounded border transition-all duration-150 cursor-pointer ${
                    isDependent
                      ? 'border-[#F59E0B] bg-[#F59E0B]/12'
                      : 'border-[#1F2A40] bg-[#07090E] opacity-55 hover:opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className={isDependent ? 'text-[#F59E0B] font-semibold' : 'text-[#8A99B8]'}>
                      {hook.label}
                    </span>
                    <span className={isDependent ? 'text-[#EDF2F9]' : 'text-[#5E6E8E]'}>
                      {hook.hookMeta?.event ?? 'Hook'}
                    </span>
                  </div>
                  {pathText && (
                    <div className="text-[10px] font-mono text-[#EDF2F9]/85 mt-0.5 truncate">
                      {pathText}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs text-[#8A99B8]">Loading /.kiro/specs.json...</div>
        )}
      </aside>
    </div>
  );
}
