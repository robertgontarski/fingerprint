export type CookieJar = ReadonlyMap<string, string>;

export type ConsentState = 'granted' | 'denied' | 'unknown';

export const VISITOR_COOKIE = 'vid';
export const CONSENT_COOKIE = 'consent';

const VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export const parseCookies = (header: string | undefined): CookieJar => {
  const jar = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    const name = part.slice(0, separator).trim();
    if (separator > 0 && !jar.has(name)) {
      jar.set(name, part.slice(separator + 1).trim());
    }
  }
  return jar;
};

export const consentOf = (cookies: CookieJar): ConsentState => {
  const value = cookies.get(CONSENT_COOKIE);
  return value === 'granted' || value === 'denied' ? value : 'unknown';
};

const serialize = (name: string, value: string, maxAgeSeconds: number, secure: boolean): string =>
  [`${name}=${value}`, 'Path=/', `Max-Age=${maxAgeSeconds}`, 'SameSite=Lax', 'HttpOnly', ...(secure ? ['Secure'] : [])].join(
    '; ',
  );

export const consentCookie = (state: 'granted' | 'denied', secure: boolean): string =>
  serialize(CONSENT_COOKIE, state, CONSENT_MAX_AGE_SECONDS, secure);

export const visitorCookie = (visitorId: string, secure: boolean): string =>
  serialize(VISITOR_COOKIE, visitorId, VISITOR_MAX_AGE_SECONDS, secure);

export const expiredVisitorCookie = (secure: boolean): string => serialize(VISITOR_COOKIE, '', 0, secure);
