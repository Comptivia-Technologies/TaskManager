import React from 'react';
import { render, screen } from '@testing-library/react';
import Modal from '../../components/Modal';
import { dialogVariants, sheetVariants, listItem, MAX_STAGGER_ROWS } from '../../utils/motion';

/** Makes matchMedia answer true for one query, false for everything else. */
const matchOnly = (matching: string) => {
  (window as any).matchMedia = (query: string) => ({
    matches: query === matching,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
};

const original = window.matchMedia;
afterEach(() => {
  (window as any).matchMedia = original;
});

describe('motion vocabulary', () => {
  it('exits faster than it enters, so dismissal never feels sluggish', () => {
    const enter: any = (dialogVariants.animate as any).transition;
    const exit: any = (dialogVariants.exit as any).transition;
    expect(exit.duration).toBeLessThan(enter.duration);
  });

  it('caps the row stagger so a long list is not a long wait', () => {
    expect(MAX_STAGGER_ROWS).toBeLessThanOrEqual(15);
    expect(listItem.initial).toEqual({ opacity: 0, y: 4 });
  });

  it('moves the dialog only a few pixels — this is a tool, not a showreel', () => {
    expect((dialogVariants.initial as any).y).toBeLessThanOrEqual(12);
    // The sheet is the exception: it genuinely travels in from the bottom edge.
    expect((sheetVariants.initial as any).y).toBe('100%');
  });
});

describe('Modal presentation', () => {
  it('still renders and traps focus when the viewer prefers reduced motion', () => {
    matchOnly('(prefers-reduced-motion: reduce)');
    render(
      <Modal isOpen title="Edit member" onClose={jest.fn()}>
        <input aria-label="First name" />
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveFocus();
  });

  it('survives an environment with no matchMedia at all', () => {
    delete (window as any).matchMedia;
    expect(() =>
      render(
        <Modal isOpen title="Edit member" onClose={jest.fn()}>
          <p>body</p>
        </Modal>
      )
    ).not.toThrow();
  });
});
