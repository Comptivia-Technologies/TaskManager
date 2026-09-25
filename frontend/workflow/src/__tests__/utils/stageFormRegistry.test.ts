import {
  getStageForm,
  hasStageForm,
  isAppointedStage,
  stageFieldLabels,
} from '../../utils/stageFormRegistry';

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

describe('line-item stages', () => {
  const tableField = (stageName: string, fieldName: string) =>
    getStageForm(stageName).fields.find((f) => f.name === fieldName);

  it('lets the engineer list what procurement must price', () => {
    const materials = tableField('Verify Site Information', 'materials');
    expect(materials?.type).toBe('table');
    expect(materials?.required).toBe(true);
    expect(materials?.columns?.map((c) => c.name)).toEqual(['item', 'specification', 'unit', 'quantity']);
  });

  it('carries those items into supplier pricing so they are not retyped', () => {
    const priced = tableField('Obtain Supplier Prices', 'pricedItems');
    expect(priced?.prefillFrom).toEqual({
      stage: 'Verify Site Information',
      field: 'materials',
      columns: ['item', 'specification', 'unit', 'quantity'],
    });
    expect(priced?.columns?.map((c) => c.name)).toEqual(
      expect.arrayContaining(['supplier', 'unitPrice', 'leadTime'])
    );
  });

  it('builds the BOQ from the supplier pricing', () => {
    const boq = tableField('Prepare & Check BOQ', 'boqLines');
    expect(boq?.type).toBe('table');
    expect(boq?.prefillFrom?.stage).toBe('Obtain Supplier Prices');
    expect(boq?.prefillFrom?.field).toBe('pricedItems');
  });
});

describe('review stages', () => {
  it.each(['Manager Approval', 'Senior Management Approval'])(
    '%s only decides and notes, it does not restate the figures',
    (stageName) => {
      expect(getStageForm(stageName).fields.map((f) => f.name)).toEqual(['decision', 'reviewNotes']);
    }
  );
});

describe('isAppointedStage', () => {
  it('is true for stages the team lead appoints someone to', () => {
    expect(isAppointedStage('Verify Site Information')).toBe(true);
    expect(isAppointedStage('site visit & scope capture')).toBe(true);
  });

  it('is false for stages nobody was appointed to, and for nothing', () => {
    expect(isAppointedStage('Manager Approval')).toBe(false);
    expect(isAppointedStage(undefined)).toBe(false);
  });
});

describe('stageFieldLabels', () => {
  it('labels both fields and table columns', () => {
    const labels = stageFieldLabels('Obtain Supplier Prices');
    expect(labels.recommendedSupplier).toBe('Recommended supplier / basis');
    expect(labels.unitPrice).toBe('Unit price');
  });
});
