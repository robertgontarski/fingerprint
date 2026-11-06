import { createHmac, randomBytes } from 'node:crypto';

export type VisitorId = string & { readonly __brand: 'VisitorId' };
export type PersonId = string & { readonly __brand: 'PersonId' };
export type SiteId = string & { readonly __brand: 'SiteId' };
export type EmailAddress = string & { readonly __brand: 'EmailAddress' };

const VISITOR_ID_BYTES = 16;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const PERSON_ID_PATTERN = /^[0-9a-f]{64}$/;
const SITE_ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export const isVisitorId = (value: string): value is VisitorId => VISITOR_ID_PATTERN.test(value);

export const isPersonId = (value: string): value is PersonId => PERSON_ID_PATTERN.test(value);

export const isSiteId = (value: string): value is SiteId => SITE_ID_PATTERN.test(value);

export const newVisitorId = (): VisitorId => {
  const candidate = randomBytes(VISITOR_ID_BYTES).toString('base64url');
  if (!isVisitorId(candidate)) {
    throw new Error('Generated visitor id does not match the expected format');
  }
  return candidate;
};

const isEmailAddress = (value: string): value is EmailAddress =>
  value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);

export const parseEmailAddress = (raw: string): EmailAddress | undefined => {
  const normalized = raw.trim().toLowerCase();
  return isEmailAddress(normalized) ? normalized : undefined;
};

// why: a keyed HMAC instead of plain SHA-256, because an unkeyed e-mail hash
// can be reversed with a dictionary of known addresses.
export const personIdFor = (email: EmailAddress, key: Buffer): PersonId => {
  const digest = createHmac('sha256', key).update(email).digest('hex');
  if (!isPersonId(digest)) {
    throw new Error('HMAC digest does not match the person id format');
  }
  return digest;
};
