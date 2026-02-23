const COOKIE_ORG_ID = 'organizationId';
const COOKIE_MAX_AGE_DAYS = 7;

export function setOrganizationIdCookie(organizationId: string): void {
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_ORG_ID}=${encodeURIComponent(organizationId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getOrganizationIdFromCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_ORG_ID}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearOrganizationIdCookie(): void {
  document.cookie = `${COOKIE_ORG_ID}=; path=/; max-age=0`;
}
