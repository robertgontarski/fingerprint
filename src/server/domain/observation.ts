import type { ComponentName, Components } from '../../shared/contract.ts';
import type { VisitorRecord } from './identity-graph.ts';
import type { SiteId, VisitorId } from './ids.ts';

export type StoredObservation = {
  readonly id: number;
  readonly visitorId: VisitorId;
  readonly site: SiteId;
  readonly createdAt: string;
  readonly components: Components;
  readonly noisedComponents: readonly ComponentName[];
  readonly brave: boolean;
  readonly stableKey: string;
  readonly fullKey: string;
};

export type VisitorSnapshot = {
  readonly visitor: VisitorRecord;
  readonly latest: StoredObservation;
  readonly observationCount: number;
  readonly distinctStableKeys: number;
  readonly distinctFullKeys: number;
};

const snapshotOf = (visitor: VisitorRecord, history: readonly StoredObservation[]): VisitorSnapshot | undefined => {
  const latest = history.reduce<StoredObservation | undefined>(
    (newest, observation) => (newest === undefined || observation.id > newest.id ? observation : newest),
    undefined,
  );
  if (latest === undefined) {
    return undefined;
  }
  return {
    visitor,
    latest,
    observationCount: history.length,
    distinctStableKeys: new Set(history.map(({ stableKey }) => stableKey)).size,
    distinctFullKeys: new Set(history.map(({ fullKey }) => fullKey)).size,
  };
};

export const buildSnapshots = (
  visitors: readonly VisitorRecord[],
  observations: readonly StoredObservation[],
): VisitorSnapshot[] => {
  const historyByVisitor = Map.groupBy(observations, ({ visitorId }) => visitorId);
  return visitors
    .map((visitor) => snapshotOf(visitor, historyByVisitor.get(visitor.id) ?? []))
    .filter((snapshot) => snapshot !== undefined);
};
