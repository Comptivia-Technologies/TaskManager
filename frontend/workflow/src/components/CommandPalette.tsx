import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { FiArrowRight, FiSearch } from 'react-icons/fi';
import type { IconType } from 'react-icons';

/**
 * Command palette — adapted from "Command Palette" by ddoemonn on 21st.dev
 * (https://21st.dev/@ddoemonn/components/command-palette).
 *
 * The fuzzy ranking is kept as published: it scores consecutive matches and word
 * boundaries, which is what makes "veri site" find "Verify Site Information".
 *
 * The presentation is ours. The original ships stone/neutral colours, dark-mode
 * variants and 14px radii; this uses the application's tokens and its deliberate
 * 2–4px radii. It also renders through `m` rather than `motion`, because the app
 * loads Framer Motion in strict LazyMotion mode, and drops the `layout` prop, which
 * would require the heavier `domMax` feature set for a reorder animation the
 * selection crossfade already communicates.
 */

const CROSSFADE = { type: 'spring', stiffness: 260, damping: 34, mass: 0.8 } as const;
const PANEL = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const;
const LAYER_EASE = [0.23, 1, 0.32, 1] as const;
const LAYER_OUT = [0.4, 0, 1, 1] as const;

const BOUNDARY = /[\s\-_/.:]/;
const ROW = 40;
const GAP = 2;
const PAD = 6;

export type CommandItem = {
  id: string;
  label: string;
  /** Shown after the label — the area this command belongs to. */
  hint?: string;
  /** Extra words that should match, never displayed. */
  keywords?: string;
  icon?: IconType;
};

function scoreOne(text: string, query: string): number {
  const t = text.toLowerCase();
  let cursor = 0;
  let total = 0;
  let streak = 0;

  for (let i = 0; i < query.length; i += 1) {
    const at = t.indexOf(query[i], cursor);
    if (at < 0) return -1;
    streak = at === cursor && i > 0 ? streak + 1 : 0;
    total += 2 + streak * 4;
    if (at === 0) total += 12;
    else if (BOUNDARY.test(t[at - 1])) total += 8;
    cursor = at + 1;
  }

  return total;
}

export function rank(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const scored: { item: CommandItem; score: number; order: number }[] = [];

  items.forEach((item, i) => {
    const direct = scoreOne(item.label, q);
    const aliased = item.keywords ? scoreOne(item.keywords, q) - 3 : -1;
    const best = Math.max(direct, aliased);
    if (best < 0) return;
    scored.push({ item, score: best - item.label.length * 0.05, order: i });
  });

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.item);
}

interface CommandPaletteProps {
  open: boolean;
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
  onDismiss: () => void;
  placeholder?: string;
  emptyLabel?: string;
  maxRows?: number;
}

