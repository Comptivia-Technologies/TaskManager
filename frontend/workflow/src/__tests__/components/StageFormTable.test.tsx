import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StageForm, { missingRequiredFields, prefillTables, rowsOf } from '../../components/StageForm';
import { StageFormSchema } from '../../types/stageForms';

const pricing: StageFormSchema = {
  title: 'Supplier pricing',
  fields: [
    {
      name: 'pricedItems',
      label: 'Supplier pricing',
      type: 'table',
      required: true,
      addLabel: 'Add item',
      prefillFrom: {
        stage: 'Verify Site Information',
        field: 'materials',
        columns: ['item', 'quantity'],
      },
      columns: [
        { name: 'item', label: 'Item', type: 'text' },
        { name: 'quantity', label: 'Qty', type: 'number' },
        { name: 'unitPrice', label: 'Unit price', type: 'number' },
      ],
    },
  ],
};

describe('table fields', () => {
  it('starts empty and adds a row on demand', () => {
    const onChange = jest.fn();
    render(<StageForm schema={pricing} values={{}} onChange={onChange} />);

    expect(screen.getByText('Nothing added yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(onChange).toHaveBeenCalledWith({
      pricedItems: [{ item: '', quantity: '', unitPrice: '' }],
    });
  });

  it('edits a cell without disturbing the other rows', () => {
    const onChange = jest.fn();
    const values = { pricedItems: [{ item: 'Cable', quantity: 2 }, { item: 'Tray', quantity: 5 }] };
    render(<StageForm schema={pricing} values={values} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Unit price 2'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({
      pricedItems: [
        { item: 'Cable', quantity: 2 },
        { item: 'Tray', quantity: 5, unitPrice: 40 },
      ],
    });
  });

  it('removes a row', () => {
    const onChange = jest.fn();
    const values = { pricedItems: [{ item: 'Cable' }, { item: 'Tray' }] };
    render(<StageForm schema={pricing} values={values} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));

    expect(onChange).toHaveBeenCalledWith({ pricedItems: [{ item: 'Tray' }] });
  });

  it('counts an empty required table as missing', () => {
    expect(missingRequiredFields(pricing, {})).toEqual(['Supplier pricing']);
    expect(missingRequiredFields(pricing, { pricedItems: [] })).toEqual(['Supplier pricing']);
    expect(missingRequiredFields(pricing, { pricedItems: [{ item: 'Cable' }] })).toEqual([]);
  });
});

describe('prefillTables', () => {
  const earlier = {
    'verify site information': {
      materials: [
        { item: 'Cable', unit: 'm', quantity: 100 },
        { item: 'Tray', unit: 'no', quantity: 12 },
      ],
    },
  };

  it('carries the named columns across and leaves the rest blank', () => {
    const filled = prefillTables(pricing, {}, earlier);
    expect(rowsOf(filled.pricedItems)).toEqual([
      { item: 'Cable', quantity: 100, unitPrice: '' },
      { item: 'Tray', quantity: 12, unitPrice: '' },
    ]);
  });

  it('leaves a table that already has rows alone', () => {
    const existing = { pricedItems: [{ item: 'Priced already', quantity: 1, unitPrice: 9 }] };
    expect(prefillTables(pricing, existing, earlier)).toEqual(existing);
  });

  it('does nothing when the earlier stage submitted no rows', () => {
    expect(prefillTables(pricing, {}, {})).toEqual({});
  });
});
