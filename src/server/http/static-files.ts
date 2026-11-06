import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { textReply, type Reply } from './reply.ts';

const PUBLIC_DIR = resolve(import.meta.dirname, '../../../public');
const STATIC_PREFIX = '/static/';
const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
]);

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'EISDIR');

export const isStaticPath = (pathname: string): boolean => pathname.startsWith(STATIC_PREFIX);

export const serveStatic = async (pathname: string): Promise<Reply> => {
  const absolute = resolve(PUBLIC_DIR, pathname.slice(STATIC_PREFIX.length));
  const contentType = CONTENT_TYPES.get(extname(absolute));
  if (!absolute.startsWith(PUBLIC_DIR + sep) || contentType === undefined) {
    return textReply(404, 'Not found');
  }
  try {
    return { status: 200, contentType, body: await readFile(absolute) };
  } catch (error) {
    if (isMissingFile(error)) {
      return textReply(404, 'Not found');
    }
    throw error;
  }
};
