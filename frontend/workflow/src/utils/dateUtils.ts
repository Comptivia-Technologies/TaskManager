/**
 * Converts UTC date string to browser's local timezone
 */
export const formatDateToIST = (dateString?: string | null): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  
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
  
  const date = new Date(dateString);
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
