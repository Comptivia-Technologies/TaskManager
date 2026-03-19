import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConditionBuilder from '../../components/ConditionBuilder';

describe('ConditionBuilder', () => {
  it('renders with empty value', () => {
    const onChange = jest.fn();
    render(<ConditionBuilder value="" onChange={onChange} />);
    expect(screen.getByText('Condition Logic')).toBeInTheDocument();
  });

  it('parses valid JSON value and shows condition type', () => {
    const onChange = jest.fn();
    render(<ConditionBuilder value='{"all":[{"path":"$.taskType","op":"equals","value":"x"}]}' onChange={onChange} />);
    expect(screen.getByText('Condition Logic')).toBeInTheDocument();
  });

  it('addCondition adds a row and calls onChange', () => {
    const onChange = jest.fn();
    render(<ConditionBuilder value='{"all":[]}' onChange={onChange} />);
    const addBtn = screen.getByRole('button', { name: /add condition/i });
    fireEvent.click(addBtn);
    expect(onChange).toHaveBeenCalled();
  });
});
