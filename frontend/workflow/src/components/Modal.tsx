import { ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { backdropVariants, dialogVariants, instant, sheetVariants } from '../utils/motion';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** Wider than the default for forms that need two columns. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Describes the dialog beneath the title, and is referenced by aria-describedby. */
  description?: string;
  /** Actions pinned to the bottom edge, so they stay reachable in a long form. */
  footer?: ReactNode;
  /** Decorative mark shown beside the title. */
  icon?: ReactNode;
  /** Colours the icon tile — danger for destructive confirmations. */
  tone?: 'primary' | 'danger';
}

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SHEET_QUERY = '(max-width: 639px)';

/**
 * Tracks whether the dialog is presented as a centred panel or a bottom sheet.
 * matchMedia is absent in some environments, so its absence resolves to the desktop
 * presentation rather than throwing.
 */
const useIsSmallScreen = () => {
  const [small, setSmall] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia(SHEET_QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const query = window.matchMedia(SHEET_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSmall(e.matches);
    setSmall(query.matches);

    // addListener is the deprecated form, still needed by older Safari.
    if (query.addEventListener) {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return small;
};

/**
 * The dialog shell four screens had each written out by hand.
 *
 * Beyond the markup it handles what none of them did: focus moves into the dialog on
 * open and returns to whatever opened it on close, Tab is trapped inside, Escape
 * closes, and the page behind cannot be scrolled.
 *
 * It arrives as a centred panel on a desktop and as a sheet from the bottom edge on a
 * phone, because on a phone that is the edge it is anchored to.
 */
const Modal = ({ isOpen, title, children, onClose, size = 'md', description, footer, icon, tone = 'primary' }: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduceMotion = useReducedMotion();
  const isSheet = useIsSmallScreen();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap at both ends so focus cannot escape into the page behind.
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  // Runs only when the dialog opens or closes. A new onClose from the parent
  // must not repeat this, or every keystroke pulls focus back to the first field.
  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // The first field is more useful than the close button, so focus lands there
    // when there is one.
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const target = Array.from(focusable ?? []).find(
      (el) => !el.hasAttribute('data-modal-close')
    );
    (target ?? panelRef.current)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  // Variants carry their own enter/exit timings; this only overrides them to nothing
  // when the viewer has asked for reduced motion.
  const override = reduceMotion ? instant : undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <m.div
            key="backdrop"
            variants={backdropVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={override}
            onMouseDown={onClose}
            className="absolute inset-0 bg-[#0B0E1C]/50 backdrop-blur-[2px]"
          />

          <m.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby={description ? 'modal-description' : undefined}
            tabIndex={-1}
            variants={isSheet ? sheetVariants : dialogVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={override}
            className={`relative bg-surface w-full rounded-t-dialog sm:rounded-dialog shadow-azure-xl
              outline-none max-h-[92vh] flex flex-col ${WIDTHS[size]}`}
          >
            <div className="flex justify-between items-start gap-4 px-6 pt-5 pb-4 border-b border-line-subtle">
              <div className="flex items-start gap-3 min-w-0">
                {icon && (
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 h-9 w-9 shrink-0 rounded-control flex items-center justify-center text-[17px] ${
                      tone === 'danger' ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'
                    }`}
                  >
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 id="modal-title" className="text-title font-semibold text-ink">
                    {title}
                  </h2>
                  {description && (
                    <p id="modal-description" className="mt-0.5 text-body text-ink-muted">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                data-modal-close
                aria-label="Close dialog"
                onClick={onClose}
                className="shrink-0 -mr-2 -mt-1 h-9 w-9 inline-flex items-center justify-center
                  text-ink-subtle hover:text-ink hover:bg-surface-sunken rounded-control cursor-pointer"
              >
                <FiX className="text-lg" aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto scrollbar-thin">{children}</div>
            {footer && (
              <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-line-subtle bg-surface-muted rounded-b-dialog">
                {footer}
              </div>
            )}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