const CommandPalette = ({
  open,
  items,
  onSelect,
  onDismiss,
  placeholder = 'Search screens and actions',
  emptyLabel = 'Nothing matches that',
  maxRows = 7,
}: CommandPaletteProps) => {
  const uid = useId();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const pointer = useRef({ x: -1, y: -1 });
  const [host, setHost] = useState<HTMLElement | null>(null);

  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState<string | null>(null);

  const results = useMemo(() => rank(items, query), [items, query]);
  const activeId = results.some((r) => r.id === pinned) ? pinned : results[0]?.id ?? null;
  const activeIndex = results.findIndex((r) => r.id === activeId);
  const count = results.length;

  useEffect(() => setHost(document.body), []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPinned(null);
    // Focus after the panel exists, or the caret lands nowhere.
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  // Announced on a delay so each keystroke does not interrupt the previous one.
  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => {
      if (!liveRef.current) return;
      liveRef.current.textContent =
        count === 0 ? emptyLabel : `${count} ${count === 1 ? 'result' : 'results'}`;
    }, 400);
    return () => window.clearTimeout(id);
  }, [count, emptyLabel, open]);

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const { overflow, paddingRight } = root.style;
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = 'hidden';
    if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    return () => {
      root.style.overflow = overflow;
      root.style.paddingRight = paddingRight;
    };
  }, [open]);

  const reveal = (index: number) => {
    const list = listRef.current;
    const row = list?.children[index];
    if (!list || !(row instanceof HTMLElement)) return;
    const top = row.offsetTop - PAD;
    const bottom = row.offsetTop + row.offsetHeight + PAD;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  };

  const jump = (index: number) => {
    if (results.length === 0) return;
    const next = Math.max(0, Math.min(results.length - 1, index));
    setPinned(results[next].id);
    reveal(next);
  };

  const move = (delta: number) => {
    if (results.length === 0) return;
    const from = activeIndex < 0 ? 0 : activeIndex;
    jump((from + delta + results.length) % results.length);
  };

  const run = (item?: CommandItem) => {
    const target = item ?? results.find((r) => r.id === activeId);
    if (target) onSelect(target);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => jump(0),
      End: () => jump(results.length - 1),
      Enter: () => run(),
      Escape: onDismiss,
    };
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  // Pointer movement, not entry — otherwise scrolling with the keyboard steals the
  // selection the moment the cursor happens to be over a row.
  const pointerActivate = (id: string, event: React.PointerEvent) => {
    const { x, y } = pointer.current;
    if (event.clientX === x && event.clientY === y) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (id !== activeId) setPinned(id);
  };

  if (!host) return null;

  const rows = Math.max(1, Math.min(maxRows, Math.max(items.length, 1)));
  const height = PAD * 2 + rows * ROW + (rows - 1) * GAP;

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          key="palette-layer"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          initial="closed"
          animate="open"
          exit="gone"
          variants={{ closed: {}, open: {}, gone: {} }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onDismiss();
          }}
        >
          <m.div
            aria-hidden="true"
            className="absolute inset-0 bg-[#0B0E1C]/50 backdrop-blur-[2px]"
            variants={{
              closed: { opacity: 0 },
              open: { opacity: 1, transition: reduced ? { duration: 0 } : { duration: 0.2, ease: LAYER_EASE } },
              gone: { opacity: 0, transition: reduced ? { duration: 0 } : { duration: 0.15, ease: LAYER_OUT } },
            }}
          />

          <m.div
            className="relative flex w-full justify-center"
            variants={{
              closed: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 },
              open: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: reduced ? { duration: 0 } : { ...PANEL, opacity: { duration: 0.16, ease: LAYER_EASE } },
              },
              gone: reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.15, ease: LAYER_OUT } },
            }}
          >
            <div className="w-full max-w-[560px] overflow-hidden rounded-dialog bg-surface shadow-azure-xl ring-1 ring-black/5">
              <div className="flex h-14 items-center gap-3 border-b border-line px-4">
                <FiSearch className="shrink-0 text-ink-subtle" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-label="Search screens and actions"
                  aria-expanded="true"
                  aria-controls={`${uid}-list`}
                  aria-autocomplete="list"
                  aria-activedescendant={activeId ? `${uid}-${activeId}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  placeholder={placeholder}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="h-full min-w-0 flex-1 bg-transparent text-title text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-none"
                />
                <span className="min-w-[3ch] shrink-0 text-right font-mono text-meta tabular-nums text-ink-subtle">
                  {count}
                </span>
              </div>

              <div className="relative" style={{ height }}>
                <ul
                  ref={listRef}
                  id={`${uid}-list`}
                  role="listbox"
                  aria-label="Results"
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute inset-0 flex flex-col gap-[2px] overflow-y-auto overscroll-contain p-1.5 scrollbar-thin"
                >
                  {results.map((item) => {
                    const active = item.id === activeId;
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.id}
                        id={`${uid}-${item.id}`}
                        role="option"
                        aria-selected={active}
                        onPointerMove={(e) => pointerActivate(item.id, e)}
                        onClick={() => run(item)}
                        className="relative flex h-10 shrink-0 cursor-pointer items-center rounded-control px-2.5"
                      >
                        <m.span
                          aria-hidden="true"
                          initial={false}
                          animate={{ opacity: active ? 1 : 0 }}
                          transition={reduced ? { duration: 0 } : CROSSFADE}
                          className="absolute inset-0 rounded-control bg-primary-subtle"
                        />
                        <span className="relative flex min-w-0 flex-1 items-center gap-3">
                          {Icon && (
                            <Icon aria-hidden="true" className={`shrink-0 text-[16px] ${active ? 'text-primary' : 'text-ink-subtle'}`} />
                          )}
                          <span className="truncate text-body font-medium text-ink">{item.label}</span>
                          {item.hint && (
                            <span className="ml-auto hidden shrink-0 text-meta text-ink-subtle sm:inline">
                              {item.hint}
                            </span>
                          )}
                          <FiArrowRight
                            aria-hidden="true"
                            className={`shrink-0 text-ink-subtle transition-opacity ${active ? 'opacity-100' : 'opacity-0'} ${item.hint ? '' : 'ml-auto'}`}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {count === 0 && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-body text-ink-muted">
                    {emptyLabel}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 border-t border-line bg-surface-muted px-4 py-2.5 text-meta text-ink-subtle">
                {[['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].map(([key, action]) => (
                  <span key={action} className="inline-flex items-center gap-1.5">
                    <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface border border-line text-ink-muted">{key}</kbd>
                    {action}
                  </span>
                ))}
              </div>
            </div>
          </m.div>

          <span ref={liveRef} role="status" aria-live="polite" className="sr-only" />
        </m.div>
      )}
    </AnimatePresence>,
    host
  );
};

export default CommandPalette;
