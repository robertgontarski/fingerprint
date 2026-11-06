import {
  COMPONENT_NAMES,
  type CandidateSummary,
  type CollectResponse,
  type HandoffOutcome,
} from '../shared/contract.ts';
import type { Fingerprint } from './collector.ts';

const MAX_VALUE_LENGTH = 64;
const SHORT_ID_LENGTH = 8;

const OUTCOME_LABELS: Readonly<Record<HandoffOutcome, string>> = {
  absent: 'no token - arrived without a link from the other domain',
  linked: 'token accepted - visit linked deterministically to the other domain',
  malformed: 'malformed token',
  'bad-signature': 'invalid token signature',
  expired: 'token expired (valid for 2 minutes)',
  'wrong-destination': 'token issued for a different domain',
  reused: 'token already used (single use only)',
};

const element = <Tag extends keyof HTMLElementTagNameMap>(tag: Tag, text?: string): HTMLElementTagNameMap[Tag] => {
  const created = document.createElement(tag);
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
};

const shorten = (value: string): string =>
  value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}...` : value;

const describeIdentity = (sameIdentity: boolean | null): string => {
  if (sameIdentity === null) {
    return 'unknown whether this is the same person (no deterministic link)';
  }
  return sameIdentity ? 'same identity (confirmed deterministically)' : 'a different identity';
};

const describeCandidate = (candidate: CandidateSummary | null): string => {
  if (candidate === null) {
    return 'Closest fingerprint on another domain: no data to compare.';
  }
  const score = Math.round(candidate.score * 100);
  const visitor = candidate.visitorId.slice(0, SHORT_ID_LENGTH);
  return `Closest fingerprint on ${candidate.site}: ${visitor}, similarity ${score}% - ${describeIdentity(candidate.sameIdentity)}.`;
};

const componentRow = (name: string, value: string, noised: boolean): HTMLTableRowElement => {
  const row = element('tr');
  row.append(element('td', name), element('td', shorten(value)), element('td', noised ? 'noised' : ''));
  return row;
};

const componentTable = ({ components, protection }: Fingerprint): HTMLTableElement => {
  const table = element('table');
  const header = element('tr');
  header.append(element('th', 'Signal'), element('th', 'Value'), element('th', 'Notes'));
  table.append(element('thead'), element('tbody'));
  table.tHead?.append(header);
  for (const name of COMPONENT_NAMES) {
    const value = components[name];
    if (value !== undefined) {
      table.tBodies[0]?.append(componentRow(name, value, protection.noisedComponents.includes(name)));
    }
  }
  return table;
};

const describeProtection = ({ protection }: Fingerprint): string => {
  const flags = [
    protection.brave ? 'Brave' : undefined,
    protection.globalPrivacyControl ? 'GPC signal' : undefined,
    protection.noisedComponents.length > 0 ? `noise in: ${protection.noisedComponents.join(', ')}` : undefined,
  ].filter((flag) => flag !== undefined);
  return `Fingerprinting protection: ${flags.length > 0 ? flags.join('; ') : 'none detected'}.`;
};

export const renderResult = (container: HTMLElement, fingerprint: Fingerprint, response: CollectResponse): void => {
  container.replaceChildren(
    element('p', `Visitor ID on this domain: ${response.visitorId.slice(0, SHORT_ID_LENGTH)}.`),
    element('p', `Token from the other domain: ${OUTCOME_LABELS[response.handoff]}.`),
    element('p', describeCandidate(response.bestCandidate)),
    element('p', describeProtection(fingerprint)),
    componentTable(fingerprint),
  );
};

export const renderError = (container: HTMLElement, error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  container.replaceChildren(element('p', `Could not collect the fingerprint: ${message}`));
};
