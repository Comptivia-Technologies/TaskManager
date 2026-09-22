import { useId, useMemo } from 'react';
import { TaskStageHistory } from '../types';

const RADIUS = 22;
const GAP = 118;
const PAD_X = 44;
const LANE = 22;
const STUB = 12;
const BACK_GAP = 10;

export interface StageGraphNode {
  id: string;
  name: string;
  order: number;
}

export interface StageGraphEdge {
  id: string;
  from: number;
  to: number;
  kind: 'center' | 'backward' | 'forward';
  lane: number;
}

interface OccupiedLane {
  lane: number;
  left: number;
  right: number;
}

const takeLane = (occupied: OccupiedLane[], from: number, to: number) => {
  const left = Math.min(from, to);
  const right = Math.max(from, to);
  let lane = 0;
  while (occupied.some((item) => item.lane === lane && left < item.right && right > item.left)) {
    lane += 1;
  }
  occupied.push({ lane, left, right });
  return lane;
};

export const buildStageGraph = (history: TaskStageHistory[]) => {
  const ordered = [...history].sort((a, b) => a.sequence - b.sequence);
  const nodes = new Map<string, StageGraphNode>();

  const touch = (id?: string, name?: string, order?: number) => {
    if (!id) return;
    const current = nodes.get(id);
    if (!current) {
      nodes.set(id, { id, name: name?.trim() || 'Stage', order: order ?? Number.MAX_SAFE_INTEGER });
      return;
    }
    if (name?.trim()) current.name = name.trim();
    if (order != null && order > 0) current.order = order;
  };

  ordered.forEach((entry) => {
    touch(entry.stageId, entry.stageName, entry.stageOrder);
    touch(entry.fromStageId, entry.fromStageName);
    touch(entry.toStageId, entry.toStageName);
  });

  const nodeList = [...nodes.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const indexById = new Map(nodeList.map((node, index) => [node.id, index]));
  const centerUsed = new Set<string>();
  const topLanes: OccupiedLane[] = [];
  const bottomLanes: OccupiedLane[] = [];
  const edges: StageGraphEdge[] = [];

  ordered.forEach((entry) => {
    if (!entry.fromStageId || !entry.toStageId || entry.fromStageId === entry.toStageId) return;
    const from = indexById.get(entry.fromStageId);
    const to = indexById.get(entry.toStageId);
    if (from == null || to == null || from === to) return;

    if (to === from + 1 && !centerUsed.has(`${from}->${to}`)) {
      centerUsed.add(`${from}->${to}`);
      edges.push({ id: entry.historyId, from, to, kind: 'center', lane: 0 });
      return;
    }

    if (to < from) {
      edges.push({ id: entry.historyId, from, to, kind: 'backward', lane: takeLane(topLanes, from, to) });
      return;
    }

    edges.push({ id: entry.historyId, from, to, kind: 'forward', lane: takeLane(bottomLanes, from, to) });
  });

  return { nodes: nodeList, edges };
};

const captionLines = (name: string) => {
  const clean = name.trim();
  if (clean.length <= 18) return [clean];
  const words = clean.split(/\s+/);
  if (words.length > 1) {
    let line = '';
    let index = 0;
    while (index < words.length && `${line} ${words[index]}`.trim().length <= 18) {
      line = `${line} ${words[index]}`.trim();
      index += 1;
    }
    const rest = words.slice(index).join(' ');
    if (line && rest) return [line, rest.length > 18 ? `${rest.slice(0, 17)}…` : rest];
  }
  return [`${clean.slice(0, 17)}…`];
};

const resolveCurrentStageId = (nodes: StageGraphNode[], history: TaskStageHistory[], currentStageId?: string) => {
  if (currentStageId && nodes.some((node) => node.id === currentStageId)) return currentStageId;
  const ordered = [...history].sort((a, b) => b.sequence - a.sequence);
  for (const entry of ordered) {
    if (entry.fromStageId && entry.toStageId && entry.fromStageId !== entry.toStageId && nodes.some((node) => node.id === entry.toStageId)) {
      return entry.toStageId;
    }
    if (entry.action === 'Assigned' && nodes.some((node) => node.id === entry.stageId)) return entry.stageId;
  }
  return nodes[nodes.length - 1]?.id;
};

const pathLabel = (nodes: StageGraphNode[], edges: StageGraphEdge[]) => {
  if (nodes.length === 0) return 'No stages';
  if (edges.length === 0) return nodes.map((node) => node.name).join(', ');
  const parts = [nodes[edges[0].from].name];
  edges.forEach((edge) => {
    const name = nodes[edge.to].name;
    parts.push(edge.kind === 'backward' ? `back to ${name}` : name);
  });
  return parts.join(', ');
};

interface TaskHistoryGraphProps {
  history: TaskStageHistory[];
  currentStageId?: string;
}

const BRAND = '#434E78';
const RETURNED = '#ea580c';
const GLOW = 20;

const TaskHistoryGraph = ({ history, currentStageId }: TaskHistoryGraphProps) => {
  const markerScope = useId().replace(/:/g, '');
  const graph = useMemo(() => buildStageGraph(history), [history]);
  const { nodes, edges } = graph;
  const activeId = useMemo(
    () => resolveCurrentStageId(nodes, history, currentStageId),
    [nodes, history, currentStageId]
  );

  if (nodes.length === 0) return null;

  const captions = nodes.map((node) => captionLines(node.name));
  const captionRows = Math.max(1, ...captions.map((lines) => lines.length));
  const topLanes = edges.reduce((max, edge) => (edge.kind === 'backward' ? Math.max(max, edge.lane + 1) : max), 0);
  const bottomLanes = edges.reduce((max, edge) => (edge.kind === 'forward' ? Math.max(max, edge.lane + 1) : max), 0);
  const centerY = Math.max(GLOW, topLanes > 0 ? 12 + topLanes * LANE + STUB : GLOW) + RADIUS;
  const labelBottom = centerY + RADIUS + 6 + captionRows * 14;
  const width = PAD_X * 2 + Math.max(0, nodes.length - 1) * GAP;
  const height = labelBottom + (bottomLanes > 0 ? STUB + bottomLanes * LANE + 10 : GLOW);
  const xAt = (index: number) => PAD_X + index * GAP;
  const forwardMarker = `arrow-forward-${markerScope}`;
  const backMarker = `arrow-back-${markerScope}`;
  const shadowId = `node-shadow-${markerScope}`;

  return (
    <section className="mb-4 rounded-azure-sm border border-[#434E78]/20 bg-gradient-to-b from-[#434E78]/10 to-white px-4 py-3" aria-label="Stage progression">
      <style>{`
        @keyframes stage-ping {
          0% { transform: scale(1); opacity: 0.75; }
          80%, 100% { transform: scale(1.7); opacity: 0; }
        }
        .stage-current-ping {
          transform-box: fill-box;
          transform-origin: center;
          animation: stage-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-black font-sans">Stage progression</h3>
        <div className="flex items-center gap-3 text-xs text-black/60 font-sans">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-[#434E78]" />
            Forward
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-orange-600" />
            Returned
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={pathLabel(nodes, edges)}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto"
        >
          <defs>
            <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={BRAND} floodOpacity="0.28" />
            </filter>
            <marker id={forwardMarker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={BRAND} />
            </marker>
            <marker id={backMarker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={RETURNED} />
            </marker>
          </defs>
          {edges.map((edge) => {
            const x1 = xAt(edge.from);
            const x2 = xAt(edge.to);
            if (edge.kind === 'center') {
              return (
                <line
                  key={edge.id}
                  data-kind="center"
                  x1={x1 + RADIUS}
                  y1={centerY}
                  x2={x2 - RADIUS}
                  y2={centerY}
                  stroke={BRAND}
                  strokeWidth="2"
                  strokeLinecap="round"
                  markerEnd={`url(#${forwardMarker})`}
                />
              );
            }
            if (edge.kind === 'backward') {
              const yLane = centerY - RADIUS - STUB - edge.lane * LANE;
              return (
                <path
                  key={edge.id}
                  data-kind="backward"
                  d={`M ${x1} ${centerY - RADIUS} L ${x1} ${yLane} L ${x2 + RADIUS + BACK_GAP} ${yLane}`}
                  fill="none"
                  stroke={RETURNED}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={`url(#${backMarker})`}
                />
              );
            }
            const yLane = labelBottom + STUB + edge.lane * LANE;
            return (
              <path
                key={edge.id}
                data-kind="forward"
                d={`M ${x1} ${centerY + RADIUS} L ${x1} ${yLane} L ${x2} ${yLane} L ${x2} ${centerY + RADIUS}`}
                fill="none"
                stroke={BRAND}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#${forwardMarker})`}
              />
            );
          })}
          {nodes.map((node, index) => {
            const lines = captions[index];
            const current = node.id === activeId;
            const orderLabel = node.order > 0 && node.order < Number.MAX_SAFE_INTEGER ? String(node.order) : String(index + 1);
            const x = xAt(index);
            return (
              <g key={node.id} data-current={current ? 'true' : 'false'}>
                <title>{node.name}</title>
                {current && (
                  <circle className="stage-current-ping" cx={x} cy={centerY} r={RADIUS} fill={BRAND} />
                )}
                <circle
                  cx={x}
                  cy={centerY}
                  r={RADIUS}
                  fill={current ? BRAND : '#ffffff'}
                  stroke={current ? '#ffffff' : BRAND}
                  strokeWidth={current ? 3 : 2}
                  filter={`url(#${shadowId})`}
                />
                <text
                  x={x}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={current ? '#ffffff' : BRAND}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="inherit"
                >
                  {orderLabel}
                </text>
                <text
                  x={x}
                  y={centerY + RADIUS + 14}
                  textAnchor="middle"
                  fill={current ? BRAND : '#1a1a1a'}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="inherit"
                  stroke="#ffffff"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {lines.map((line, lineIndex) => (
                    <tspan key={line} x={x} dy={lineIndex === 0 ? 0 : 13}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};

export default TaskHistoryGraph;
