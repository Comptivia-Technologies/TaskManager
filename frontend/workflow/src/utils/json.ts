/**
 * Parses a JSON object, returning {} rather than throwing. Stage data and rule
 * conditions arrive as strings that may be empty, null or malformed, and a blank
 * form is always a better outcome than a blank screen.
 */
export const parseJsonObject = (raw?: string | null): Record<string, any> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
