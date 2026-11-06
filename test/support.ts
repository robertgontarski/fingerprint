import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer, request, type IncomingHttpHeaders } from 'node:http';
import type { Components, ProtectionReport } from '../src/shared/contract.ts';
import { createRequestListener } from '../src/server/app.ts';
import { createSite, type AppConfig } from '../src/server/config.ts';
import { createRepository } from '../src/server/db/repository.ts';
import { openDatabase } from '../src/server/db/schema.ts';
import { silentLogger } from '../src/server/logger.ts';

export const SITE_A = 'http://shop-a.test';
export const SITE_B = 'http://shop-b.test';

export type TestServer = {
  readonly port: number;
  readonly advanceClock: (milliseconds: number) => void;
  readonly close: () => Promise<void>;
};

export type TestResponse = { readonly status: number; readonly headers: IncomingHttpHeaders; readonly body: string };

export type SendOptions = {
  readonly method?: 'GET' | 'POST';
  readonly json?: unknown;
  readonly form?: Readonly<Record<string, string>>;
  readonly sendOrigin?: boolean;
  readonly host?: string;
};

export const startTestServer = async (): Promise<TestServer> => {
  let now = Date.parse('2026-11-03T10:00:00Z');
  const clock = (): Date => new Date(now);
  const config: AppConfig = {
    sites: [createSite('shop-a', 'Shop A', SITE_A, 'a'), createSite('shop-b', 'Shop B', SITE_B, 'b')],
    listenHost: '127.0.0.1',
    port: 0,
    databasePath: ':memory:',
    secrets: { handoffKey: randomBytes(32), emailKey: randomBytes(32) },
    secureCookies: false,
  };
  const database = openDatabase(':memory:');
  const repository = createRepository(database, clock);
  const server = createServer(createRequestListener({ config, repository, logger: silentLogger, clock }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port');
  }
  return {
    port: address.port,
    advanceClock: (milliseconds) => {
      now += milliseconds;
    },
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
      database.close();
    },
  };
};

const encodeBody = ({ json, form }: SendOptions): { body?: string; contentType?: string } => {
  if (json !== undefined) {
    return { body: JSON.stringify(json), contentType: 'application/json' };
  }
  if (form !== undefined) {
    return { body: new URLSearchParams(form).toString(), contentType: 'application/x-www-form-urlencoded' };
  }
  return {};
};

export class TestBrowser {
  private readonly port: number;
  private readonly jars = new Map<string, Map<string, string>>();

  constructor(port: number) {
    this.port = port;
  }

  async send(origin: string, path: string, options: SendOptions = {}): Promise<TestResponse> {
    const method = options.method ?? (options.json === undefined && options.form === undefined ? 'GET' : 'POST');
    const { body, contentType } = encodeBody(options);
    const headers: Record<string, string> = { host: options.host ?? new URL(origin).host, cookie: this.cookieHeader(origin) };
    if (contentType !== undefined) {
      headers['content-type'] = contentType;
    }
    if (method === 'POST' && options.sendOrigin !== false) {
      headers['origin'] = origin;
    }
    const response = await this.exchange(method, path, headers, body);
    this.store(origin, response.headers['set-cookie'] ?? []);
    return response;
  }

  private exchange(method: string, path: string, headers: Record<string, string>, body: string | undefined): Promise<TestResponse> {
    return new Promise((resolve, reject) => {
      const outgoing = request({ host: '127.0.0.1', port: this.port, method, path, headers, agent: false }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
        incoming.on('end', () =>
          resolve({ status: incoming.statusCode ?? 0, headers: incoming.headers, body: Buffer.concat(chunks).toString('utf8') }),
        );
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  }

  private cookieHeader(origin: string): string {
    return [...(this.jars.get(origin) ?? new Map<string, string>()).entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  private store(origin: string, setCookies: readonly string[]): void {
    const jar = this.jars.get(origin) ?? new Map<string, string>();
    for (const line of setCookies) {
      const [pair = ''] = line.split(';');
      const [name = '', value = ''] = pair.split('=');
      if (line.includes('Max-Age=0')) {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    }
    this.jars.set(origin, jar);
  }
}

export const sampleFingerprint = (
  overrides: Components = {},
  protection: Partial<ProtectionReport> = {},
): { readonly components: Components; readonly protection: ProtectionReport } => ({
  components: {
    userAgent: 'Mozilla/5.0 (Macintosh) TestBrowser/1.0',
    platform: 'MacIntel',
    languages: 'en-GB,en',
    timezone: 'Europe/London',
    screen: '1512x982x30',
    hardwareConcurrency: '10',
    webglRenderer: 'Apple M3',
    fonts: 'Arial,Helvetica,Menlo',
    canvas: '00aa11bb22cc33',
    audio: '124.04347527516074',
    ...overrides,
  },
  protection: { noisedComponents: [], brave: false, globalPrivacyControl: false, ...protection },
});
