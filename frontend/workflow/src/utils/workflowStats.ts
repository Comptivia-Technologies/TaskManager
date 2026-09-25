import { Workflow } from '../types';

const ordered = (workflow: Workflow) => [...(workflow.stages ?? [])].sort((a, b) => a.stageOrder - b.stageOrder);

/** Times the work changes team on its way through. */
export const countHandoffs = (workflow: Workflow) => {
  const stages = ordered(workflow);
  return stages.slice(1).filter((stage, i) => stage.teamId !== stages[i].teamId).length;
};

/** Distinct teams that own at least one stage. */
export const countTeams = (workflow: Workflow) =>
  new Set((workflow.stages ?? []).map((s) => s.teamId).filter(Boolean)).size;
