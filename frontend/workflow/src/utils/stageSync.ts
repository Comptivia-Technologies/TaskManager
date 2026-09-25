import { stageService } from '../services/stageService';
import { Stage } from '../types';

/**
 * A stage as the builder screens hold it before it is saved. New stages have no
 * `stageId`; existing ones do.
 */
export interface DraftStage {
  stageId?: string;
  stageName: string;
  stageOrder: number;
  teamId: string;
  stageType?: 'Process' | 'Escalation';
  transitionPolicy?: 'OnComplete' | 'OnTimeout' | 'Manual';
  timeoutMinutes?: number;
}

// Defaults were repeated at every call site, so a stage created from one screen
// could differ from the same stage created by another.
const withDefaults = (stage: DraftStage, stageOrder: number) => ({
  stageName: stage.stageName,
  stageOrder,
  teamId: stage.teamId,
  stageType: stage.stageType ?? ('Process' as const),
  transitionPolicy: stage.transitionPolicy ?? ('OnComplete' as const),
  timeoutMinutes: stage.timeoutMinutes,
});

/** Stage numbers follow position, so a move is just a re-numbered array. */
export const moveStage = <T extends { stageOrder: number }>(stages: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= stages.length) return stages;
  const next = [...stages];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((s, i) => ({ ...s, stageOrder: i + 1 }));
};

/** Creates every stage of a brand new workflow, numbered by position. */
export const createStages = async (workflowId: string, stages: DraftStage[]) => {
  for (let i = 0; i < stages.length; i += 1) {
    await stageService.create({ ...withDefaults(stages[i], i + 1), workflowId });
  }
};

/**
 * Brings a workflow's stages in line with what the screen is holding: removes the
 * ones that are gone, updates the ones that changed, creates the new ones. Stages
 * are renumbered by position, so reordering is just a different array order.
 */
export const syncStages = async (
  workflowId: string,
  desired: DraftStage[],
  original: Stage[]
) => {
  const keptIds = new Set(desired.filter((s) => s.stageId).map((s) => s.stageId!));
  for (const removed of original.filter((s) => !keptIds.has(s.stageId))) {
    await stageService.delete(removed.stageId);
  }

  for (let i = 0; i < desired.length; i += 1) {
    const stage = desired[i];
    const stageOrder = i + 1;

    if (!stage.stageId) {
      await stageService.create({ ...withDefaults(stage, stageOrder), workflowId });
      continue;
    }

    // Only write when something actually differs, so an untouched stage is not
    // rewritten on every save.
    const before = original.find((s) => s.stageId === stage.stageId);
    if (!before) continue;

    const changed =
      before.stageName !== stage.stageName ||
      before.stageOrder !== stageOrder ||
      before.teamId !== stage.teamId;

    if (changed) {
      await stageService.update(stage.stageId, withDefaults(stage, stageOrder));
    }
  }
};
