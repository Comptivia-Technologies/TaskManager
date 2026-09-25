import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingSpinner, { FlowLoader } from '../../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('announces what is loading', () => {
    render(<LoadingSpinner label="Loading enquiry" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading enquiry');
  });

  it('draws the five-stage flow rail', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelectorAll('.flow-loader-node')).toHaveLength(5);
    expect(container.querySelector('.flow-loader-pulse')).toBeInTheDocument();
  });

  it('can fill the screen before the shell exists', () => {
    render(<FlowLoader fullScreen label="Signing you in" />);
    expect(screen.getByRole('status')).toHaveClass('min-h-screen');
  });
});
