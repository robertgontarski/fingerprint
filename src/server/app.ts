import { randomUUID } from 'node:crypto';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { Site } from './config.ts';
import {
  leaveForSite,
  placeOrder,
  recordCollection,
  recordConsent,
  showLab,
  showShop,
  type Dependencies,
  type RequestContext,
} from './handlers.ts';
import { parseCookies } from './http/cookies.ts';
import { textReply, writeReply, type Reply } from './http/reply.ts';
import { RequestError } from './http/request.ts';
import { isStaticPath, serveStatic } from './http/static-files.ts';

type Handler = (context: RequestContext, dependencies: Dependencies) => Reply | Promise<Reply>;

const ROUTES: ReadonlyMap<string, Handler> = new Map<string, Handler>([
  ['GET /', showShop],
  ['GET /lab', showLab],
  ['GET /out', leaveForSite],
  ['POST /api/consent', recordConsent],
  ['POST /api/collect', recordCollection],
  ['POST /order', placeOrder],
]);

const siteForHost = (host: string | undefined, sites: readonly Site[]): Site | undefined =>
  sites.find((site) => site.host === host?.toLowerCase());

const route = async (request: IncomingMessage, dependencies: Dependencies): Promise<Reply> => {
  const site = siteForHost(request.headers.host, dependencies.config.sites);
  if (site === undefined) {
    return textReply(421, 'Unknown domain');
  }
  const url = new URL(request.url ?? '/', site.origin);
  const method = request.method ?? 'GET';
  if (method === 'GET' && isStaticPath(url.pathname)) {
    return serveStatic(url.pathname);
  }
  const handler = ROUTES.get(`${method} ${url.pathname}`);
  if (handler === undefined) {
    return textReply(404, 'Not found');
  }
  return handler({ site, url, cookies: parseCookies(request.headers.cookie), request }, dependencies);
};

const failureReply = (error: unknown, dependencies: Dependencies): Reply => {
  if (error instanceof RequestError) {
    return textReply(error.status, error.message);
  }
  const correlationId = randomUUID();
  const message = error instanceof Error ? error.message : 'unknown error';
  dependencies.logger.error('request-failed', { correlationId, message });
  return textReply(500, `Internal server error (id: ${correlationId})`);
};

export const createRequestListener = (dependencies: Dependencies): RequestListener => {
  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const reply = await route(request, dependencies).catch((error: unknown) => failureReply(error, dependencies));
    writeReply(response, reply, dependencies.config.secureCookies);
  };
  return (request, response) => {
    handle(request, response).catch((error: unknown) => {
      dependencies.logger.error('response-failed', { message: error instanceof Error ? error.message : 'unknown error' });
      response.destroy();
    });
  };
};
