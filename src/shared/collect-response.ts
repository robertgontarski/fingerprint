import { HANDOFF_OUTCOMES, type CandidateSummary, type CollectResponse, type HandoffOutcome } from './contract.ts';
import { isRecord } from './guards.ts';

const isHandoffOutcome = (value: unknown): value is HandoffOutcome =>
  HANDOFF_OUTCOMES.some((outcome) => outcome === value);

const parseCandidate = (value: unknown): CandidateSummary | null | undefined => {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const { site, visitorId, score, sameIdentity } = value;
  if (typeof site !== 'string' || typeof visitorId !== 'string' || typeof score !== 'number') {
    return undefined;
  }
  if (sameIdentity !== null && typeof sameIdentity !== 'boolean') {
    return undefined;
  }
  return { site, visitorId, score, sameIdentity };
};

export const parseCollectResponse = (value: unknown): CollectResponse | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { visitorId, observationId, handoff } = value;
  const bestCandidate = parseCandidate(value['bestCandidate']);
  if (typeof visitorId !== 'string' || typeof observationId !== 'number' || !isHandoffOutcome(handoff)) {
    return undefined;
  }
  if (bestCandidate === undefined) {
    return undefined;
  }
  return { visitorId, observationId, handoff, bestCandidate };
};
