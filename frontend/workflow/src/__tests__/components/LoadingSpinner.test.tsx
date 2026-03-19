import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    render(<LoadingSpinner />);
    const container = document.querySelector('.flex.justify-center');
    expect(container).toBeInTheDocument();
  });

  it('contains spinner elements', () => {
    const { container } = render(<LoadingSpinner />);
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });
});
