import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareFingerprints, isConfidentMatch, stableKeyOf, type FingerprintSample } from '../src/server/domain/similarity.ts';
import { sampleFingerprint } from './support.ts';

const sample = (...args: Parameters<typeof sampleFingerprint>): FingerprintSample => {
  const { components, protection } = sampleFingerprint(...args);
  return { components, noisedComponents: protection.noisedComponents };
};

describe('fingerprint similarity', () => {
  it('scores identical fingerprints as a full match', () => {
    const comparison = compareFingerprints(sample(), sample());

    assert.equal(comparison.score, 1);
    assert.ok(isConfidentMatch(comparison));
  });

  it('excludes a component that either side reports as noised', () => {
    const left = sample({ canvas: 'left-noise' }, { noisedComponents: ['canvas'] });
    const right = sample({ canvas: 'right-noise' });

    const comparison = compareFingerprints(left, right);

    assert.equal(comparison.score, 1);
    assert.equal(comparison.components.find(({ name }) => name === 'canvas')?.status, 'noised');
  });

  it('lowers the score when a heavy component differs', () => {
    const comparison = compareFingerprints(sample(), sample({ canvas: 'other-canvas' }));

    assert.ok(comparison.score < 1);
    assert.equal(comparison.components.find(({ name }) => name === 'canvas')?.status, 'differ');
  });

  it('does not call a match confident when too few signals are comparable', () => {
    const comparison = compareFingerprints(
      { components: { timezone: 'Europe/London' }, noisedComponents: [] },
      { components: { timezone: 'Europe/London' }, noisedComponents: [] },
    );

    assert.equal(comparison.score, 1);
    assert.equal(isConfidentMatch(comparison), false);
  });

  it('keeps the stable key when only volatile components change', () => {
    const before = sample();
    const after = sample({ userAgent: 'Mozilla/5.0 (Macintosh) TestBrowser/2.0', canvas: 'after-update' });

    assert.equal(stableKeyOf(before.components), stableKeyOf(after.components));
  });
});
