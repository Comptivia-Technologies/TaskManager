import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Modal from '../../components/Modal';

const open = (props: Partial<React.ComponentProps<typeof Modal>> = {}) =>
  render(
    <Modal isOpen title="Edit member" onClose={props.onClose ?? jest.fn()} {...props}>
      <input aria-label="First name" />
      <button type="button">Save</button>
    </Modal>
  );

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal isOpen={false} title="Edit member" onClose={jest.fn()}>
        <p>body</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes itself as a labelled modal dialog', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Edit member');
  });

  it('moves focus to the first field rather than the close button', () => {
    open();
    expect(screen.getByLabelText('First name')).toHaveFocus();
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    open({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes from the close button', () => {
    const onClose = jest.fn();
    open({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps focus on the field being edited when the parent re-renders', () => {
    const { rerender } = render(
      <Modal isOpen title="Edit member" onClose={jest.fn()}>
        <input aria-label="First name" />
        <input aria-label="Last name" />
      </Modal>
    );
    const last = screen.getByLabelText('Last name');
    last.focus();

    rerender(
      <Modal isOpen title="Edit member" onClose={jest.fn()}>
        <input aria-label="First name" />
        <input aria-label="Last name" />
      </Modal>
    );

    expect(screen.getByLabelText('Last name')).toHaveFocus();
  });

  it('Escape uses the latest onClose after a re-render', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(
      <Modal isOpen title="Edit member" onClose={first}>
        <input aria-label="First name" />
      </Modal>
    );
    rerender(
      <Modal isOpen title="Edit member" onClose={second}>
        <input aria-label="First name" />
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('returns focus to whatever opened it', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal isOpen title="Edit member" onClose={jest.fn()}>
        <input aria-label="First name" />
      </Modal>
    );
    rerender(
      <Modal isOpen={false} title="Edit member" onClose={jest.fn()}>
        <input aria-label="First name" />
      </Modal>
    );

    expect(trigger).toHaveFocus();
    document.body.removeChild(trigger);
  });
});
