import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Button from '../../components/Button';

describe('Button', () => {
  it('defaults to type=button so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('blocks clicks and reports busy while loading', () => {
    const onClick = jest.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the icon out of the accessible name', () => {
    render(<Button icon={<span>★</span>}>New Enquiry</Button>);
    expect(screen.getByRole('button', { name: 'New Enquiry' })).toBeInTheDocument();
  });
});
