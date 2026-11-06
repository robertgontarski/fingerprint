import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { HANDOFF_TTL_MS, mintHandoffToken, verifyHandoffToken } from '../src/server/domain/handoff.ts';
import { isSiteId, newVisitorId, type SiteId } from '../src/server/domain/ids.ts';

const site = (value: string): SiteId => {
  assert.ok(isSiteId(value));
  return value;
};

const SECRET = randomBytes(32);
const NOW = Date.parse('2026-11-03T10:00:00Z');
const SHOP_A = site('shop-a');
const SHOP_B = site('shop-b');
const request = { source: SHOP_A, destination: SHOP_B, visitorId: newVisitorId() };

describe('handoff token', () => {
  it('accepts a fresh token at its destination and returns the source visitor', () => {
    const token = mintHandoffToken(request, SECRET, NOW);

    const result = verifyHandoffToken(token, SHOP_B, SECRET, NOW + 1000);

    assert.ok(result.ok);
    assert.equal(result.claims.visitorId, request.visitorId);
    assert.equal(result.claims.source, SHOP_A);
  });

  it('rejects a token whose payload was changed after signing', () => {
    const [payload = '', signature = ''] = mintHandoffToken(request, SECRET, NOW).split('.');
    const forged = Buffer.from(Buffer.from(payload, 'base64url').toString('utf8').replace('shop-a', 'shop-x')).toString('base64url');

    const result = verifyHandoffToken(`${forged}.${signature}`, SHOP_B, SECRET, NOW);

    assert.deepEqual(result, { ok: false, reason: 'bad-signature' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = mintHandoffToken(request, randomBytes(32), NOW);

    assert.deepEqual(verifyHandoffToken(token, SHOP_B, SECRET, NOW), { ok: false, reason: 'bad-signature' });
  });

  it('rejects a token presented at a domain it was not issued for', () => {
    const token = mintHandoffToken(request, SECRET, NOW);

    assert.deepEqual(verifyHandoffToken(token, SHOP_A, SECRET, NOW), { ok: false, reason: 'wrong-destination' });
  });

  it('rejects a token at the end of its lifetime', () => {
    const token = mintHandoffToken(request, SECRET, NOW);

    assert.deepEqual(verifyHandoffToken(token, SHOP_B, SECRET, NOW + HANDOFF_TTL_MS), { ok: false, reason: 'expired' });
  });

  it('rejects input that is not a two-part token', () => {
    assert.deepEqual(verifyHandoffToken('a.b.c', SHOP_B, SECRET, NOW), { ok: false, reason: 'malformed' });
    assert.deepEqual(verifyHandoffToken('x'.repeat(600), SHOP_B, SECRET, NOW), { ok: false, reason: 'malformed' });
  });
});
