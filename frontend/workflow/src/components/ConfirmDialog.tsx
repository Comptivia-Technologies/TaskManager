import { ReactNode } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import Modal from './Modal';
import Button from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body: ReactNode;
  /** Verb for the confirming button, e.g. "Delete team". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  /** Destructive actions get the red button and warning mark. */
  destructive?: boolean;
  icon?: ReactNode;
}

/**
 * The one confirmation dialog. Every screen had hand-built its own delete prompt
 * without focus handling or Escape; this is the Modal with a fixed shape: what
 * will happen, then Cancel and the named action.
 */
const ConfirmDialog = ({
  isOpen,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  destructive = true,
  icon,
}: ConfirmDialogProps) => (
  <Modal
    isOpen={isOpen}
    title={title}
    onClose={busy ? () => {} : onCancel}
    size="sm"
    tone={destructive ? 'danger' : 'primary'}
    icon={icon ?? (destructive ? <FiAlertTriangle /> : undefined)}
    footer={
      <>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-body text-ink-muted">{body}</div>
  </Modal>
);

export default ConfirmDialog;
