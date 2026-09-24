import { isOversightTeam } from '../../utils/roleUtils';

describe('isOversightTeam', () => {
  it('is true for the two teams that follow every enquiry', () => {
    expect(isOversightTeam('Management')).toBe(true);
    expect(isOversightTeam('Senior Management')).toBe(true);
  });

  it('ignores case and padding, as team names are typed by hand', () => {
    expect(isOversightTeam('  senior management ')).toBe(true);
  });

  it('is false for the teams that work a stage', () => {
    ['Administration', 'Engineering', 'Procurement', 'Team Lead', 'Site Personnel'].forEach((team) =>
      expect(isOversightTeam(team)).toBe(false)
    );
  });

  it('is false when the member is on no team', () => {
    expect(isOversightTeam(undefined)).toBe(false);
    expect(isOversightTeam('')).toBe(false);
  });
});
