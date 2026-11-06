import type { Site } from '../config.ts';
import type { ConsentState } from '../http/cookies.ts';
import { html, type SafeHtml } from './html.ts';
import { layout } from './layout.ts';

export type ShopPageModel = {
  readonly site: Site;
  readonly otherSites: readonly Site[];
  readonly consent: ConsentState;
  readonly orderPlaced: boolean;
};

const CONSENT_LABELS: Readonly<Record<ConsentState, string>> = {
  unknown: 'Consent: no decision yet - the fingerprint is not being collected.',
  granted: 'Consent: granted.',
  denied: 'Consent: refused - the fingerprint is not being collected.',
};

const HIDDEN = html`hidden`;

const consentSection = (consent: ConsentState): SafeHtml => html`
<section class="card" aria-labelledby="consent-heading">
  <h2 id="consent-heading">Consent</h2>
  <p id="consent-status">${CONSENT_LABELS[consent]}</p>
  <div id="consent-banner" class="consent" ${consent === 'granted' && HIDDEN}>
    <p>This PoC collects a browser fingerprint and a visitor ID to test whether the same browser can be
      recognized on a second domain. The data stays local, in a SQLite file on this computer.</p>
    <button type="button" id="consent-grant">I agree</button>
    <button type="button" id="consent-deny" class="secondary">I do not agree</button>
  </div>
  <button type="button" id="consent-withdraw" class="secondary" ${consent !== 'granted' && HIDDEN}>Withdraw consent</button>
</section>`;

const navigationSection = (otherSites: readonly Site[]): SafeHtml => html`
<section class="card" aria-labelledby="navigation-heading">
  <h2 id="navigation-heading">Go to the other domain</h2>
  <p>A link with a token connects the visits deterministically. A plain link leaves only fingerprint matching.</p>
  <ul>
    ${otherSites.map(
      (other) => html`<li>
        <a href="/out?to=${other.id}">${other.name} - link with token</a>
        <a href="${other.origin}/">${other.name} - plain link</a>
      </li>`,
    )}
  </ul>
</section>`;

const orderSection = (orderPlaced: boolean): SafeHtml => html`
<section class="card" aria-labelledby="order-heading">
  <h2 id="order-heading">Test order</h2>
  ${orderPlaced && html`<p class="notice" role="status">Order saved. The e-mail address was stored only as an HMAC.</p>`}
  <form method="post" action="/order">
    <label for="order-email">E-mail</label>
    <input id="order-email" name="email" type="email" required maxlength="254" autocomplete="email">
    <button type="submit">Place test order</button>
  </form>
</section>`;

const fingerprintSection = html`
<section class="card" aria-labelledby="fingerprint-heading">
  <h2 id="fingerprint-heading">Browser fingerprint on this domain</h2>
  <div id="fingerprint-panel" aria-live="polite">
    <p>The fingerprint is collected only after consent is given.</p>
  </div>
</section>`;

export const shopPage = ({ site, otherSites, consent, orderPlaced }: ShopPageModel): SafeHtml =>
  layout(
    site,
    'Shop',
    consent,
    html`
      ${consentSection(consent)}
      ${fingerprintSection}
      ${navigationSection(otherSites)}
      ${orderSection(orderPlaced)}
      <script type="module" src="/static/js/client/main.js"></script>`,
  );
