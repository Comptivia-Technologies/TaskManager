import { autoRoutingReason } from '../../utils/stageRouting';
import { Stage } from '../../types';

const ADMIN = 'team-admin';
const LEAD = 'team-lead';
const SITE = 'team-site';
const ENG = 'team-eng';
const PROC = 'team-proc';
const MGMT = 'team-mgmt';
const SENIOR = 'team-senior';

const stage = (order: number, stageName: string, teamId: string, teamName: string): Stage =>
  ({
    stageId: `stage-${order}`,
    stageName,
    stageOrder: order,
    workflowId: 'wf',
    teamId,
    teamName,
    stageType: 'Process',
    transitionPolicy: 'OnComplete',
    createdAt: '2026-01-01T00:00:00Z',
  } as Stage);

// The TABINS process, which is the case every rule here exists for.
const stages: Stage[] = [
  stage(1, 'Receive & Register Enquiry', ADMIN, 'Administration'),
  stage(2, 'Assign Team', LEAD, 'Team Lead'),
  stage(3, 'Site Visit & Scope Capture', SITE, 'Site Personnel'),
  stage(4, 'Verify Site Information', ENG, 'Engineering'),
  stage(5, 'Obtain Supplier Prices', PROC, 'Procurement'),
  stage(6, 'Prepare & Check BOQ', ENG, 'Engineering'),
  stage(7, 'Manager Approval', MGMT, 'Management'),
  stage(8, 'Draft Quotation', ADMIN, 'Administration'),
  stage(9, 'Engineer Verification', ENG, 'Engineering'),
  stage(10, 'Senior Management Approval', SENIOR, 'Senior Management'),
  stage(11, 'Issue to Client & Close', ADMIN, 'Administration'),
];

const reasonFor = (order: number) =>
  autoRoutingReason(stages.find((s) => s.stageOrder === order), stages);

describe('autoRoutingReason', () => {
  it('routes a stage the team lead appointed someone to', () => {
    expect(reasonFor(3)).toBe('goes to the person the team lead appointed');
    expect(reasonFor(4)).toBe('goes to the person the team lead appointed');
  });

  it('returns work to the team member who already had it', () => {
    // Procurement hands the BOQ back to the engineer who listed the items.
    expect(reasonFor(6)).toContain('Engineering');
    // The administrator drafts the quotation he raised, then issues it.
    expect(reasonFor(8)).toContain('Administration');
    expect(reasonFor(11)).toContain('Administration');
    // And the engineer who built the BOQ verifies the draft against it.
    expect(reasonFor(9)).toContain('Engineering');
  });

  it('asks for a choice when a team arrives for the first time', () => {
    expect(reasonFor(2)).toBeNull(); // Team Lead
    expect(reasonFor(5)).toBeNull(); // Procurement
    expect(reasonFor(7)).toBeNull(); // Management
    expect(reasonFor(10)).toBeNull(); // Senior Management
  });

  it('has nothing to say about the final stage', () => {
    expect(autoRoutingReason(undefined, stages)).toBeNull();
  });

  it('falls back to a plain word when the stage carries no team name', () => {
    const unnamed = { ...stage(6, 'Prepare & Check BOQ', ENG, '') };
    expect(autoRoutingReason(unnamed, stages)).toContain('same team member');
  });
});
