import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RotateCcw } from 'lucide-react';

type NodeCategory = 'steering' | 'spec' | 'crew' | 'hook';
type EdgeKind = 'governance' | 'dependency' | 'hook';

interface KiroNodeData extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  path: string;
  category: NodeCategory;
  tier: number;
  trigger: string;
  summary: string;
}

interface KiroLinkData extends d3.SimulationLinkDatum<KiroNodeData> {
  id: string;
  source: string | KiroNodeData;
  target: string | KiroNodeData;
  relation: string;
  edgeKind: EdgeKind;
}

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  steering: '#38BDF8',
  spec: '#00E5CC',
  crew: '#A78BFA',
  hook: '#F59E0B',
};

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  steering: 'Steering / Power',
  spec: 'Spec Artifact',
  crew: 'Agent / MCP',
  hook: 'Agent Hook',
};

const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  governance: 'Rule / Constraint',
  dependency: 'Spec Flow',
  hook: 'Hook Trigger',
};

function getEndpointId(endpoint: string | KiroNodeData): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

export function KiroD3NodeLinkGraph() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [dimensions, setDimensions] = useState({ width: 640, height: 280 });
  const [selectedNodeId, setSelectedNodeId] = useState<string>('requirements');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<NodeCategory | 'all'>('all');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle: string;
    body: string;
  } | null>(null);

  const rawGraph = useMemo(() => {
    const nodes: KiroNodeData[] = [
      {
        id: 'tech-stack',
        name: 'tech-stack.md',
        path: '.kiro/steering/tech-stack.md',
        category: 'steering',
        tier: 0,
        trigger: 'inclusion: always',
        summary: 'Mandates React 19, Express server proxy, server-side Gemini SDK, and obsidian design tokens.',
      },
      {
        id: 'audio-safety',
        name: 'audio-safety.md',
        path: '.kiro/steering/audio-safety-contract.md',
        category: 'steering',
        tier: 0,
        trigger: 'fileMatch: engine/*.ts',
        summary: 'Enforces 20–4000 Hz frequency bounds, gain <= 0.35, and cycle-free spreadsheet evaluation.',
      },
      {
        id: 'dsp-power',
        name: 'spreadsheet-dsp-power.md',
        path: '.kiro/powers/spreadsheet-dsp-power.md',
        category: 'steering',
        tier: 0,
        trigger: 'Kiro Power',
        summary: 'Bundles Web Audio FM synthesis patterns, PCM WAV header generation, and PBT templates.',
      },
      {
        id: 'specs-manifest',
        name: 'specs.json',
        path: '.kiro/specs.json',
        category: 'spec',
        tier: 1,
        trigger: 'Pipeline Manifest',
        summary: 'Machine-readable schema describing the A1:F48 spreadsheet VM, FM synth, vector plotter, and 4 PBT invariants.',
      },
      {
        id: 'requirements',
        name: 'requirements.md',
        path: '.kiro/specs/harmoglyph/requirements.md',
        category: 'spec',
        tier: 1,
        trigger: 'EARS Spec',
        summary: 'Formal EARS requirements for Formula VM, FM Synth, Sheet-Music Transcription, Vector Plotter, and PBT.',
      },
      {
        id: 'design',
        name: 'design.md',
        path: '.kiro/specs/harmoglyph/design.md',
        category: 'spec',
        tier: 1,
        trigger: 'Architecture',
        summary: 'Maps A1:F48 cell mutations deterministically to multi-voice FM synthesis and layered Lissajous geometry.',
      },
      {
        id: 'tasks',
        name: 'tasks.md',
        path: '.kiro/specs/harmoglyph/tasks.md',
        category: 'spec',
        tier: 1,
        trigger: 'Build Waves',
        summary: 'Ordered implementation tasks across VM parser, audio/WAV exporter, vector/PNG plotter, and audit.',
      },
      {
        id: 'agent-manifest',
        name: 'agent.yaml',
        path: '.kiro/agent.yaml',
        category: 'crew',
        tier: 2,
        trigger: 'Agent Manifest',
        summary: 'Top-level Kiro agent manifest wiring steering contracts, specs.json, powers, MCP, and hooks.',
      },
      {
        id: 'synth-crew',
        name: 'synth-crew.json',
        path: '.kiro/agents/synth-crew.json',
        category: 'crew',
        tier: 2,
        trigger: 'Custom Agents',
        summary: 'Coordinates Formula Compiler, FM Sound Designer, Vector Architect, and PBT Verifier agents.',
      },
      {
        id: 'mcp-server',
        name: 'mcp.json',
        path: '.kiro/settings/mcp.json',
        category: 'crew',
        tier: 2,
        trigger: 'MCP Config',
        summary: 'Configures Kiro MCP audit and formula verification endpoints.',
      },
      {
        id: 'pbt-hook',
        name: 'pbt-on-save.json',
        path: '.kiro/hooks/pbt-on-formula-save.json',
        category: 'hook',
        tier: 3,
        trigger: 'PostFileSave',
        summary: 'Runs TypeScript checks and 400 seeded PBT invariants whenever engine files change.',
      },
      {
        id: 'audit-hook',
        name: 'submission-audit.json',
        path: '.kiro/hooks/kiroween-submission-audit.json',
        category: 'hook',
        tier: 3,
        trigger: 'Stop Hook',
        summary: 'Verifies root MIT LICENSE, .gitignore safety, and /.kiro completeness prior to handoff.',
      },
    ];

    const links: KiroLinkData[] = [
      { id: 'tech-stack->requirements', source: 'tech-stack', target: 'requirements', relation: 'Constraints shape EARS specs', edgeKind: 'governance' },
      { id: 'audio-safety->specs-manifest', source: 'audio-safety', target: 'specs-manifest', relation: 'Safety bounds enforce pipeline clamps', edgeKind: 'governance' },
      { id: 'audio-safety->design', source: 'audio-safety', target: 'design', relation: 'Safety bounds govern FM synth design', edgeKind: 'governance' },
      { id: 'dsp-power->design', source: 'dsp-power', target: 'design', relation: 'Power guides WAV & vector pipeline', edgeKind: 'governance' },
      { id: 'specs-manifest->design', source: 'specs-manifest', target: 'design', relation: 'Manifest formalizes sheet-to-synth schema', edgeKind: 'dependency' },
      { id: 'requirements->design', source: 'requirements', target: 'design', relation: 'EARS specs drive technical architecture', edgeKind: 'dependency' },
      { id: 'requirements->tasks', source: 'requirements', target: 'tasks', relation: 'Requirements decompose into build tasks', edgeKind: 'dependency' },
      { id: 'specs-manifest->agent-manifest', source: 'specs-manifest', target: 'agent-manifest', relation: 'Pipeline spec binds to agent.yaml', edgeKind: 'dependency' },
      { id: 'design->synth-crew', source: 'design', target: 'synth-crew', relation: 'Design feeds custom agent execution', edgeKind: 'dependency' },
      { id: 'tasks->synth-crew', source: 'tasks', target: 'synth-crew', relation: 'Tasks schedule agent steps', edgeKind: 'dependency' },
      { id: 'agent-manifest->synth-crew', source: 'agent-manifest', target: 'synth-crew', relation: 'Manifest delegates to specialist roles', edgeKind: 'dependency' },
      { id: 'design->mcp-server', source: 'design', target: 'mcp-server', relation: 'Audit schema exposes MCP tools', edgeKind: 'dependency' },
      { id: 'synth-crew->pbt-hook', source: 'synth-crew', target: 'pbt-hook', relation: 'Engine edits trigger PostFileSave PBT', edgeKind: 'hook' },
      { id: 'mcp-server->pbt-hook', source: 'mcp-server', target: 'pbt-hook', relation: 'MCP checks complement save hook', edgeKind: 'hook' },
      { id: 'agent-manifest->audit-hook', source: 'agent-manifest', target: 'audit-hook', relation: 'Manifest enforces Stop submission audit', edgeKind: 'hook' },
      { id: 'synth-crew->audit-hook', source: 'synth-crew', target: 'audit-hook', relation: 'Completion triggers Stop submission audit', edgeKind: 'hook' },
    ];

    return { nodes, links };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 100) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const uiStateRef = useRef({ selectedNodeId, hoveredNodeId, hoveredLinkId, activeCategory });
  uiStateRef.current = { selectedNodeId, hoveredNodeId, hoveredLinkId, activeCategory };
  const applyHighlightRef = useRef<(animate?: boolean) => void>(() => {});

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const tierX = [width * 0.14, width * 0.39, width * 0.64, width * 0.87];
    const rowCounters: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    const tierTotals: Record<number, number> = { 0: 3, 1: 4, 2: 3, 3: 2 };

    const nodes: KiroNodeData[] = rawGraph.nodes.map((n) => {
      const idx = rowCounters[n.tier] ?? 0;
      rowCounters[n.tier] = idx + 1;
      const total = tierTotals[n.tier] ?? 1;
      return {
        ...n,
        x: tierX[n.tier] ?? width * 0.5,
        y: height * ((idx + 1) / (total + 1)),
      };
    });
    const links: KiroLinkData[] = rawGraph.links.map((l) => ({ ...l }));

    const defs = svg.append('defs');
    for (const m of [
      { id: 'arrow-governance', color: '#38BDF8' },
      { id: 'arrow-dependency', color: '#00E5CC' },
      { id: 'arrow-hook', color: '#F59E0B' },
      { id: 'arrow-dim', color: '#34466B' },
    ]) {
      defs
        .append('marker')
        .attr('id', m.id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 19)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4.5L9,0L0,4.5Z')
        .attr('fill', m.color);
    }

    const zoomRoot = svg.append('g');
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 2.2])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zoomRoot.attr('transform', event.transform.toString());
        setZoomScale(Number(event.transform.k.toFixed(2)));
      });
    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior).on('dblclick.zoom', null);

    const stageLabels = ['Steering & Power', '.kiro Specs', 'Agents & MCP', 'Agent Hooks'];
    zoomRoot
      .append('g')
      .selectAll('text')
      .data(stageLabels)
      .join('text')
      .attr('x', (_d, i) => tierX[i])
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#5E6E8E')
      .attr('font-size', 10)
      .attr('font-family', 'JetBrains Mono, monospace')
      .text((d) => d);

    const linkWrappers = zoomRoot
      .append('g')
      .selectAll<SVGGElement, KiroLinkData>('g.kiro-link-wrap')
      .data(links, (d) => d.id)
      .join('g')
      .attr('class', 'kiro-link-wrap')
      .style('cursor', 'pointer');

    const linkHitPaths = linkWrappers
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 14);

    const linkVisiblePaths = linkWrappers
      .append('path')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0)
      .attr('stroke-dasharray', (d) =>
        d.edgeKind === 'hook' ? '5 3' : d.edgeKind === 'governance' ? '2 2' : null,
      );

    const nodeSelection = zoomRoot
      .append('g')
      .selectAll<SVGGElement, KiroNodeData>('g.kiro-node')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', 'kiro-node')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.name} (${CATEGORY_LABELS[d.category]})`)
      .style('cursor', 'grab')
      .style('opacity', prefersReducedMotion ? 1 : 0);

    nodeSelection
      .append('circle')
      .attr('class', 'node-halo')
      .attr('r', prefersReducedMotion ? 17 : 0)
      .attr('fill', 'none')
      .attr('stroke-width', 1.5);
    nodeSelection
      .append('circle')
      .attr('class', 'node-core')
      .attr('r', prefersReducedMotion ? 11 : 0)
      .attr('stroke-width', 1.5);
    nodeSelection.append('circle').attr('class', 'node-dot').attr('r', prefersReducedMotion ? 2.5 : 0).attr('fill', '#07090E');
    nodeSelection
      .append('text')
      .attr('class', 'node-label')
      .attr('dy', 23)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .attr('font-family', 'JetBrains Mono, monospace')
      .style('opacity', prefersReducedMotion ? 1 : 0)
      .text((d) => d.name);

    const edgeColor = (d: KiroLinkData) =>
      d.edgeKind === 'hook' ? '#F59E0B' : d.edgeKind === 'governance' ? '#38BDF8' : '#00E5CC';

    let entranceComplete = Boolean(prefersReducedMotion);

    const updateStyles = (animate = false) => {
      const { selectedNodeId: selId, hoveredNodeId: hovId, hoveredLinkId: hovEdgeId, activeCategory: cat } =
        uiStateRef.current;
      const focusId = hovId ?? selId;
      const hovLink = hovEdgeId ? links.find((l) => l.id === hovEdgeId) : null;
      const hovSrc = hovLink ? getEndpointId(hovLink.source) : null;
      const hovTgt = hovLink ? getEndpointId(hovLink.target) : null;
      const dur = animate && !prefersReducedMotion ? 180 : 0;

      nodeSelection.each(function (d) {
        const g = d3.select(this);
        const color = CATEGORY_COLORS[d.category];
        const isSel = d.id === selId;
        const isHov = d.id === hovId;
        const isEnd = d.id === hovSrc || d.id === hovTgt;
        const matchesCat = cat === 'all' || d.category === cat;
        const connected = hovEdgeId
          ? isEnd
          : d.id === focusId ||
            links.some(
              (l) =>
                (getEndpointId(l.source) === focusId && getEndpointId(l.target) === d.id) ||
                (getEndpointId(l.target) === focusId && getEndpointId(l.source) === d.id),
            );
        const active = matchesCat && connected;

        const halo = g.select<SVGCircleElement>('.node-halo');
        const core = g.select<SVGCircleElement>('.node-core');
        const label = g.select<SVGTextElement>('.node-label');

        if (dur > 0 && entranceComplete) {
          halo
            .transition()
            .duration(dur)
            .ease(d3.easeCubicOut)
            .attr('r', isHov ? 21 : isSel ? 18 : 16)
            .attr('stroke', color)
            .attr('stroke-opacity', isHov || isEnd ? 0.95 : isSel ? 0.55 : 0);
          core
            .transition()
            .duration(dur)
            .ease(d3.easeCubicOut)
            .attr('r', isHov ? 13.5 : isSel ? 12 : 11)
            .attr('fill', color)
            .attr('fill-opacity', active ? 0.96 : 0.22)
            .attr('stroke', isSel || isHov || isEnd ? '#EDF2F9' : color);
        } else {
          halo
            .attr('stroke', color)
            .attr('stroke-opacity', isHov || isEnd ? 0.95 : isSel ? 0.55 : 0);
          core
            .attr('fill', color)
            .attr('fill-opacity', active ? 0.96 : 0.22)
            .attr('stroke', isSel || isHov || isEnd ? '#EDF2F9' : color);
        }

        label
          .attr('fill', active ? '#EDF2F9' : '#5E6E8E')
          .attr('font-weight', isSel || isHov || isEnd ? 600 : 400);
      });

      linkVisiblePaths.each(function (d) {
        const path = d3.select(this);
        const sId = getEndpointId(d.source);
        const tId = getEndpointId(d.target);
        const sNode = nodes.find((n) => n.id === sId);
        const tNode = nodes.find((n) => n.id === tId);
        const matchesCat = cat === 'all' || sNode?.category === cat || tNode?.category === cat;
        const isHov = hovEdgeId === d.id;
        const isConn = hovEdgeId ? isHov : sId === focusId || tId === focusId;

        const marker = !matchesCat || (!isConn && !isHov)
          ? 'url(#arrow-dim)'
          : d.edgeKind === 'hook'
            ? 'url(#arrow-hook)'
            : d.edgeKind === 'governance'
              ? 'url(#arrow-governance)'
              : 'url(#arrow-dependency)';

        const targetOpacity = !matchesCat ? 0.08 : isHov ? 1 : isConn ? 0.88 : 0.22;
        const targetWidth = isHov ? 2.7 : isConn ? 2.0 : 1.3;

        if (dur > 0 && entranceComplete) {
          path
            .transition()
            .duration(dur)
            .attr('stroke', edgeColor(d))
            .attr('stroke-width', targetWidth)
            .attr('stroke-opacity', targetOpacity)
            .attr('marker-end', marker);
        } else if (entranceComplete) {
          path
            .attr('stroke', edgeColor(d))
            .attr('stroke-width', targetWidth)
            .attr('stroke-opacity', targetOpacity)
            .attr('marker-end', marker);
        } else {
          path
            .attr('stroke', edgeColor(d))
            .attr('stroke-width', targetWidth)
            .attr('marker-end', marker);
        }
      });
    };

    applyHighlightRef.current = updateStyles;

    const simulation = d3
      .forceSimulation<KiroNodeData>(nodes)
      .force('link', d3.forceLink<KiroNodeData, KiroLinkData>(links).id((d) => d.id).distance(105).strength(0.5))
      .force('charge', d3.forceManyBody<KiroNodeData>().strength(-230))
      .force('x', d3.forceX<KiroNodeData>((d) => tierX[d.tier] ?? width * 0.5).strength(0.85))
      .force('y', d3.forceY<KiroNodeData>(height * 0.54).strength(0.22))
      .force('collide', d3.forceCollide<KiroNodeData>(32));

    const renderPositions = () => {
      nodeSelection.attr('transform', (d) => {
        const nx = Math.max(46, Math.min(width - 46, d.x ?? width / 2));
        const ny = Math.max(34, Math.min(height - 30, d.y ?? height / 2));
        d.x = nx;
        d.y = ny;
        return `translate(${nx.toFixed(1)},${ny.toFixed(1)})`;
      });
      const arc = (d: KiroLinkData) => {
        const s = d.source as KiroNodeData;
        const t = d.target as KiroNodeData;
        const sx = s.x ?? 0;
        const sy = s.y ?? 0;
        const tx = t.x ?? 0;
        const ty = t.y ?? 0;
        const dr = Math.hypot(tx - sx, ty - sy) * 1.45;
        return `M${sx.toFixed(1)},${sy.toFixed(1)}A${dr.toFixed(1)},${dr.toFixed(1)} 0 0,1 ${tx.toFixed(1)},${ty.toFixed(1)}`;
      };
      linkHitPaths.attr('d', arc);
      linkVisiblePaths.attr('d', arc);
    };

    const dragBehavior = d3
      .drag<SVGGElement, KiroNodeData>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = event.x;
        d.fy = event.y;
      });

    nodeSelection.call(dragBehavior);

    nodeSelection
      .on('click', (_e, d) => setSelectedNodeId(d.id))
      .on('dblclick', (e, d) => {
        e.stopPropagation();
        d.fx = null;
        d.fy = null;
        simulation.alpha(0.35).restart();
      })
      .on('mouseenter', (event, d) => {
        setHoveredLinkId(null);
        setHoveredNodeId(d.id);
        const rect = svgEl.getBoundingClientRect();
        setTooltip({
          x: Math.min(rect.width - 210, Math.max(8, event.clientX - rect.left + 12)),
          y: Math.min(rect.height - 84, Math.max(8, event.clientY - rect.top - 12)),
          title: d.path,
          subtitle: `${CATEGORY_LABELS[d.category]} · ${d.trigger}`,
          body: d.summary,
        });
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
        setTooltip(null);
      })
      .on('focus', (_event, d) => {
        setHoveredLinkId(null);
        setHoveredNodeId(d.id);
      })
      .on('blur', () => {
        setHoveredNodeId(null);
      });

    linkWrappers
      .on('mouseenter', (event, d) => {
        setHoveredNodeId(null);
        setHoveredLinkId(d.id);
        const rect = svgEl.getBoundingClientRect();
        const s = d.source as KiroNodeData;
        const t = d.target as KiroNodeData;
        setTooltip({
          x: Math.min(rect.width - 210, Math.max(8, event.clientX - rect.left + 12)),
          y: Math.min(rect.height - 84, Math.max(8, event.clientY - rect.top - 12)),
          title: `${s.name} → ${t.name}`,
          subtitle: EDGE_KIND_LABELS[d.edgeKind],
          body: d.relation,
        });
      })
      .on('mouseleave', () => {
        setHoveredLinkId(null);
        setTooltip(null);
      })
      .on('click', (_e, d) => setSelectedNodeId(getEndpointId(d.target)));

    if (prefersReducedMotion) {
      simulation.stop();
      simulation.tick(140);
      renderPositions();
      updateStyles(false);
    } else {
      simulation.on('tick', renderPositions);
      simulation.tick(45);
      renderPositions();
      updateStyles(false);

      // Staggered d3-transition entrance animations for nodes and dependency arcs
      nodeSelection
        .transition()
        .duration(460)
        .delay((_d, i) => i * 50)
        .ease(d3.easeCubicOut)
        .style('opacity', 1);

      nodeSelection
        .select<SVGCircleElement>('.node-core')
        .transition()
        .duration(520)
        .delay((_d, i) => i * 50)
        .ease(d3.easeBackOut.overshoot(1.4))
        .attr('r', 11);

      nodeSelection
        .select<SVGCircleElement>('.node-halo')
        .transition()
        .duration(520)
        .delay((_d, i) => i * 50)
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr('r', 17);

      nodeSelection
        .select<SVGCircleElement>('.node-dot')
        .transition()
        .duration(420)
        .delay((_d, i) => i * 50 + 80)
        .attr('r', 2.5);

      nodeSelection
        .select<SVGTextElement>('.node-label')
        .transition()
        .duration(400)
        .delay((_d, i) => i * 50 + 120)
        .ease(d3.easeCubicOut)
        .style('opacity', 1);

      linkVisiblePaths
        .transition()
        .duration(520)
        .delay((_d, i) => 160 + i * 32)
        .ease(d3.easeCubicOut)
        .attr('stroke-opacity', (d) => {
          const { selectedNodeId: selId, hoveredNodeId: hovId, activeCategory: cat } = uiStateRef.current;
          const focusId = hovId ?? selId;
          const sId = getEndpointId(d.source);
          const tId = getEndpointId(d.target);
          const sNode = nodes.find((n) => n.id === sId);
          const tNode = nodes.find((n) => n.id === tId);
          const matchesCat = cat === 'all' || sNode?.category === cat || tNode?.category === cat;
          const isConn = sId === focusId || tId === focusId;
          return !matchesCat ? 0.08 : isConn ? 0.88 : 0.22;
        })
        .on('end', (_d, i, group) => {
          if (i === group.length - 1) {
            entranceComplete = true;
          }
        });
    }

    return () => {
      simulation.stop();
    };
  }, [rawGraph, dimensions]);

  useEffect(() => {
    applyHighlightRef.current(true);
  }, [selectedNodeId, hoveredNodeId, hoveredLinkId, activeCategory]);

  const activeFocusId = hoveredNodeId ?? selectedNodeId;
  const focusedNode = rawGraph.nodes.find((n) => n.id === activeFocusId) ?? rawGraph.nodes[0];
  const selectedNode = rawGraph.nodes.find((n) => n.id === selectedNodeId) ?? rawGraph.nodes[0];

  const dependentHookInfo = useMemo(() => {
    const hookNodes = rawGraph.nodes.filter((n) => n.category === 'hook');
    // BFS downstream along directed dependency/governance/hook edges from focusedNode
    const visited = new Set<string>([focusedNode.id]);
    const queue: Array<{ id: string; trail: string[] }> = [
      { id: focusedNode.id, trail: [focusedNode.name] },
    ];
    const reachableTrails = new Map<string, string[]>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const link of rawGraph.links) {
        const sId = getEndpointId(link.source);
        const tId = getEndpointId(link.target);
        if (sId === current.id) {
          const targetNode = rawGraph.nodes.find((n) => n.id === tId);
          if (!targetNode) continue;
          const nextTrail = [...current.trail, targetNode.name];
          if (targetNode.category === 'hook' && !reachableTrails.has(tId)) {
            reachableTrails.set(tId, nextTrail);
          }
          if (!visited.has(tId)) {
            visited.add(tId);
            queue.push({ id: tId, trail: nextTrail });
          }
        }
      }
    }

    if (focusedNode.category === 'hook') {
      reachableTrails.set(focusedNode.id, [focusedNode.name]);
    }

    return hookNodes.map((hook) => ({
      hook,
      isDependent: reachableTrails.has(hook.id),
      trail: reachableTrails.get(hook.id) ?? null,
    }));
  }, [focusedNode, rawGraph.links, rawGraph.nodes]);

  const connectedEdges = useMemo(
    () =>
      rawGraph.links.filter(
        (l) => getEndpointId(l.source) === focusedNode.id || getEndpointId(l.target) === focusedNode.id,
      ),
    [rawGraph.links, focusedNode.id],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8 border border-[#1F2A40] rounded-lg bg-[#07090E] p-3 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#EDF2F9]">
              D3 .kiro Spec &amp; Hook Topology
            </span>
            <span className="text-[11px] font-mono-tabular text-[#8A99B8]">
              Zoom {Math.round(zoomScale * 100)}%
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex flex-wrap items-center gap-1 p-0.5 rounded bg-[#0B0F17] border border-[#1F2A40]">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-2 py-0.5 text-[11px] rounded cursor-pointer ${
                  activeCategory === 'all' ? 'bg-[#161D2E] text-[#EDF2F9]' : 'text-[#8A99B8]'
                }`}
              >
                All
              </button>
              {(Object.keys(CATEGORY_LABELS) as NodeCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(activeCategory === cat ? 'all' : cat)}
                  className={`px-2 py-0.5 text-[11px] rounded flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === cat ? 'bg-[#161D2E] text-[#EDF2F9]' : 'text-[#8A99B8]'
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-xs" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span>{CATEGORY_LABELS[cat]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!svgRef.current || !zoomBehaviorRef.current) return;
                d3.select(svgRef.current).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
                setZoomScale(1);
              }}
              className="px-2 py-1 text-[11px] rounded border border-[#1F2A40] bg-[#0B0F17] text-[#8A99B8] hover:border-[#00E5CC] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div ref={containerRef} className="relative h-[320px] overflow-hidden">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            role="img"
            aria-label="D3 .kiro spec dependencies and hooks diagram"
            className="w-full h-full block select-none"
          />
          {tooltip && (
            <div
              className="pointer-events-none absolute z-10 bg-[#111622] border border-[#1F2A40] rounded-md p-2 text-xs shadow-lg max-w-[215px]"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <div className="font-mono font-semibold text-[#00E5CC] truncate">{tooltip.title}</div>
              <div className="text-[11px] text-[#8A99B8] mt-0.5">{tooltip.subtitle}</div>
              <p className="text-[#EDF2F9] mt-1 leading-snug">{tooltip.body}</p>
            </div>
          )}
        </div>
      </div>

      <aside
        aria-label="Node Details and Dependent Hooks Sidebar"
        className="lg:col-span-4 border border-[#1F2A40] rounded-lg bg-[#111622] p-3.5 flex flex-col gap-3"
      >
        <div className="pb-2 border-b border-[#1F2A40]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-[#8A99B8]">
              {hoveredNodeId ? 'Hover Focus' : 'Selected Node'}
            </span>
            <span className="text-[11px] font-mono text-[#00E5CC]">{focusedNode.trigger}</span>
          </div>
          <div className="text-xs font-mono font-semibold text-[#00E5CC] truncate mt-0.5">
            {focusedNode.path}
          </div>
          <div className="text-[11px] text-[#8A99B8] mt-0.5">
            {CATEGORY_LABELS[focusedNode.category]} · {selectedNode.name !== focusedNode.name ? `Pinned: ${selectedNode.name}` : 'Click node to pin'}
          </div>
        </div>

        <p className="text-xs text-[#EDF2F9] leading-relaxed">{focusedNode.summary}</p>

        {/* Dependent Hooks Highlighted on Node Hover / Focus */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[#F59E0B]">
              Dependent Hooks ({dependentHookInfo.filter((h) => h.isDependent).length})
            </span>
            <span className="text-[#8A99B8]">Live focus</span>
          </div>
          {dependentHookInfo.map(({ hook, isDependent, trail }) => (
            <button
              key={hook.id}
              type="button"
              onClick={() => setSelectedNodeId(hook.id)}
              onMouseEnter={() => setHoveredNodeId(hook.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              className={`text-left px-2.5 py-2 rounded border transition-all duration-150 cursor-pointer ${
                isDependent
                  ? 'border-[#F59E0B] bg-[#F59E0B]/12 shadow-[0_0_12px_rgba(245,158,11,0.16)]'
                  : 'border-[#1F2A40] bg-[#07090E] opacity-50 hover:opacity-85'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                <span className={isDependent ? 'text-[#F59E0B] font-semibold' : 'text-[#8A99B8]'}>
                  {hook.name}
                </span>
                <span className={isDependent ? 'text-[#EDF2F9]' : 'text-[#5E6E8E]'}>
                  {hook.trigger}
                </span>
              </div>
              {trail && (
                <div className="text-[10px] font-mono text-[#EDF2F9]/85 mt-1 truncate">
                  {trail.join(' → ')}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[#8A99B8]">
            Connected Relationships ({connectedEdges.length})
          </span>
          {connectedEdges.map((edge) => {
            const sId = getEndpointId(edge.source);
            const tId = getEndpointId(edge.target);
            const otherId = sId === focusedNode.id ? tId : sId;
            const other = rawGraph.nodes.find((n) => n.id === otherId);
            const dir = sId === focusedNode.id ? 'Feeds' : 'Governed by';
            const isHookEdge = edge.edgeKind === 'hook' || other?.category === 'hook';
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => setSelectedNodeId(otherId)}
                onMouseEnter={() => setHoveredLinkId(edge.id)}
                onMouseLeave={() => setHoveredLinkId(null)}
                className={`text-left px-2 py-1 rounded border text-[11px] font-mono cursor-pointer transition-colors ${
                  isHookEdge
                    ? 'border-[#F59E0B]/60 bg-[#07090E] text-[#EDF2F9] hover:border-[#F59E0B]'
                    : 'border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:border-[#00E5CC] hover:text-[#EDF2F9]'
                }`}
              >
                <span className={isHookEdge ? 'text-[#F59E0B]' : 'text-[#00E5CC]'}>{dir}</span>{' '}
                {other?.name} · {edge.relation}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
