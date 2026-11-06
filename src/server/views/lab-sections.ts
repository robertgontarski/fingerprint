import type { IdentityCluster } from '../domain/identity-graph.ts';
import type { VisitorSnapshot } from '../domain/observation.ts';
import { isConfidentMatch, type ComponentComparison, type ComponentStatus } from '../domain/similarity.ts';
import type { CandidateView, LabModel, PairView, RankedCandidate } from '../lab.ts';
import { html, type SafeHtml } from './html.ts';

const SHORT = 8;
const MAX_CELL = 48;

const STATUS_LABELS: Readonly<Record<ComponentStatus, string>> = {
  match: 'match',
  differ: 'different',
  noised: 'noised',
  missing: 'missing',
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const shortId = (value: string): string => value.slice(0, SHORT);
const cell = (value: string | undefined): string => {
  if (value === undefined) {
    return '-';
  }
  return value.length > MAX_CELL ? `${value.slice(0, MAX_CELL)}...` : value;
};
const visitorLabel = ({ visitor }: VisitorSnapshot): string => `${visitor.site}:${shortId(visitor.id)}`;

const verdictLabel = (sameIdentity: boolean | null): string => {
  if (sameIdentity === null) {
    return 'unknown';
  }
  return sameIdentity ? 'correct' : 'wrong';
};

export const metricsSection = ({ collisions, drift, matches, orderCount }: LabModel): SafeHtml => html`
<section class="card" aria-labelledby="metrics-heading">
  <h2 id="metrics-heading">Metrics</h2>
  <table>
    <tbody>
      <tr><th scope="row">Orders</th><td>${orderCount}</td></tr>
      <tr><th scope="row">Identified visitors (linked to an order)</th><td>${collisions.identifiedVisitors}</td></tr>
      <tr><th scope="row">Stable fingerprints shared by different people (collisions)</th><td>${collisions.sharedStableKeys} of ${collisions.distinctStableKeys}</td></tr>
      <tr><th scope="row">Visitors on a collision</th><td>${collisions.visitorsOnSharedKeys}</td></tr>
      <tr><th scope="row">Visitors with repeat observations</th><td>${drift.visitorsWithRepeatVisits}</td></tr>
      <tr><th scope="row">Stable fingerprint drift</th><td>${drift.stableKeyChanged}</td></tr>
      <tr><th scope="row">Full fingerprint drift</th><td>${drift.fullKeyChanged}</td></tr>
      <tr><th scope="row">Pairs evaluated (answer known)</th><td>${matches.evaluated}</td></tr>
      <tr><th scope="row">Top candidate correct</th><td>${matches.topCandidateCorrect} of ${matches.evaluated}</td></tr>
      <tr><th scope="row">Confident matches (above threshold)</th><td>${matches.confidentCorrect} correct of ${matches.confident}</td></tr>
    </tbody>
  </table>
</section>`;

const componentRow = ({ name, status, left, right, weight }: ComponentComparison): SafeHtml => html`
<tr class="status-${status}"><td>${name}</td><td>${weight}</td><td>${cell(left)}</td><td>${cell(right)}</td><td>${STATUS_LABELS[status]}</td></tr>`;

const namesWith = (pair: PairView, status: ComponentStatus): string =>
  pair.comparison.components
    .filter((component) => component.status === status)
    .map(({ name }) => name)
    .join(', ') || '-';

const pairBlock = (pair: PairView): SafeHtml => html`
<article class="pair">
  <h3>${visitorLabel(pair.left)} and ${visitorLabel(pair.right)}: similarity ${percent(pair.comparison.score)}</h3>
  <p>Different: ${namesWith(pair, 'differ')}. Noised: ${namesWith(pair, 'noised')}.</p>
  <details>
    <summary>All signals</summary>
    <table>
      <thead><tr><th>Signal</th><th>Weight</th><th>${pair.left.visitor.site}</th><th>${pair.right.visitor.site}</th><th>Status</th></tr></thead>
      <tbody>${pair.comparison.components.map(componentRow)}</tbody>
    </table>
  </details>
</article>`;

export const pairsSection = ({ pairs }: LabModel): SafeHtml => html`
<section class="card" aria-labelledby="pairs-heading">
  <h2 id="pairs-heading">Same browser on two domains</h2>
  <p>Pairs linked deterministically (by a token or the same order). They show which signals survive a change of domain.</p>
  ${pairs.length === 0 ? html`<p>No pairs yet. Go to the other domain using the link with a token.</p>` : pairs.map(pairBlock)}
</section>`;

const candidateRow = (target: VisitorSnapshot, { match, sameIdentity }: RankedCandidate): SafeHtml => html`
<tr>
  <td>${visitorLabel(target)}</td>
  <td>${visitorLabel(match.snapshot)}</td>
  <td>${percent(match.comparison.score)}</td>
  <td>${match.comparison.comparableWeight}</td>
  <td>${isConfidentMatch(match.comparison) ? 'yes' : 'no'}</td>
  <td>${verdictLabel(sameIdentity)}</td>
</tr>`;

export const candidatesSection = ({ candidates }: LabModel): SafeHtml => html`
<section class="card" aria-labelledby="candidates-heading">
  <h2 id="candidates-heading">Probabilistic matching</h2>
  <p>For recent visitors: the closest fingerprints from other domains. The verdict is known only where a deterministic link exists.</p>
  <table>
    <thead><tr><th>Visitor</th><th>Candidate</th><th>Similarity</th><th>Compared weight</th><th>Above threshold</th><th>Verdict</th></tr></thead>
    <tbody>${candidates.flatMap(({ target, candidates: ranked }: CandidateView) => ranked.map((candidate) => candidateRow(target, candidate)))}</tbody>
  </table>
</section>`;

const clusterRow = (cluster: IdentityCluster, index: number): SafeHtml => html`
<tr>
  <td>${index + 1}</td>
  <td>${cluster.visitors.map(({ site, id }) => `${site}:${shortId(id)}`).join(', ')}</td>
  <td>${cluster.personIds.map(shortId).join(', ') || '-'}</td>
</tr>`;

export const clustersSection = ({ clusters }: LabModel): SafeHtml => html`
<section class="card" aria-labelledby="clusters-heading">
  <h2 id="clusters-heading">Identity graph</h2>
  <table>
    <thead><tr><th>#</th><th>Visitors</th><th>People (e-mail HMAC)</th></tr></thead>
    <tbody>${clusters.map(clusterRow)}</tbody>
  </table>
</section>`;

export const recentSection = ({ recent }: LabModel): SafeHtml => html`
<section class="card" aria-labelledby="recent-heading">
  <h2 id="recent-heading">Recent observations</h2>
  <table>
    <thead><tr><th>Time</th><th>Visitor</th><th>Browser</th><th>Stable fingerprint</th><th>Noise</th></tr></thead>
    <tbody>${recent.map(
      (observation) => html`<tr>
        <td>${observation.createdAt}</td>
        <td>${observation.site}:${shortId(observation.visitorId)}</td>
        <td>${cell(observation.components.userAgent)}${observation.brave && ' (Brave)'}</td>
        <td>${observation.stableKey}</td>
        <td>${observation.noisedComponents.join(', ') || '-'}</td>
      </tr>`,
    )}</tbody>
  </table>
</section>`;
