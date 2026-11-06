import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isRecord, type UnknownRecord } from '../../shared/guards.ts';
import { isSiteId, isVisitorId, type SiteId, type VisitorId } from './ids.ts';

export const HANDOFF_TTL_MS = 120_000;

const TOKEN_VERSION = 1;
const TOKEN_ID_BYTES = 16;
const TOKEN_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const MAX_TOKEN_LENGTH = 512;

export type HandoffClaims = {
  readonly source: SiteId;
  readonly destination: SiteId;
  readonly visitorId: VisitorId;
  readonly expiresAt: number;
  readonly tokenId: string;
};

export type HandoffRejection = 'malformed' | 'bad-signature' | 'expired' | 'wrong-destination';

export type HandoffVerification =
  | { readonly ok: true; readonly claims: HandoffClaims }
  | { readonly ok: false; readonly reason: HandoffRejection };

export type HandoffRequest = {
  readonly source: SiteId;
  readonly destination: SiteId;
  readonly visitorId: VisitorId;
};

const sign = (payload: string, secret: Buffer): Buffer => createHmac('sha256', secret).update(payload).digest();

const reject = (reason: HandoffRejection): HandoffVerification => ({ ok: false, reason });

export const mintHandoffToken = ({ source, destination, visitorId }: HandoffRequest, secret: Buffer, now: number): string => {
  const claims = {
    v: TOKEN_VERSION,
    src: source,
    dst: destination,
    vid: visitorId,
    exp: now + HANDOFF_TTL_MS,
    jti: randomBytes(TOKEN_ID_BYTES).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload, secret).toString('base64url')}`;
};

const decodePayload = (payload: string): unknown => {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
};

const toClaims = ({ v, src, dst, vid, exp, jti }: UnknownRecord): HandoffClaims | undefined => {
  if (v !== TOKEN_VERSION || typeof exp !== 'number' || typeof jti !== 'string' || !TOKEN_ID_PATTERN.test(jti)) {
    return undefined;
  }
  if (typeof src !== 'string' || typeof dst !== 'string' || typeof vid !== 'string') {
    return undefined;
  }
  if (!isSiteId(src) || !isSiteId(dst) || !isVisitorId(vid)) {
    return undefined;
  }
  return { source: src, destination: dst, visitorId: vid, expiresAt: exp, tokenId: jti };
};

const hasValidSignature = (payload: string, signature: string, secret: Buffer): boolean => {
  const expected = sign(payload, secret);
  const provided = Buffer.from(signature, 'base64url');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

export const verifyHandoffToken = (
  token: string,
  expectedDestination: SiteId,
  secret: Buffer,
  now: number,
): HandoffVerification => {
  const [payload, signature, ...rest] = token.split('.');
  if (token.length > MAX_TOKEN_LENGTH || payload === undefined || signature === undefined || rest.length > 0) {
    return reject('malformed');
  }
  if (!hasValidSignature(payload, signature, secret)) {
    return reject('bad-signature');
  }
  const decoded = decodePayload(payload);
  const claims = isRecord(decoded) ? toClaims(decoded) : undefined;
  if (claims === undefined) {
    return reject('malformed');
  }
  if (claims.destination !== expectedDestination) {
    return reject('wrong-destination');
  }
  if (claims.expiresAt <= now) {
    return reject('expired');
  }
  return { ok: true, claims };
};
