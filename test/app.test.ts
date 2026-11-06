import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { parseCollectResponse } from '../src/shared/collect-response.ts';
import type { CollectResponse } from '../src/shared/contract.ts';
import { sampleFingerprint, SITE_A, SITE_B, startTestServer, TestBrowser, type TestServer } from './support.ts';

const collect = async (browser: TestBrowser, origin: string, body: unknown): Promise<CollectResponse> => {
  const response = await browser.send(origin, '/api/collect', { json: body });
  assert.equal(response.status, 200, response.body);
  const parsed = parseCollectResponse(JSON.parse(response.body));
  assert.ok(parsed, `unexpected collect response: ${response.body}`);
  return parsed;
};

const handoffTokenFrom = async (browser: TestBrowser): Promise<string> => {
  const response = await browser.send(SITE_A, '/out?to=shop-b');
  assert.equal(response.status, 302);
  const location = new URL(response.headers.location ?? '');
  assert.equal(location.origin, SITE_B);
  return location.searchParams.get('hid') ?? '';
};

describe('cross-domain identity PoC', () => {
  let server: TestServer;
  let browser: TestBrowser;

  beforeEach(async () => {
    server = await startTestServer();
    browser = new TestBrowser(server.port);
  });

  afterEach(async () => {
    await server.close();
  });

  it('links visits on both domains when the visitor follows the link with a handoff token', async () => {
    await browser.send(SITE_A, '/api/consent', { json: { granted: true } });
    await collect(browser, SITE_A, sampleFingerprint());
    const token = await handoffTokenFrom(browser);
    await browser.send(SITE_B, '/api/consent', { json: { granted: true } });

    const result = await collect(browser, SITE_B, { ...sampleFingerprint(), handoffToken: token });

    assert.equal(result.handoff, 'linked');
    assert.equal(result.bestCandidate?.site, 'shop-a');
    assert.equal(result.bestCandidate?.sameIdentity, true);
  });

  it('rejects a handoff token presented for the second time', async () => {
    await browser.send(SITE_A, '/api/consent', { json: { granted: true } });
    await collect(browser, SITE_A, sampleFingerprint());
    const token = await handoffTokenFrom(browser);
    await browser.send(SITE_B, '/api/consent', { json: { granted: true } });
    await collect(browser, SITE_B, { ...sampleFingerprint(), handoffToken: token });

    const replay = await collect(browser, SITE_B, { ...sampleFingerprint(), handoffToken: token });

    assert.equal(replay.handoff, 'reused');
  });

  it('rejects a handoff token after its two-minute lifetime', async () => {
    await browser.send(SITE_A, '/api/consent', { json: { granted: true } });
    const token = await handoffTokenFrom(browser);
    await browser.send(SITE_B, '/api/consent', { json: { granted: true } });
    server.advanceClock(121_000);

    const result = await collect(browser, SITE_B, { ...sampleFingerprint(), handoffToken: token });

    assert.equal(result.handoff, 'expired');
  });

  it('leaves for the other domain without a token when there is no consent', async () => {
    const response = await browser.send(SITE_A, '/out?to=shop-b');

    assert.equal(response.status, 302);
    assert.equal(response.headers.location, `${SITE_B}/`);
  });

  it('refuses to collect a fingerprint without consent', async () => {
    const response = await browser.send(SITE_A, '/api/collect', { json: sampleFingerprint() });

    assert.equal(response.status, 403);
  });

  it('rejects a state-changing request without a same-origin Origin header', async () => {
    const response = await browser.send(SITE_A, '/api/consent', { json: { granted: true }, sendOrigin: false });

    assert.equal(response.status, 403);
  });

  it('rejects a fingerprint with a component outside the allowlist', async () => {
    await browser.send(SITE_A, '/api/consent', { json: { granted: true } });

    const response = await browser.send(SITE_A, '/api/collect', {
      json: { ...sampleFingerprint(), components: { batteryLevel: '0.42' } },
    });

    assert.equal(response.status, 400);
  });

  it('refuses to redirect to a destination outside the configured sites', async () => {
    const response = await browser.send(SITE_A, '/out?to=https://evil.test');

    assert.equal(response.status, 400);
    assert.equal(response.headers.location, undefined);
  });

  it('answers 421 for a Host that is not a configured site', async () => {
    const response = await browser.send(SITE_A, '/', { host: 'evil.test' });

    assert.equal(response.status, 421);
  });

  it('links an order to the visit and escapes collected values on the lab page', async () => {
    await browser.send(SITE_A, '/api/consent', { json: { granted: true } });
    await collect(browser, SITE_A, sampleFingerprint({ userAgent: '<script>alert(1)</script>' }));

    const order = await browser.send(SITE_A, '/order', { form: { email: ' Jane.Doe@Example.com ' } });
    const lab = await browser.send(SITE_A, '/lab');

    assert.equal(order.status, 303);
    assert.match(lab.body, /Identified visitors \(linked to an order\)<\/th><td>1</);
    assert.ok(lab.body.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!lab.body.includes('<script>alert(1)'));
    assert.ok(!lab.body.includes('jane.doe@example.com'));
  });

  it('serves files from public but nothing outside it', async () => {
    const stylesheet = await browser.send(SITE_A, '/static/style.css');
    const outside = await browser.send(SITE_A, '/static/..%2fpackage.json');

    assert.equal(stylesheet.status, 200);
    assert.equal(outside.status, 404);
  });

  it('sends the security headers with every page', async () => {
    const response = await browser.send(SITE_A, '/');

    assert.match(String(response.headers['content-security-policy']), /default-src 'none'/);
    assert.equal(response.headers['referrer-policy'], 'same-origin');
    assert.equal(response.headers['x-frame-options'], 'DENY');
  });
});
