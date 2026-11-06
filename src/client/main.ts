import type { CollectRequest } from '../shared/contract.ts';
import { postCollect, postConsent } from './api.ts';
import { collectFingerprint } from './collector.ts';
import { renderError, renderResult } from './page.ts';

const HANDOFF_PARAMETER = 'hid';

const requireElement = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) {
    throw new Error(`Missing element ${selector} on the page`);
  }
  return found;
};

// why: the token is read once and removed from the address bar before anything else runs,
// so it cannot leak through a copied link, and it stays in memory only until consent is decided.
const takeHandoffToken = (): string | undefined => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(HANDOFF_PARAMETER);
  if (token === null) {
    return undefined;
  }
  url.searchParams.delete(HANDOFF_PARAMETER);
  history.replaceState(null, '', url);
  return token;
};

const runCollection = async (panel: HTMLElement, handoffToken: string | undefined): Promise<void> => {
  panel.textContent = 'Collecting signals...';
  const fingerprint = await collectFingerprint();
  const request: CollectRequest = handoffToken === undefined ? fingerprint : { ...fingerprint, handoffToken };
  renderResult(panel, fingerprint, await postCollect(request));
};

const showGranted = (): void => {
  document.body.dataset['consent'] = 'granted';
  requireElement('#consent-banner').hidden = true;
  requireElement('#consent-withdraw').hidden = false;
  requireElement('#consent-status').textContent = 'Consent: granted.';
};

const grantConsent = async (panel: HTMLElement, handoffToken: string | undefined): Promise<void> => {
  await postConsent(true);
  showGranted();
  await runCollection(panel, handoffToken);
};

const refuseConsent = async (): Promise<void> => {
  await postConsent(false);
  window.location.reload();
};

const onClick = (selector: string, action: () => Promise<void>, panel: HTMLElement): void => {
  requireElement(selector).addEventListener('click', () => {
    action().catch((error: unknown) => renderError(panel, error));
  });
};

const start = (): void => {
  const handoffToken = takeHandoffToken();
  const panel = requireElement('#fingerprint-panel');
  onClick('#consent-grant', () => grantConsent(panel, handoffToken), panel);
  onClick('#consent-deny', refuseConsent, panel);
  onClick('#consent-withdraw', refuseConsent, panel);
  if (document.body.dataset['consent'] === 'granted') {
    runCollection(panel, handoffToken).catch((error: unknown) => renderError(panel, error));
  }
};

start();
