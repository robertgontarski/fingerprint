import type { PersonId, SiteId, VisitorId } from './ids.ts';

export type VisitorRecord = { readonly id: VisitorId; readonly site: SiteId };
export type VisitorLink = { readonly from: VisitorId; readonly to: VisitorId };
export type PersonLink = { readonly visitorId: VisitorId; readonly personId: PersonId };

export type IdentityCluster = {
  readonly key: string;
  readonly visitors: readonly VisitorRecord[];
  readonly personIds: readonly PersonId[];
};

class DisjointSet {
  private readonly parent = new Map<string, string>();

  find(node: string): string {
    const parent = this.parent.get(node);
    if (parent === undefined || parent === node) {
      this.parent.set(node, node);
      return node;
    }
    const root = this.find(parent);
    this.parent.set(node, root);
    return root;
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) {
      this.parent.set(rightRoot, leftRoot);
    }
  }
}

type ClusterDraft = { readonly visitors: VisitorRecord[]; readonly personIds: Set<PersonId> };

const visitorNode = (id: VisitorId): string => `visitor:${id}`;
const personNode = (id: PersonId): string => `person:${id}`;

export class IdentityGraph {
  readonly clusters: readonly IdentityCluster[];
  private readonly clusterByVisitor: ReadonlyMap<VisitorId, IdentityCluster>;

  constructor(visitors: readonly VisitorRecord[], visitorLinks: readonly VisitorLink[], personLinks: readonly PersonLink[]) {
    const set = new DisjointSet();
    visitorLinks.forEach(({ from, to }) => set.union(visitorNode(from), visitorNode(to)));
    personLinks.forEach(({ visitorId, personId }) => set.union(visitorNode(visitorId), personNode(personId)));
    const grouped = new Map<string, ClusterDraft>();
    const groupOf = (root: string): ClusterDraft => {
      const existing = grouped.get(root);
      if (existing !== undefined) {
        return existing;
      }
      const created: ClusterDraft = { visitors: [], personIds: new Set() };
      grouped.set(root, created);
      return created;
    };
    visitors.forEach((visitor) => groupOf(set.find(visitorNode(visitor.id))).visitors.push(visitor));
    personLinks.forEach(({ personId }) => groupOf(set.find(personNode(personId))).personIds.add(personId));
    this.clusters = [...grouped.entries()]
      .filter(([, group]) => group.visitors.length > 0)
      .map(([key, group]) => ({ key, visitors: group.visitors, personIds: [...group.personIds] }))
      .sort((left, right) => right.visitors.length - left.visitors.length);
    this.clusterByVisitor = new Map(
      this.clusters.flatMap((cluster) => cluster.visitors.map((visitor): [VisitorId, IdentityCluster] => [visitor.id, cluster])),
    );
  }

  clusterOf(visitorId: VisitorId): IdentityCluster | undefined {
    return this.clusterByVisitor.get(visitorId);
  }

  areSameIdentity(left: VisitorId, right: VisitorId): boolean {
    const leftCluster = this.clusterOf(left);
    return leftCluster !== undefined && leftCluster === this.clusterOf(right);
  }

  isIdentified(visitorId: VisitorId): boolean {
    return (this.clusterOf(visitorId)?.personIds.length ?? 0) > 0;
  }

  hasCounterpartOn(visitorId: VisitorId, site: SiteId): boolean {
    return this.clusterOf(visitorId)?.visitors.some((visitor) => visitor.site === site && visitor.id !== visitorId) ?? false;
  }

  knownSameIdentity(visitorId: VisitorId, candidate: VisitorRecord): boolean | null {
    if (this.areSameIdentity(visitorId, candidate.id)) {
      return true;
    }
    return this.hasCounterpartOn(visitorId, candidate.site) ? false : null;
  }
}
