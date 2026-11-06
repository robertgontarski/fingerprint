import type { IncomingMessage } from 'node:http';

export class RequestError extends Error {
  override readonly name = 'RequestError';
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const JSON_LIMIT_BYTES = 64 * 1024;
const FORM_LIMIT_BYTES = 4 * 1024;

const readBody = async (request: IncomingMessage, limitBytes: number): Promise<string> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const data: unknown = chunk;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    size += buffer.length;
    if (size > limitBytes) {
      throw new RequestError(413, 'Request too large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const requireContentType = (request: IncomingMessage, expected: string): void => {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith(expected)) {
    throw new RequestError(415, `Expected ${expected}`);
  }
};

export const readJson = async (request: IncomingMessage): Promise<unknown> => {
  requireContentType(request, 'application/json');
  const body = await readBody(request, JSON_LIMIT_BYTES);
  try {
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new RequestError(400, 'Invalid JSON');
    }
    throw error;
  }
};

export const readForm = async (request: IncomingMessage): Promise<URLSearchParams> => {
  requireContentType(request, 'application/x-www-form-urlencoded');
  return new URLSearchParams(await readBody(request, FORM_LIMIT_BYTES));
};
