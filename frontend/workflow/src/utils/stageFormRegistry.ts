import { StageFormSchema } from '../types/stageForms';

// Stage ids are generated per workflow, so schemas are keyed by stage name until
// they are stored against the stage itself. Everything here is plain data, so
// moving it into the workflow definition later is a change of source, not shape.
const normalise = (stageName: string) => stageName.trim().toLowerCase();

const FALLBACK: StageFormSchema = {
  title: 'Stage notes',
  description: 'Record what was done at this stage before moving it on.',
  fields: [
    { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'What was done at this stage?' },
  ],
};

const SCHEMAS: Record<string, StageFormSchema> = {
  'receive & register enquiry': {
    title: 'Receive & register enquiry',
    description: 'Record the enquiry as received from the client.',
    fields: [
      { name: 'enquiryNumber', label: 'Enquiry number', type: 'text', required: true, placeholder: 'ENQ-0000' },
      { name: 'client', label: 'Client', type: 'text', required: true },
      { name: 'project', label: 'Project', type: 'text', required: true },
      { name: 'contact', label: 'Client contact', type: 'text' },
      { name: 'receivedOn', label: 'Received on', type: 'date', required: true },
      { name: 'requestedSubmission', label: 'Requested submission date', type: 'date' },
      { name: 'scopeSummary', label: 'Scope summary', type: 'textarea', required: true },
    ],
  },
  'assign team': {
    title: 'Assign team',
    description: 'Appoint the owners and confirm the dates.',
    fields: [
      { name: 'siteVisitOwner', label: 'Site visit owner', type: 'assignee', required: true, targetStage: 'Site Visit & Scope Capture' },
      { name: 'engineer', label: 'Engineer / estimator', type: 'assignee', required: true, targetStage: 'Verify Site Information' },
      { name: 'siteVisitDue', label: 'Site visit due', type: 'date', required: true },
      { name: 'quotationDue', label: 'Quotation due', type: 'date', required: true },
    ],
  },
  'site visit & scope capture': {
    title: 'Site visit & scope',
    description: 'Record what was measured and observed on site.',
    fields: [
      { name: 'visitDate', label: 'Visit date', type: 'date', required: true },
      { name: 'attendedBy', label: 'Attended by', type: 'text', required: true },
      { name: 'measurements', label: 'Measurements & quantity take-off', type: 'textarea', required: true },
      { name: 'existingConditions', label: 'Existing conditions', type: 'textarea' },
      { name: 'accessRestrictions', label: 'Access & working-hour restrictions', type: 'textarea' },
      { name: 'permitsSafety', label: 'Permits & safety constraints', type: 'textarea' },
      { name: 'openQuestions', label: 'Open questions', type: 'textarea' },
    ],
  },
  'verify site information': {
    title: 'Verify site information',
    description: 'Check the site record against the enquiry, then list what procurement must price.',
    fields: [
      { name: 'quantitiesVerified', label: 'Quantities verified against the enquiry', type: 'checkbox', required: true },
      { name: 'gapsResolved', label: 'Gaps resolved with client or site team', type: 'textarea' },
      { name: 'assumptions', label: 'Assumptions', type: 'textarea', required: true },
      { name: 'exclusions', label: 'Proposed exclusions', type: 'textarea', required: true },
      {
        name: 'materials',
        label: 'Items to be priced',
        type: 'table',
        required: true,
        addLabel: 'Add item',
        help: 'Procurement prices exactly these items, so list every product the quotation needs.',
        columns: [
          { name: 'item', label: 'Item / product', type: 'text', width: 'wide' },
          { name: 'specification', label: 'Specification', type: 'text', width: 'wide' },
          { name: 'unit', label: 'Unit', type: 'text', width: 'narrow' },
          { name: 'quantity', label: 'Qty', type: 'number', width: 'narrow' },
        ],
      },
    ],
  },
  'obtain supplier prices': {
    title: 'Obtain supplier prices',
    description: 'Price each item the engineer listed, then recommend the basis.',
    fields: [
      {
        name: 'pricedItems',
        label: 'Supplier pricing',
        type: 'table',
        required: true,
        addLabel: 'Add item',
        help: 'Carried over from the engineer. Add a row for anything extra that must be priced.',
        prefillFrom: {
          stage: 'Verify Site Information',
          field: 'materials',
          columns: ['item', 'specification', 'unit', 'quantity'],
        },
        columns: [
          { name: 'item', label: 'Item / product', type: 'text', width: 'wide' },
          { name: 'specification', label: 'Specification', type: 'text', width: 'wide' },
          { name: 'unit', label: 'Unit', type: 'text', width: 'narrow' },
          { name: 'quantity', label: 'Qty', type: 'number', width: 'narrow' },
          { name: 'supplier', label: 'Supplier', type: 'text' },
          { name: 'unitPrice', label: 'Unit price', type: 'number', width: 'narrow' },
          { name: 'leadTime', label: 'Lead time', type: 'text', width: 'narrow' },
        ],
      },
      { name: 'quotesRequested', label: 'Quotations requested', type: 'number', required: true },
      { name: 'quotesReceived', label: 'Quotations received', type: 'number', required: true },
      { name: 'shortfallReason', label: 'Reason if fewer than three', type: 'textarea', help: 'Required when fewer than three comparable quotations were obtained.' },
      { name: 'comparison', label: 'Comparison (price, scope, lead time, validity, warranty)', type: 'textarea', required: true },
      { name: 'recommendedSupplier', label: 'Recommended supplier / basis', type: 'text', required: true },
    ],
  },
  'prepare & check boq': {
    title: 'Prepare & check BOQ',
    description: 'Build the bill of quantities from the supplier pricing, then apply the margin.',
    fields: [
      {
        name: 'boqLines',
        label: 'Bill of quantities',
        type: 'table',
        required: true,
        addLabel: 'Add BOQ line',
        help: 'Started from the supplier pricing. Add, edit or remove lines as the BOQ requires.',
        prefillFrom: {
          stage: 'Obtain Supplier Prices',
          field: 'pricedItems',
          columns: ['item', 'specification', 'unit', 'quantity', 'unitPrice'],
        },
        columns: [
          { name: 'item', label: 'Description', type: 'text', width: 'wide' },
          { name: 'specification', label: 'Specification', type: 'text', width: 'wide' },
          { name: 'unit', label: 'Unit', type: 'text', width: 'narrow' },
          { name: 'quantity', label: 'Qty', type: 'number', width: 'narrow' },
          { name: 'unitPrice', label: 'Rate', type: 'number', width: 'narrow' },
          { name: 'amount', label: 'Amount', type: 'number', width: 'narrow' },
        ],
      },
      { name: 'boqReference', label: 'BOQ reference', type: 'text', required: true },
      { name: 'materialCost', label: 'Material cost', type: 'number', required: true },
      { name: 'labourCost', label: 'Labour & equipment cost', type: 'number', required: true },
      { name: 'overheads', label: 'Overheads', type: 'number' },
      { name: 'profitPercent', label: 'Profit %', type: 'number', required: true },
      { name: 'sellingPrice', label: 'Selling price', type: 'number', required: true },
      { name: 'validityDays', label: 'Validity (days)', type: 'number' },
      { name: 'arithmeticChecked', label: 'Arithmetic and scope completeness checked', type: 'checkbox', required: true },
    ],
  },
  'manager approval': {
    title: 'Manager approval',
    description: 'Review the BOQ as submitted. Approve it, or send it back with a note saying what to change.',
    fields: [
      { name: 'decision', label: 'Decision', type: 'select', required: true, options: [{ value: 'approved', label: 'Approved to draft quotation' }] },
      { name: 'reviewNotes', label: 'Notes', type: 'textarea', help: 'Anything the team should know. To ask for changes, use Send Back instead.' },
    ],
  },
  'draft quotation': {
    title: 'Draft quotation',
    description: 'Prepare the client quotation from the approved BOQ.',
    fields: [
      { name: 'quotationNumber', label: 'Quotation number', type: 'text', required: true },
      { name: 'revision', label: 'Revision', type: 'text', required: true, placeholder: 'R0' },
      { name: 'quotedAmount', label: 'Quoted amount', type: 'number', required: true },
      { name: 'validity', label: 'Validity', type: 'text' },
      { name: 'exclusions', label: 'Exclusions stated', type: 'textarea', required: true },
      { name: 'templateUsed', label: 'Current company template used', type: 'checkbox', required: true },
    ],
  },
  'engineer verification': {
    title: 'Engineer verification',
    description: 'Confirm the draft matches the approved costing.',
    fields: [
      { name: 'matchesCosting', label: 'Scope, quantities and price match the approved costing', type: 'checkbox', required: true },
      { name: 'termsChecked', label: 'Schedule, validity and terms checked', type: 'checkbox', required: true },
      { name: 'discrepancies', label: 'Discrepancies found', type: 'textarea' },
    ],
  },
  'senior management approval': {
    title: 'Senior management approval',
    description: 'Review the quotation as drafted. Approve it for issue, or send it back with a note.',
    fields: [
      { name: 'decision', label: 'Decision', type: 'select', required: true, options: [{ value: 'approved', label: 'Approved for issue' }] },
      { name: 'reviewNotes', label: 'Notes', type: 'textarea', help: 'Anything the team should know. To ask for changes, use Send Back instead.' },
    ],
  },
  'issue to client & close': {
    title: 'Issue to client & close',
    description: 'Record the issue against the enquiry.',
    fields: [
      { name: 'issuedOn', label: 'Issue date', type: 'date', required: true },
      { name: 'recipient', label: 'Sent to', type: 'text', required: true },
      { name: 'quotationNumber', label: 'Quotation number', type: 'text', required: true },
      { name: 'revision', label: 'Revision', type: 'text', required: true },
      { name: 'sentEmailSaved', label: 'Sent email saved to the enquiry folder', type: 'checkbox', required: true },
      { name: 'outcome', label: 'Outcome', type: 'select', options: [
        { value: 'issued', label: 'Issued' },
        { value: 'won', label: 'Won' },
        { value: 'lost', label: 'Lost' },
      ] },
    ],
  },
};

