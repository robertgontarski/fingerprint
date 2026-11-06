import type { CandidateSummary } from '../shared/contract.ts';
import type { Repository } from './db/repository.ts';
import { IdentityGraph, type IdentityCluster, type PersonLink, type VisitorLink, type VisitorRecord } from './domain/identity-graph.ts';
import type { VisitorId } from './domain/ids.ts';
import {
  computeCollisions,
  computeDrift,
  computeMatchStats,
  findBestCandidate,
  rankCandidates,
  type CandidateMatch,
  type CollisionStats,
  type DriftStats,
  type MatchStats,
} from './domain/metrics.ts';
import { buildSnapshots, type StoredObservation, type VisitorSnapshot } from './domain/observation.ts';
import { compareFingerprints, type FingerprintComparison } from './domain/similarity.ts';

const RECENT_TARGETS = 10;
const CANDIDATES_PER_TARGET = 3;
const RECENT_OBSERVATIONS = 20;

export type LabData = {
  readonly visitors: readonly VisitorRecord[];
  readonly observations: readonly StoredObservation[];
  readonly visitorLinks: readonly VisitorLink[];
  readonly personLinks: readonly PersonLink[];
  readonly orderCount: number;
};

export type PairView = {
  readonly left: VisitorSnapshot;
  readonly right: VisitorSnapshot;
  readonly comparison: FingerprintComparison;
};

export type RankedCandidate = { readonly match: CandidateMatch; readonly sameIdentity: boolean | null };

export type CandidateView = { readonly target: VisitorSnapshot; readonly candidates: readonly RankedCandidate[] };

export type LabModel = {
  readonly clusters: readonly IdentityCluster[];
  readonly pairs: readonly PairView[];
  readonly candidates: readonly CandidateView[];
  readonly collisions: CollisionStats;
  readonly drift: DriftStats;
  readonly matches: MatchStats;
  readonly recent: readonly StoredObservation[];
  readonly orderCount: number;
};

export const loadLabData = (repository: Repository): LabData => ({
  visitors: repository.visitors(),
  observations: repository.observations(),
  visitorLinks: repository.visitorLinks(),
  personLinks: repository.personLinks(),
  orderCount: repository.orderCount(),
});

const crossSitePairs = (cluster: IdentityCluster, snapshots: ReadonlyMap<VisitorId, VisitorSnapshot>): PairView[] => {
  const members = cluster.visitors
    .map(({ id }) => snapshots.get(id))
    .filter((snapshot) => snapshot !== undefined);
  return members.flatMap((left, index) =>
    members
      .slice(index + 1)
      .filter((right) => right.visitor.site !== left.visitor.site)
      .map((right) => ({ left, right, comparison: compareFingerprints(left.latest, right.latest) })),
  );
};

const candidateView = (target: VisitorSnapshot, pool: readonly VisitorSnapshot[], graph: IdentityGraph): CandidateView => ({
  target,
  candidates: rankCandidates(target, pool)
    .slice(0, CANDIDATES_PER_TARGET)
    .map((match) => ({ match, sameIdentity: graph.knownSameIdentity(target.visitor.id, match.snapshot.visitor) })),
});

export const buildLabModel = (data: LabData): LabModel => {
  const graph = new IdentityGraph(data.visitors, data.visitorLinks, data.personLinks);
  const snapshots = buildSnapshots(data.visitors, data.observations);
  const byVisitor = new Map(snapshots.map((snapshot): [VisitorId, VisitorSnapshot] => [snapshot.visitor.id, snapshot]));
  const newestFirst = [...snapshots].sort((left, right) => right.latest.id - left.latest.id);
  return {
    clusters: graph.clusters,
    pairs: graph.clusters.flatMap((cluster) => crossSitePairs(cluster, byVisitor)),
    candidates: newestFirst.slice(0, RECENT_TARGETS).map((target) => candidateView(target, snapshots, graph)),
    collisions: computeCollisions(snapshots, graph),
    drift: computeDrift(snapshots),
    matches: computeMatchStats(snapshots, graph),
    recent: [...data.observations].reverse().slice(0, RECENT_OBSERVATIONS),
    orderCount: data.orderCount,
  };
};

export const bestCandidateFor = (visitorId: VisitorId, data: LabData): CandidateSummary | null => {
  const graph = new IdentityGraph(data.visitors, data.visitorLinks, data.personLinks);
  const snapshots = buildSnapshots(data.visitors, data.observations);
  const target = snapshots.find(({ visitor }) => visitor.id === visitorId);
  const best = target === undefined ? undefined : findBestCandidate(target, snapshots);
  if (best === undefined) {
    return null;
  }
  const { visitor } = best.snapshot;
  return {
    site: visitor.site,
    visitorId: visitor.id,
    score: best.comparison.score,
    sameIdentity: graph.knownSameIdentity(visitorId, visitor),
  };
};
