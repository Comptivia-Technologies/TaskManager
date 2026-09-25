/**
 * Converts UTC date string to browser's local timezone
 */
export const formatDateToIST = (dateString?: string | null): string => {
  if (!dateString) return 'N/A';
  
  // Ensure date is parsed as UTC if it doesn't have timezone info
  let date: Date;
  if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-', 10)) {
    // Already has timezone info
    date = new Date(dateString);
  } else {
    // Assume UTC if no timezone specified
    date = new Date(dateString + 'Z');
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateString);
    return 'Invalid Date';
  }
  
  // Convert to browser's local timezone
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats date to browser's local timezone date only (without time)
 */
export const formatDateOnlyIST = (dateString?: string | null): string => {
  if (!dateString) return 'N/A';
  
  // Ensure date is parsed as UTC if it doesn't have timezone info
  let date: Date;
  if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-', 10)) {
    date = new Date(dateString);
  } else {
    date = new Date(dateString + 'Z');
  }
  
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateString);
    return 'Invalid Date';
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/** Parses an API timestamp, treating one without a zone as UTC. */
export const parseApiDate = (dateString?: string | null): Date | null => {
  if (!dateString) return null;
  const hasZone = dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-', 10);
  const date = new Date(hasZone ? dateString : `${dateString}Z`);
  return isNaN(date.getTime()) ? null : date;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * A due date the way a person reads it — "Due in 3 days", "Overdue by 2 days" —
 * with a tone so the queue can flag what is late or close.
 */
export const relativeDue = (
  dateString?: string | null,
  now: Date = new Date()
): { label: string; tone: 'danger' | 'warning' | 'neutral' } | null => {
  const due = parseApiDate(dateString);
  if (!due) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(now)) / DAY);
  if (due.getTime() < now.getTime() && days <= 0) {
    if (days === 0) return { label: 'Overdue today', tone: 'danger' };
    return { label: `Overdue by ${-days} day${days === -1 ? '' : 's'}`, tone: 'danger' };
  }
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'warning' };
  return { label: `Due in ${days} days`, tone: 'neutral' };
};

/** "just now", "5m ago", "3h ago", "2d ago", then the date. For activity feeds. */
export const timeAgo = (dateString?: string | null, now: Date = new Date()): string => {
  const date = parseApiDate(dateString);
  if (!date) return '';
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateOnlyIST(dateString);
};

/**
 * Converts UTC date to browser's local Date object for comparisons
 */
export const getISTDate = (dateString?: string | null): Date | null => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  // Date object automatically uses browser's local timezone
  return date;
};
