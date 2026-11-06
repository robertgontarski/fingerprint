import type { IncomingMessage } from 'node:http';
import type { CollectRequest, CollectResponse, HandoffOutcome } from '../shared/contract.ts';
import type { AppConfig, Site } from './config.ts';
import type { Repository } from './db/repository.ts';
import { mintHandoffToken, verifyHandoffToken } from './domain/handoff.ts';
import { isVisitorId, newVisitorId, parseEmailAddress, personIdFor, type VisitorId } from './domain/ids.ts';
import { fullKeyOf, stableKeyOf } from './domain/similarity.ts';
import {
  consentCookie,
  consentOf,
  expiredVisitorCookie,
  visitorCookie,
  VISITOR_COOKIE,
  type CookieJar,
} from './http/cookies.ts';
import { htmlReply, jsonReply, noContentReply, redirectReply, type Reply } from './http/reply.ts';
import { readForm, readJson, RequestError } from './http/request.ts';
import { bestCandidateFor, buildLabModel, loadLabData } from './lab.ts';
import type { Logger } from './logger.ts';
import { parseCollectRequest, parseConsentRequest } from './payload.ts';
import { labPage } from './views/lab-page.ts';
import { shopPage } from './views/shop-page.ts';

export type Dependencies = {
  readonly config: AppConfig;
  readonly repository: Repository;
  readonly logger: Logger;
  readonly clock: () => Date;
};

export type RequestContext = {
  readonly site: Site;
  readonly url: URL;
  readonly cookies: CookieJar;
  readonly request: IncomingMessage;
};

const HANDOFF_PARAMETER = 'hid';
const ORDER_PLACED_PARAMETER = 'order-placed';

const requireSameOrigin = ({ request, site }: RequestContext): void => {
  if (request.headers.origin !== site.origin) {
    throw new RequestError(403, 'Rejected a request from another origin');
  }
};

const knownVisitor = ({ cookies, site }: RequestContext, { repository }: Dependencies): VisitorId | undefined => {
  const candidate = cookies.get(VISITOR_COOKIE);
  if (candidate === undefined || !isVisitorId(candidate)) {
    return undefined;
  }
  return repository.findVisitor(candidate)?.site === site.id ? candidate : undefined;
};

const consentedVisitor = (context: RequestContext, dependencies: Dependencies): VisitorId | undefined =>
  consentOf(context.cookies) === 'granted' ? knownVisitor(context, dependencies) : undefined;

export const showShop = (context: RequestContext, { config }: Dependencies): Reply =>
  htmlReply(
    shopPage({
      site: context.site,
      otherSites: config.sites.filter(({ id }) => id !== context.site.id),
      consent: consentOf(context.cookies),
      orderPlaced: context.url.searchParams.has(ORDER_PLACED_PARAMETER),
    }),
  );

export const showLab = (context: RequestContext, { repository }: Dependencies): Reply =>
  htmlReply(labPage(context.site, consentOf(context.cookies), buildLabModel(loadLabData(repository))));

export const recordConsent = async (context: RequestContext, dependencies: Dependencies): Promise<Reply> => {
  requireSameOrigin(context);
  const granted = parseConsentRequest(await readJson(context.request));
  const secure = dependencies.config.secureCookies;
  if (granted === undefined) {
    throw new RequestError(400, 'Invalid consent data');
  }
  if (!granted) {
    return noContentReply([consentCookie('denied', secure), expiredVisitorCookie(secure)]);
  }
  const visitorId = knownVisitor(context, dependencies) ?? newVisitorId();
  dependencies.repository.ensureVisitor(visitorId, context.site.id);
  return noContentReply([consentCookie('granted', secure), visitorCookie(visitorId, secure)]);
};

const redeemHandoff = (token: string | undefined, visitorId: VisitorId, site: Site, dependencies: Dependencies): HandoffOutcome => {
  if (token === undefined) {
    return 'absent';
  }
  const { config, repository, clock } = dependencies;
  const verification = verifyHandoffToken(token, site.id, config.secrets.handoffKey, clock().getTime());
  if (!verification.ok) {
    return verification.reason;
  }
  if (!repository.claimHandoffToken(verification.claims.tokenId)) {
    return 'reused';
  }
  const source = repository.findVisitor(verification.claims.visitorId);
  if (source === undefined || source.site !== verification.claims.source) {
    return 'malformed';
  }
  repository.linkVisitors(source.id, visitorId);
  return 'linked';
};

const storeCollection = (payload: CollectRequest, visitorId: VisitorId, context: RequestContext, dependencies: Dependencies) =>
  dependencies.repository.transaction(() => ({
    observationId: dependencies.repository.addObservation({
      visitorId,
      site: context.site.id,
      components: payload.components,
      noisedComponents: payload.protection.noisedComponents,
      brave: payload.protection.brave,
      stableKey: stableKeyOf(payload.components),
      fullKey: fullKeyOf(payload.components),
    }),
    handoff: redeemHandoff(payload.handoffToken, visitorId, context.site, dependencies),
  }));

export const recordCollection = async (context: RequestContext, dependencies: Dependencies): Promise<Reply> => {
  requireSameOrigin(context);
  const payload = parseCollectRequest(await readJson(context.request));
  if (payload === undefined) {
    throw new RequestError(400, 'Invalid fingerprint');
  }
  const visitorId = consentedVisitor(context, dependencies);
  if (visitorId === undefined) {
    throw new RequestError(403, 'No consent or unknown visitor');
  }
  const { observationId, handoff } = storeCollection(payload, visitorId, context, dependencies);
  dependencies.logger.info('observation-stored', { site: context.site.id, observationId, handoff });
  const response: CollectResponse = {
    visitorId,
    observationId,
    handoff,
    bestCandidate: bestCandidateFor(visitorId, loadLabData(dependencies.repository)),
  };
  return jsonReply(response);
};

export const leaveForSite = (context: RequestContext, dependencies: Dependencies): Reply => {
  const destination = dependencies.config.sites.find(({ id }) => id === context.url.searchParams.get('to'));
  if (destination === undefined || destination.id === context.site.id) {
    throw new RequestError(400, 'Unknown destination domain');
  }
  const visitorId = consentedVisitor(context, dependencies);
  if (visitorId === undefined) {
    return redirectReply(`${destination.origin}/`, 302);
  }
  const request = { source: context.site.id, destination: destination.id, visitorId };
  const token = mintHandoffToken(request, dependencies.config.secrets.handoffKey, dependencies.clock().getTime());
  return redirectReply(`${destination.origin}/?${HANDOFF_PARAMETER}=${encodeURIComponent(token)}`, 302);
};

export const placeOrder = async (context: RequestContext, dependencies: Dependencies): Promise<Reply> => {
  requireSameOrigin(context);
  const email = parseEmailAddress((await readForm(context.request)).get('email') ?? '');
  if (email === undefined) {
    throw new RequestError(400, 'Invalid e-mail address');
  }
  const personId = personIdFor(email, dependencies.config.secrets.emailKey);
  const visitorId = consentedVisitor(context, dependencies);
  const { repository } = dependencies;
  repository.transaction(() => {
    repository.addOrder(context.site.id, personId, visitorId ?? null);
    if (visitorId !== undefined) {
      repository.linkPerson(visitorId, personId);
    }
  });
  dependencies.logger.info('order-placed', { site: context.site.id, linkedToVisit: visitorId !== undefined });
  return redirectReply(`/?${ORDER_PLACED_PARAMETER}=1`, 303);
};
