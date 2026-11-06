import { parseCollectResponse } from '../shared/collect-response.ts';
import type { CollectRequest, CollectResponse } from '../shared/contract.ts';

const REQUEST_TIMEOUT_MS = 5000;

const postJson = async (path: string, body: unknown): Promise<Response> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${path} responded with status ${response.status}`);
  }
  return response;
};

export const postConsent = async (granted: boolean): Promise<void> => {
  await postJson('/api/consent', { granted });
};

export const postCollect = async (request: CollectRequest): Promise<CollectResponse> => {
  const response = await postJson('/api/collect', request);
  const parsed = parseCollectResponse(await response.json());
  if (parsed === undefined) {
    throw new Error('/api/collect returned a response in an unexpected format');
  }
  return parsed;
};