export const getStageForm = (stageName?: string): StageFormSchema =>
  (stageName ? SCHEMAS[normalise(stageName)] : undefined) ?? FALLBACK;

export const hasStageForm = (stageName?: string): boolean =>
  Boolean(stageName && SCHEMAS[normalise(stageName)]);

// Stages whose owner is appointed earlier by someone else — the team lead naming
// the engineer, for example. Nobody downstream gets to pick for these.
const APPOINTED_STAGES = new Set(
  Object.values(SCHEMAS)
    .flatMap((schema) => schema.fields)
    .filter((field) => field.type === 'assignee' && field.targetStage)
    .map((field) => normalise(field.targetStage!))
);

export const isAppointedStage = (stageName?: string): boolean =>
  Boolean(stageName && APPOINTED_STAGES.has(normalise(stageName)));

/** Field name to its label, for reading back what an earlier stage submitted. */
export const stageFieldLabels = (stageName?: string): Record<string, string> =>
  getStageForm(stageName).fields.reduce<Record<string, string>>(
    (labels, field) => ({
      ...labels,
      [field.name]: field.label,
      ...(field.columns ?? []).reduce<Record<string, string>>(
        (cols, column) => ({ ...cols, [column.name]: column.label }),
        {}
      ),
    }),
    {}
  );
