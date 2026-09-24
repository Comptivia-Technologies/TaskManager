import type { BadgeTone } from '../components/Badge';

// Status and priority colouring was re-implemented on four screens, and had
// drifted: "Medium" was amber on one and blue on another. This is the one mapping.

export const isCompletedStatus = (status: string) => /completed|done/i.test(status);

/** "InProgress" → "In progress". The API sends enum names; people read sentences. */
export const humanizeStatus = (status: string) =>
  status
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

export const statusTone = (status: string, isOverdue?: boolean): BadgeTone => {
  if (isOverdue) return 'danger';
  const s = status.toLowerCase();
  if (isCompletedStatus(s)) return 'success';
  if (s.includes('escalat')) return 'danger';
  if (s.includes('progress') || s.includes('active')) return 'info';
  if (s.includes('assigned') || s.includes('pending')) return 'primary';
  return 'neutral';
};

/** Priority runs one hue family, hottest first, so it scans as a scale. */
export const priorityTone = (priority: string): BadgeTone => {
  const p = priority.toLowerCase();
  if (p.includes('critical')) return 'danger';
  if (p.includes('high')) return 'warning';
  if (p.includes('medium')) return 'info';
  if (p.includes('low')) return 'neutral';
  return 'neutral';
};

/** Sort key for priority, hottest first. Unknown priorities sort last. */
export const priorityRank = (priority: string) => {
  const p = priority.toLowerCase();
  if (p.includes('very critical')) return 0;
  if (p.includes('critical')) return 1;
  if (p.includes('high')) return 2;
  if (p.includes('medium')) return 3;
  if (p.includes('low')) return 4;
  return 5;
};
