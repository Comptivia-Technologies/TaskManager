import { useMemo } from 'react';
import { TEAM_FALLBACK, teamColors } from '../../utils/theme';

interface FlowStripProps {
  stages: { stageId: string; stageName: string; stageOrder: number; teamId?: string; teamName?: string }[];
  /** Print the team key under the strip. */
  showTeams?: boolean;
}

/**
 * A workflow's fingerprint: one dot per stage on a line, coloured by the team
 * that owns it. Enough to see at a glance how long a process is and how often it
 * changes hands, without opening it. Team names are printed beneath, so the
 * colour is never the only way to tell teams apart.
 */
const FlowStrip = ({ stages, showTeams = true }: FlowStripProps) => {
  const ordered = useMemo(() => [...stages].sort((a, b) => a.stageOrder - b.stageOrder), [stages]);
  const colors = useMemo(
    () => teamColors(ordered.map((s) => ({ teamId: s.teamId, stageOrder: s.stageOrder }))),
    [ordered]
  );
  const teams = useMemo(() => {
    const seen = new Map<string, string>();
    ordered.forEach((s) => {
      if (s.teamId && !seen.has(s.teamId)) seen.set(s.teamId, s.teamName || 'Team');
    });
    return [...seen.entries()];
  }, [ordered]);

  if (ordered.length === 0) {
    return <p className="text-meta text-ink-subtle">No stages yet.</p>;
  }

  return (
    <div>
      <div className="relative flex items-center" role="img" aria-label={`${ordered.length} stages: ${ordered.map((s) => s.stageName).join(', ')}`}>
        <span aria-hidden="true" className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-px bg-line-strong" />
        <div className="relative flex w-full justify-between">
          {ordered.map((stage) => (
            <span
              key={stage.stageId}
              title={`${stage.stageOrder}. ${stage.stageName}${stage.teamName ? ` · ${stage.teamName}` : ''}`}
              className="h-3 w-3 rounded-full ring-[3px] ring-surface"
              style={{ backgroundColor: (stage.teamId && colors.get(stage.teamId)) || TEAM_FALLBACK }}
            />
          ))}
        </div>
      </div>
      {showTeams && teams.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {teams.map(([id, name]) => (
            <li key={id} className="inline-flex items-center gap-1.5 text-meta text-ink-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.get(id) }} />
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FlowStrip;
