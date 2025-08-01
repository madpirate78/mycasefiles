/**
 * Date utility functions for UK format (DD/MM/YYYY)
 */

/**
 * Format a Date object to readable format (Month Day, Year)
 */
export const formatDateUK = (date: Date | string | null): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  return dateObj.toLocaleDateString('en-GB', options);
};

/**
 * Format a Date object for HTML date input (YYYY-MM-DD)
 */
export const formatDateForInput = (date: Date | string | null): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toISOString().split('T')[0];
};

/**
 * Parse a UK format date string (DD/MM/YYYY) to Date object
 */
export const parseUKDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Month is 0-indexed
  const year = parseInt(parts[2]);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  const date = new Date(year, month, day);
  
  // Validate the date is correct (handles invalid dates like 31/02/2023)
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
    return null;
  }
  
  return date;
};

/**
 * Get current date formatted in readable style
 */
export const getCurrentDateUK = (): string => {
  return formatDateUK(new Date());
};

/**
 * Format addedDate from stored files to readable format
 */
export const formatStoredDate = (addedDate?: string): string => {
  if (!addedDate) return '';
  return formatDateUK(new Date(addedDate));
};