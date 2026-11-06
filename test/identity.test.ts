import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IdentityGraph, type VisitorRecord } from '../src/server/domain/identity-graph.ts';
import { isSiteId, newVisitorId, personIdFor, parseEmailAddress, type PersonId, type SiteId } from '../src/server/domain/ids.ts';
import { computeCollisions, computeMatchStats } from '../src/server/domain/metrics.ts';
import { buildSnapshots, type StoredObservation } from '../src/server/domain/observation.ts';
import { fullKeyOf, stableKeyOf } from '../src/server/domain/similarity.ts';
import { sampleFingerprint } from './support.ts';

const KEY = Buffer.alloc(32, 7);

const site = (value: string): SiteId => {
  assert.ok(isSiteId(value));
  return value;
};

const person = (email: string): PersonId => {
  const parsed = parseEmailAddress(email);
  assert.ok(parsed);
  return personIdFor(parsed, KEY);
};

const visitorOn = (siteId: string): VisitorRecord => ({ id: newVisitorId(), site: site(siteId) });

let nextObservationId = 1;
const observe = (visitor: VisitorRecord, ...args: Parameters<typeof sampleFingerprint>): StoredObservation => {
  const { components, protection } = sampleFingerprint(...args);
  return {
    id: nextObservationId++,
    visitorId: visitor.id,
    site: visitor.site,
    createdAt: '2026-11-03T10:00:00.000Z',
    components,
    noisedComponents: protection.noisedComponents,
    brave: protection.brave,
    stableKey: stableKeyOf(components),
    fullKey: fullKeyOf(components),
  };
};

describe('identity graph', () => {
  it('treats visits on two domains as one identity when both placed an order with the same e-mail', () => {
    const onA = visitorOn('shop-a');
    const onB = visitorOn('shop-b');
    const anna = person('anna@example.com');

    const graph = new IdentityGraph([onA, onB], [], [
      { visitorId: onA.id, personId: anna },
      { visitorId: onB.id, personId: person(' ANNA@example.com ') },
    ]);

    assert.ok(graph.areSameIdentity(onA.id, onB.id));
    assert.deepEqual(graph.clusterOf(onA.id)?.personIds, [anna]);
  });

  it('answers unknown, not false, when there is no deterministic evidence either way', () => {
    const onA = visitorOn('shop-a');
    const onB = visitorOn('shop-b');

    const graph = new IdentityGraph([onA, onB], [], []);

    assert.equal(graph.knownSameIdentity(onB.id, onA), null);
  });

  it('answers false for a candidate when the true counterpart on that domain is known', () => {
    const onA = visitorOn('shop-a');
    const onB = visitorOn('shop-b');
    const stranger = visitorOn('shop-a');

    const graph = new IdentityGraph([onA, onB, stranger], [{ from: onA.id, to: onB.id }], []);

    assert.equal(graph.knownSameIdentity(onB.id, stranger), false);
    assert.equal(graph.knownSameIdentity(onB.id, onA), true);
  });
});

describe('fingerprint metrics', () => {
  it('counts a wrong top candidate when another browser looks more alike than the real one', () => {
    const realOnA = visitorOn('shop-a');
    const realOnB = visitorOn('shop-b');
    const twinOnA = visitorOn('shop-a');
    const snapshots = buildSnapshots(
      [realOnA, realOnB, twinOnA],
      [
        observe(realOnA, { canvas: 'farbled-on-a' }),
        observe(realOnB, { canvas: 'farbled-on-b' }),
        observe(twinOnA, { canvas: 'farbled-on-b' }),
      ],
    );
    const graph = new IdentityGraph([realOnA, realOnB, twinOnA], [{ from: realOnA.id, to: realOnB.id }], []);

    const stats = computeMatchStats(snapshots, graph);

    assert.equal(stats.evaluated, 2);
    assert.equal(stats.topCandidateCorrect, 1);
  });

  it('reports a collision when two different customers share one stable fingerprint', () => {
    const first = visitorOn('shop-a');
    const second = visitorOn('shop-a');
    const snapshots = buildSnapshots([first, second], [observe(first), observe(second)]);
    const graph = new IdentityGraph([first, second], [], [
      { visitorId: first.id, personId: person('anna@example.com') },
      { visitorId: second.id, personId: person('jan@example.com') },
    ]);

    const collisions = computeCollisions(snapshots, graph);

    assert.equal(collisions.sharedStableKeys, 1);
    assert.equal(collisions.visitorsOnSharedKeys, 2);
  });
});
