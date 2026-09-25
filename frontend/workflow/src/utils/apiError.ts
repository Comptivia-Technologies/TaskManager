// The same three-way fallback was written out in eight files. Services disagree on
// the error field, so all the known shapes are tried before the caller's default.
export const apiErrorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;
