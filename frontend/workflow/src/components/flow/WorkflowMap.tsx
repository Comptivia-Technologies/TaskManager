import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { TEAM_FALLBACK, teamColors } from '../../utils/theme';

export interface MapStage {
  id: string;
  order: number;
  name: string;
  teamId?: string;
  teamName?: string;
}

interface WorkflowMapProps {
  stages: MapStage[];
  selectedId?: string | null;
  onSelect?: (stageId: string) => void;
  /** Accessible name for the whole map. */
  label?: string;
  /** Tighter geometry for previews inside forms. */
  compact?: boolean;
}

interface Lane {
  key: string;
  name: string;
  color: string;
  count: number;
}

/**
 * The workflow as a swimlane map: one lane per team, one column per stage, and a
 * connector for every hand-off. It shows what a list of stages cannot — how often
 * work changes hands, and which teams it keeps coming back to.
 *
 * Geometry is fixed per column and lane, so connectors are computed rather than
 * measured and the map renders identically every time. Nodes are HTML buttons over
 * an SVG connector layer: text stays crisp and every stage is focusable.
 */
const WorkflowMap = ({ stages, selectedId, onSelect, label = 'Workflow map', compact = false }: WorkflowMapProps) => {
  const reduceMotion = useReducedMotion();
  const markerId = `map-arrow-${useId().replace(/:/g, '')}`;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  // On a phone the lane labels would take half the width, so they shrink there.
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 639px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const tight = compact || narrow;
  const COL_W = tight ? 136 : 160;
  const NODE_W = tight ? 116 : 136;
  const NODE_H = tight ? 46 : 52;
  const LANE_H = tight ? 64 : 76;
  const LABEL_W = narrow ? 116 : compact ? 132 : 172;
  const R = 8;

  // Fades mark the edges that have more map beyond them, so a long workflow does
  // not look as though it ends at the viewport.
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setOverflow({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, stages.length]);

  const ordered = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const lanes = useMemo<Lane[]>(() => {
    const colors = teamColors(ordered.map((s) => ({ teamId: s.teamId, stageOrder: s.order })));
    const byKey = new Map<string, Lane>();
    ordered.forEach((stage) => {
      const key = stage.teamId || 'unassigned';
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      byKey.set(key, {
        key,
        name: stage.teamName || 'No team',
        color: stage.teamId ? colors.get(stage.teamId) ?? TEAM_FALLBACK : TEAM_FALLBACK,
        count: 1,
      });
    });
    return [...byKey.values()];
  }, [ordered]);

  // Stepping through stages with Previous/Next keeps the chosen node on screen.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !selectedId) return;
    const col = ordered.findIndex((s) => s.id === selectedId);
    if (col < 0) return;
    const left = LABEL_W + col * COL_W;
    const visibleFrom = el.scrollLeft + LABEL_W;
    const visibleTo = el.scrollLeft + el.clientWidth;
    if (left < visibleFrom || left + COL_W > visibleTo) {
      const target = Math.max(0, left - LABEL_W - COL_W / 2);
      // jsdom has no element scrollTo; a plain assignment is the same jump.
      if (typeof el.scrollTo === 'function') el.scrollTo({ left: target, behavior: reduceMotion ? 'auto' : 'smooth' });
      else el.scrollLeft = target;
    }
  }, [selectedId, ordered, LABEL_W, COL_W, reduceMotion]);

  if (ordered.length === 0) return null;

  const laneIndex = (stage: MapStage) => lanes.findIndex((l) => l.key === (stage.teamId || 'unassigned'));
  const width = LABEL_W + ordered.length * COL_W + 16;
  const height = lanes.length * LANE_H;
  const nodeX = (col: number) => LABEL_W + col * COL_W + (COL_W - NODE_W) / 2;
  const laneMidY = (lane: number) => lane * LANE_H + LANE_H / 2;

  // Orthogonal connector with rounded elbows. Same lane: a straight run. Different
  // lane: out, down (or up) through the gap between columns, then in.
  const connector = (from: number, to: number) => {
    const a = laneIndex(ordered[from]);
    const b = laneIndex(ordered[to]);
    const x1 = nodeX(from) + NODE_W;
    const x2 = nodeX(to) - 2;
    const y1 = laneMidY(a);
    const y2 = laneMidY(b);
    if (a === b) return `M ${x1} ${y1} H ${x2}`;
    const mid = (x1 + x2) / 2;
    const dir = y2 > y1 ? 1 : -1;
    return [
      `M ${x1} ${y1}`,
      `H ${mid - R}`,
      `Q ${mid} ${y1} ${mid} ${y1 + dir * R}`,
      `V ${y2 - dir * R}`,
      `Q ${mid} ${y2} ${mid + R} ${y2}`,
      `H ${x2}`,
    ].join(' ');
  };

  const handoffs = ordered.slice(1).filter((s, i) => laneIndex(s) !== laneIndex(ordered[i])).length;

  return (
    <div className="relative rounded-card border border-line bg-surface overflow-hidden">
      {overflow.right && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[4] w-16 bg-gradient-to-l from-surface via-surface/80 to-transparent" />
      )}
      {overflow.left && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-[4] w-10 bg-gradient-to-r from-black/[0.06] to-transparent"
          style={{ left: LABEL_W }}
        />
      )}
    <div ref={scrollerRef} onScroll={measure} className="overflow-x-auto scrollbar-thin">
      <div className="relative" style={{ width, height }} role="group" aria-label={`${label}: ${ordered.length} stages across ${lanes.length} teams, ${handoffs} hand-offs`}>
        {/* Lanes */}
        {lanes.map((lane, i) => (
          <div
            key={lane.key}
            className={`absolute left-0 right-0 border-b border-line-subtle last:border-b-0 ${i % 2 === 1 ? 'bg-surface-muted' : 'bg-surface'}`}
            style={{ top: i * LANE_H, height: LANE_H }}
          />
        ))}

        {/* Lane labels stay put while the stages scroll past them. */}
        <div className="sticky left-0 z-[3] h-full" style={{ width: LABEL_W }}>
          {lanes.map((lane, i) => (
            <div
              key={lane.key}
              className={`absolute left-0 flex items-center gap-2 border-r border-line ${narrow ? 'pl-2.5 pr-2' : 'pl-4 pr-3'} ${i % 2 === 1 ? 'bg-surface-muted' : 'bg-surface'}`}
              style={{ top: i * LANE_H, height: LANE_H, width: LABEL_W }}
            >
              <span aria-hidden="true" className="h-7 w-[3px] rounded-full shrink-0" style={{ backgroundColor: lane.color }} />
              <div className="min-w-0 leading-tight">
                <p
                  className={`${narrow ? 'text-[11px] leading-[14px] line-clamp-2 hyphens-auto' : tight ? 'text-meta truncate' : 'text-body truncate'} font-semibold text-ink`}
                  title={lane.name}
                >
                  {lane.name}
                </p>
                {!narrow && (
                  <p className="text-[11px] text-ink-subtle">
                    {lane.count} stage{lane.count === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Connectors */}
        <svg aria-hidden="true" className="absolute inset-0 z-[1] pointer-events-none" width={width} height={height}>
          <defs>
            <marker id={markerId} markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0.5,0.5 L7,4 L0.5,7.5" fill="none" stroke="#8A90A8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {ordered.slice(1).map((stage, i) => (
            <m.path
              key={`${ordered[i].id}-${stage.id}`}
              d={connector(i, i + 1)}
              fill="none"
              stroke="#A9B0C4"
              strokeWidth="1.5"
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.1 + i * 0.05, ease: [0.4, 0, 0.2, 1] }}
            />
          ))}
        </svg>

        {/* Stage nodes */}
        {ordered.map((stage, col) => {
          const lane = lanes[laneIndex(stage)];
          const selected = selectedId === stage.id;
          const top = laneMidY(laneIndex(stage)) - NODE_H / 2;
          const content = (
            <>
              <span
                aria-hidden="true"
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                style={{ backgroundColor: lane.color }}
              />
              <span className="flex items-start gap-2 min-w-0 pl-1.5">
                <span className={`mt-px font-mono text-[11px] font-medium shrink-0 ${selected ? 'text-primary' : 'text-ink-subtle'}`}>
                  {String(stage.order).padStart(2, '0')}
                </span>
                <span className="text-[12px] leading-[14px] font-medium text-ink line-clamp-3 text-left">{stage.name}</span>
              </span>
            </>
          );
          const className = `absolute z-[2] flex items-center px-2.5 rounded-control bg-surface text-left overflow-hidden
            border ${selected ? 'border-primary ring-2 ring-primary-soft shadow-azure-md' : 'border-line-strong shadow-azure-sm'}`;
          const style = { left: nodeX(col), top, width: NODE_W, height: NODE_H };
          return onSelect ? (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelect(stage.id)}
              aria-pressed={selected}
              aria-label={`Stage ${stage.order}: ${stage.name}, owned by ${lane.name}`}
              title={`${stage.name} · ${lane.name}`}
              className={`${className} cursor-pointer hover:border-primary hover:shadow-azure-md`}
              style={style}
            >
              {content}
            </button>
          ) : (
            <div key={stage.id} className={className} style={style} title={`${stage.name} · ${lane.name}`}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
};

export default WorkflowMap;
