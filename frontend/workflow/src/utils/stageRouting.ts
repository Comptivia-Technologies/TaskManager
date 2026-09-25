import { Stage } from '../types';
import { isAppointedStage } from './stageFormRegistry';

/**
 * Why a stage needs no assignee chosen for it, or null when someone must choose.
 *
 * Two stages route themselves. One was appointed earlier — the team lead naming
 * the engineer. The other belongs to a team that has already worked on this
 * enquiry, and goes back to the same person: procurement returns the BOQ to the
 * engineer who listed the items, and both approvals return the quotation to the
 * administrator who raised it. The backend decides this the same way, from the
 * task's own history, so what the picker offered would only ever be an override.
 */
export const autoRoutingReason = (nextStage: Stage | undefined, stages: Stage[]): string | null => {
  if (!nextStage) return null;

  if (isAppointedStage(nextStage.stageName)) {
    return 'goes to the person the team lead appointed';
  }

  const teamWasHereBefore = stages.some(
    (stage) => stage.stageOrder < nextStage.stageOrder && stage.teamId === nextStage.teamId
  );
  if (teamWasHereBefore) {
    return `goes back to the same ${nextStage.teamName || 'team'} member who worked on this earlier`;
  }

  return null;
};
