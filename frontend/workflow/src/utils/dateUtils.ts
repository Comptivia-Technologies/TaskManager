/**
 * Converts UTC date string to IST (Indian Standard Time)
 * IST is UTC+5:30
 */
export const formatDateToIST = (dateString?: string | null): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  
  // Convert to IST using Asia/Kolkata timezone
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formats date to IST date only (without time)
 */
export const formatDateOnlyIST = (dateString?: string | null): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Converts UTC date to IST Date object for comparisons
 */
export const getISTDate = (dateString?: string | null): Date | null => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  // Create a new date in IST by formatting and parsing
  const istString = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(istString);
};
