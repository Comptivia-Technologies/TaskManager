import { formatDateToIST, formatDateOnlyIST, getISTDate } from '../../utils/dateUtils';

describe('dateUtils', () => {
  describe('formatDateToIST', () => {
    it('returns N/A for null or undefined', () => {
      expect(formatDateToIST(null)).toBe('N/A');
      expect(formatDateToIST(undefined)).toBe('N/A');
    });

    it('returns N/A for empty string', () => {
      expect(formatDateToIST('')).toBe('N/A');
    });

    it('formats valid UTC date string with Z suffix', () => {
      const result = formatDateToIST('2024-03-15T10:30:00Z');
      expect(result).not.toBe('N/A');
      expect(result).not.toBe('Invalid Date');
      expect(typeof result).toBe('string');
    });

    it('formats valid date without timezone (appends Z)', () => {
      const result = formatDateToIST('2024-03-15T10:30:00');
      expect(result).not.toBe('N/A');
      expect(result).not.toBe('Invalid Date');
    });

    it('returns Invalid Date for invalid date string', () => {
      expect(formatDateToIST('not-a-date')).toBe('Invalid Date');
    });
  });

  describe('formatDateOnlyIST', () => {
    it('returns N/A for null or undefined', () => {
      expect(formatDateOnlyIST(null)).toBe('N/A');
      expect(formatDateOnlyIST(undefined)).toBe('N/A');
    });

    it('formats valid UTC date string', () => {
      const result = formatDateOnlyIST('2024-03-15T10:30:00Z');
      expect(result).not.toBe('N/A');
      expect(result).not.toBe('Invalid Date');
    });

    it('returns Invalid Date for invalid date string', () => {
      expect(formatDateOnlyIST('invalid')).toBe('Invalid Date');
    });
  });

  describe('getISTDate', () => {
    it('returns null for null or undefined', () => {
      expect(getISTDate(null)).toBeNull();
      expect(getISTDate(undefined)).toBeNull();
    });

    it('returns Date for valid date string', () => {
      const result = getISTDate('2024-03-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(new Date('2024-03-15T10:30:00Z').getTime());
    });
  });
});
