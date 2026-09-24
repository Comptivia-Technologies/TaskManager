import { getStageForm, hasStageForm } from '../../utils/stageFormRegistry';

describe('stageFormRegistry', () => {
  it('finds a schema by stage name regardless of case or padding', () => {
    expect(getStageForm('Manager Approval').title).toBe('Manager approval');
    expect(getStageForm('  manager approval  ').title).toBe('Manager approval');
  });

  it('falls back to generic notes for an unknown stage', () => {
    const schema = getStageForm('Some Other Stage');
    expect(schema.title).toBe('Stage notes');
    expect(schema.fields.map((f) => f.name)).toEqual(['notes']);
  });

  it('falls back when no stage name is given', () => {
    expect(getStageForm(undefined).title).toBe('Stage notes');
  });

  it('reports whether a stage has a bespoke schema', () => {
    expect(hasStageForm('Prepare & Check BOQ')).toBe(true);
    expect(hasStageForm('Unmapped stage')).toBe(false);
    expect(hasStageForm(undefined)).toBe(false);
  });

  it('marks the enquiry intake fields that the process requires', () => {
    const required = getStageForm('Receive & Register Enquiry')
      .fields.filter((f) => f.required)
      .map((f) => f.name);
    expect(required).toEqual(
      expect.arrayContaining(['enquiryNumber', 'client', 'project', 'receivedOn', 'scopeSummary'])
    );
  });
});

describe('assignee fields', () => {
  it('lets the team lead appoint people for later stages', () => {
    const fields = getStageForm('Assign Team').fields;
    const assignees = fields.filter((f) => f.type === 'assignee');

    expect(assignees.map((f) => f.name)).toEqual(['siteVisitOwner', 'engineer']);
    // The engineer is appointed for a stage further ahead, not the next one.
    expect(assignees.find((f) => f.name === 'engineer')?.targetStage).toBe('Verify Site Information');
    expect(assignees.find((f) => f.name === 'siteVisitOwner')?.targetStage).toBe('Site Visit & Scope Capture');
  });

  it('no longer asks for the server folder, which is the team lead own work', () => {
    expect(getStageForm('Assign Team').fields.map((f) => f.name)).not.toContain('folderPath');
  });
});
