import type { ServerResponse } from 'node:http';
import type { SafeHtml } from '../views/html.ts';

export type Reply = {
  readonly status: number;
  readonly contentType?: string;
  readonly body?: string | Buffer;
  readonly location?: string;
  readonly cookies?: readonly string[];
};

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  [
    'content-security-policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; " +
      "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  ],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'same-origin'],
  ['cache-control', 'no-store'],
];

export const htmlReply = (page: SafeHtml): Reply => ({
  status: 200,
  contentType: 'text/html; charset=utf-8',
  body: page.html,
});

export const jsonReply = (value: unknown): Reply => ({
  status: 200,
  contentType: 'application/json; charset=utf-8',
  body: JSON.stringify(value),
});

export const textReply = (status: number, message: string): Reply => ({
  status,
  contentType: 'text/plain; charset=utf-8',
  body: message,
});

export const redirectReply = (location: string, status: 302 | 303): Reply => ({ status, location });

export const noContentReply = (cookies: readonly string[]): Reply => ({ status: 204, cookies });

export const writeReply = (response: ServerResponse, reply: Reply, overHttps: boolean): void => {
  response.statusCode = reply.status;
  SECURITY_HEADERS.forEach(([name, value]) => response.setHeader(name, value));
  if (overHttps) {
    response.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
  if (reply.contentType !== undefined) {
    response.setHeader('content-type', reply.contentType);
  }
  if (reply.location !== undefined) {
    response.setHeader('location', reply.location);
  }
  if (reply.cookies !== undefined && reply.cookies.length > 0) {
    response.setHeader('set-cookie', [...reply.cookies]);
  }
  response.end(reply.body);
};
