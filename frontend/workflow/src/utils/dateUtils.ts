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

/**
 * Converts UTC date to browser's local Date object for comparisons
 */
export const getISTDate = (dateString?: string | null): Date | null => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  // Date object automatically uses browser's local timezone
  return date;
};
