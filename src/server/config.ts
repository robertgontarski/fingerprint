import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord } from '../shared/guards.ts';
import { isSiteId, type SiteId } from './domain/ids.ts';

export type SiteTheme = 'a' | 'b';

export type Site = {
  readonly id: SiteId;
  readonly name: string;
  readonly origin: string;
  readonly host: string;
  readonly theme: SiteTheme;
};

export type Secrets = { readonly handoffKey: Buffer; readonly emailKey: Buffer };

export type AppConfig = {
  readonly sites: readonly Site[];
  readonly listenHost: string;
  readonly port: number;
  readonly databasePath: string;
  readonly secrets: Secrets;
  readonly secureCookies: boolean;
};

const DEFAULT_PORT = 8080;
const SECRET_BYTES = 32;
const SECRETS_FILE = 'secrets.json';
const OWNER_ONLY = 0o600;

export const createSite = (id: string, name: string, origin: string, theme: SiteTheme): Site => {
  const url = new URL(origin);
  if (!isSiteId(id)) {
    throw new Error(`Invalid shop id: ${id}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Shop origin must use http or https: ${origin}`);
  }
  return { id, name, origin: url.origin, host: url.host, theme };
};

const parsePort = (raw: string | undefined): number => {
  const port = raw === undefined ? DEFAULT_PORT : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw ?? ''}`);
  }
  return port;
};

const readStoredSecrets = (path: string): Secrets | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }
  const stored: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isRecord(stored) || typeof stored['handoffKey'] !== 'string' || typeof stored['emailKey'] !== 'string') {
    throw new Error(`File ${path} has an unexpected format - delete it to generate new keys`);
  }
  return { handoffKey: Buffer.from(stored['handoffKey'], 'base64'), emailKey: Buffer.from(stored['emailKey'], 'base64') };
};

// why: keys live outside the code and survive restarts, so person ids and
// pending handoff tokens stay valid between runs of the PoC.
const loadSecrets = (dataDir: string): Secrets => {
  const path = join(dataDir, SECRETS_FILE);
  const stored = readStoredSecrets(path);
  if (stored !== undefined) {
    return stored;
  }
  const generated = { handoffKey: randomBytes(SECRET_BYTES), emailKey: randomBytes(SECRET_BYTES) };
  const serialized = { handoffKey: generated.handoffKey.toString('base64'), emailKey: generated.emailKey.toString('base64') };
  writeFileSync(path, JSON.stringify(serialized), { mode: OWNER_ONLY });
  return generated;
};

export const loadConfig = (env: NodeJS.ProcessEnv): AppConfig => {
  const port = parsePort(env['PORT']);
  const dataDir = env['DATA_DIR'] ?? 'data';
  mkdirSync(dataDir, { recursive: true });
  const sites = [
    createSite('shop-a', 'Shop A', env['SITE_A_ORIGIN'] ?? `http://localhost:${port}`, 'a'),
    createSite('shop-b', 'Shop B', env['SITE_B_ORIGIN'] ?? `http://127.0.0.1:${port}`, 'b'),
  ];
  return {
    sites,
    listenHost: env['HOST'] ?? '127.0.0.1',
    port,
    databasePath: join(dataDir, 'fingerprint.sqlite'),
    secrets: loadSecrets(dataDir),
    secureCookies: sites.every(({ origin }) => origin.startsWith('https:')),
  };
};
