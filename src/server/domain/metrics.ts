import type { IdentityGraph } from './identity-graph.ts';
import type { SiteId } from './ids.ts';
import type { VisitorSnapshot } from './observation.ts';
import { compareFingerprints, isConfidentMatch, type FingerprintComparison } from './similarity.ts';

export type CandidateMatch = { readonly snapshot: VisitorSnapshot; readonly comparison: FingerprintComparison };

export type CollisionStats = {
  readonly identifiedVisitors: number;
  readonly distinctStableKeys: number;
  readonly sharedStableKeys: number;
  readonly visitorsOnSharedKeys: number;
};

export type DriftStats = {
  readonly visitorsWithRepeatVisits: number;
  readonly stableKeyChanged: number;
  readonly fullKeyChanged: number;
};

export type MatchStats = {
  readonly evaluated: number;
  readonly topCandidateCorrect: number;
  readonly confident: number;
  readonly confidentCorrect: number;
};

const byStrength = (left: CandidateMatch, right: CandidateMatch): number =>
  right.comparison.score - left.comparison.score ||
  right.comparison.comparableWeight - left.comparison.comparableWeight;

const isCandidateSite = (candidate: VisitorSnapshot, target: VisitorSnapshot, site: SiteId | undefined): boolean =>
  candidate.visitor.site !== target.visitor.site && (site === undefined || candidate.visitor.site === site);

export const rankCandidates = (
  target: VisitorSnapshot,
  pool: readonly VisitorSnapshot[],
  site?: SiteId,
): CandidateMatch[] =>
  pool
    .filter((candidate) => isCandidateSite(candidate, target, site))
    .map((snapshot) => ({ snapshot, comparison: compareFingerprints(target.latest, snapshot.latest) }))
    .sort(byStrength);

export const findBestCandidate = (
  target: VisitorSnapshot,
  pool: readonly VisitorSnapshot[],
  site?: SiteId,
): CandidateMatch | undefined => rankCandidates(target, pool, site)[0];

export const computeCollisions = (snapshots: readonly VisitorSnapshot[], graph: IdentityGraph): CollisionStats => {
  const identified = snapshots.filter(({ visitor }) => graph.isIdentified(visitor.id));
  const byKey = Map.groupBy(identified, ({ latest }) => latest.stableKey);
  const shared = [...byKey.values()].filter(
    (group) => new Set(group.map(({ visitor }) => graph.clusterOf(visitor.id)?.key)).size > 1,
  );
  return {
    identifiedVisitors: identified.length,
    distinctStableKeys: byKey.size,
    sharedStableKeys: shared.length,
    visitorsOnSharedKeys: shared.reduce((sum, group) => sum + group.length, 0),
  };
};

export const computeDrift = (snapshots: readonly VisitorSnapshot[]): DriftStats => {
  const repeated = snapshots.filter(({ observationCount }) => observationCount > 1);
  return {
    visitorsWithRepeatVisits: repeated.length,
    stableKeyChanged: repeated.filter(({ distinctStableKeys }) => distinctStableKeys > 1).length,
    fullKeyChanged: repeated.filter(({ distinctFullKeys }) => distinctFullKeys > 1).length,
  };
};

const counterpartSites = (target: VisitorSnapshot, graph: IdentityGraph): SiteId[] => {
  const sites = graph.clusterOf(target.visitor.id)?.visitors.map(({ site }) => site) ?? [];
  return [...new Set(sites)].filter((site) => site !== target.visitor.site);
};

export const computeMatchStats = (snapshots: readonly VisitorSnapshot[], graph: IdentityGraph): MatchStats => {
  const outcomes = snapshots.flatMap((target) =>
    counterpartSites(target, graph)
      .map((site) => findBestCandidate(target, snapshots, site))
      .filter((best) => best !== undefined)
      .map((best) => ({
        correct: graph.areSameIdentity(target.visitor.id, best.snapshot.visitor.id),
        confident: isConfidentMatch(best.comparison),
      })),
  );
  return {
    evaluated: outcomes.length,
    topCandidateCorrect: outcomes.filter(({ correct }) => correct).length,
    confident: outcomes.filter(({ confident }) => confident).length,
    confidentCorrect: outcomes.filter(({ confident, correct }) => confident && correct).length,
  };
};
