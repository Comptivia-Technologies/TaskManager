import type { Transition, Variants } from 'framer-motion';

/**
 * Motion vocabulary for the application.
 *
 * This is an internal tool people work in all day, so the guidance here is
 * restraint: one or two moving elements per view, motion that explains where
 * something came from, and exits faster than entrances. Durations match the
 * design system — 150ms for state, 200ms for panels, 250ms for dialogs.
 *
 * Every consumer pairs these with `useReducedMotion`; `instant` is the substitute
 * when a viewer has asked for less movement.
 */

export const DURATION = {
  state: 0.15,
  panel: 0.2,
  dialog: 0.25,
  exit: 0.15,
} as const;

/** Decelerating curve, matching the CSS `cubic-bezier(0.4, 0, 0.2, 1)`. */
export const EASE = [0.4, 0, 0.2, 1] as const;

export const instant: Transition = { duration: 0 };

export const panelTransition: Transition = { duration: DURATION.panel, ease: EASE };

/** Page-to-page. Deliberately small: a big slide on every navigation gets tiring. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

// Exits carry their own, shorter transition: leaving slowly reads as unresponsive.
const enterTransition: Transition = { duration: DURATION.dialog, ease: EASE };
const exitTransition: Transition = { duration: DURATION.exit, ease: EASE };

/** Dialogs rise slightly as they fade in, so they read as arriving above the page. */
export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: enterTransition },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: exitTransition },
};

/** On a phone the same dialog is a sheet, so it comes from the edge it sits on. */
export const sheetVariants: Variants = {
  initial: { opacity: 0, y: '100%' },
  animate: { opacity: 1, y: 0, transition: enterTransition },
  exit: { opacity: 0, y: '100%', transition: exitTransition },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: enterTransition },
  exit: { opacity: 0, transition: exitTransition },
};

/** The navigation drawer slides from the edge it is anchored to. */
export const drawerVariants: Variants = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
};

/**
 * Rows fade in with a small stagger the first time a list resolves. Capped, because
 * a hundred-row stagger is a hundred-row wait.
 */
export const listContainer: Variants = {
  animate: { transition: { staggerChildren: 0.02, delayChildren: 0.02 } },
};

export const listItem: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
};

/** How many rows are worth staggering before it becomes a delay. */
export const MAX_STAGGER_ROWS = 12;
