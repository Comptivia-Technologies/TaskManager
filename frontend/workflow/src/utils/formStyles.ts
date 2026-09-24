// Field styling lived as a copy-pasted class string in fourteen files, which had
// drifted into ten near-identical variants. These are the canonical forms;
// per-field extras (resize-none, disabled:*) are appended at the call site with a
// template literal.

export const inputClass =
  'w-full min-h-[40px] px-3 py-2 border border-line-strong rounded-control bg-surface text-ink text-body font-sans ' +
  'hover:border-[#A9B0C4] focus:outline-none focus:border-primary focus:shadow-focus ' +
  'disabled:bg-surface-muted disabled:text-ink-muted disabled:cursor-not-allowed';

/** A value shown for context but not editable here. */
export const readOnlyInputClass =
  'w-full min-h-[40px] px-3 py-2 border border-line rounded-control bg-surface-muted text-ink-muted text-body ' +
  'font-sans cursor-not-allowed';

/** Field label. Paired with `inputClass` everywhere a form asks for something. */
export const labelClass = 'block text-body font-medium text-ink mb-1.5';

/** Helper line under a field. */
export const helpClass = 'mt-1.5 text-meta text-ink-subtle';
