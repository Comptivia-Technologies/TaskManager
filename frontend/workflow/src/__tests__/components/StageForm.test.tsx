import React from 'react';
import { render, screen } from '@testing-library/react';
import StageForm, { missingRequiredFields } from '../../components/StageForm';
import { StageFormSchema } from '../../types/stageForms';

const schema: StageFormSchema = {
  title: 'Site visit',
  description: 'What was seen on site',
  fields: [
    { name: 'visitDate', label: 'Visit date', type: 'date', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'headcount', label: 'Headcount', type: 'number' },
    { name: 'verified', label: 'Verified', type: 'checkbox', required: true },
    { name: 'access', label: 'Access', type: 'select', options: [{ value: 'open', label: 'Open' }] },
  ],
};

describe('StageForm', () => {
  it('renders every field with its label', () => {
    render(<StageForm schema={schema} values={{}} onChange={jest.fn()} />);
    expect(screen.getByText('Site visit')).toBeInTheDocument();
    expect(screen.getByLabelText(/Visit date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Headcount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Access/)).toBeInTheDocument();
  });

  it('disables inputs when read only', () => {
    render(<StageForm schema={schema} values={{}} onChange={jest.fn()} readOnly />);
    expect(screen.getByLabelText(/Visit date/)).toBeDisabled();
  });
});

describe('missingRequiredFields', () => {
  it('lists required fields that are empty', () => {
    expect(missingRequiredFields(schema, {})).toEqual(['Visit date', 'Verified']);
  });

  it('treats whitespace as empty', () => {
    expect(missingRequiredFields(schema, { visitDate: '   ', verified: true })).toEqual(['Visit date']);
  });

  it('requires a checkbox to be ticked, not merely present', () => {
    expect(missingRequiredFields(schema, { visitDate: '2026-01-01', verified: false })).toEqual(['Verified']);
  });

  it('returns nothing when all required fields are filled', () => {
    expect(missingRequiredFields(schema, { visitDate: '2026-01-01', verified: true })).toEqual([]);
  });

  it('ignores optional fields', () => {
    expect(missingRequiredFields({ title: 't', fields: [{ name: 'a', label: 'A', type: 'text' }] }, {})).toEqual([]);
  });

  it('treats an empty assignee as Auto, which satisfies a required field', () => {
    const assignees: StageFormSchema = {
      title: 'Assign team',
      fields: [
        { name: 'owner', label: 'Site visit owner', type: 'assignee', required: true },
        { name: 'due', label: 'Site visit due', type: 'date', required: true },
      ],
    };
    expect(missingRequiredFields(assignees, {})).toEqual(['Site visit due']);
    expect(missingRequiredFields(assignees, { owner: '', due: '2026-09-09' })).toEqual([]);
  });
});
