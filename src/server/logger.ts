export type LogFields = Readonly<Record<string, string | number | boolean | undefined>>;

export type Logger = {
  readonly info: (event: string, fields?: LogFields) => void;
  readonly warn: (event: string, fields?: LogFields) => void;
  readonly error: (event: string, fields?: LogFields) => void;
};

type Level = 'info' | 'warn' | 'error';

// why: one JSON object per line - JSON escaping keeps CR/LF from user-controlled
// values out of the log stream, so nobody can forge extra log lines.
export const createJsonLogger = (write: (line: string) => void): Logger => {
  const emit = (level: Level, event: string, fields: LogFields = {}): void => {
    write(`${JSON.stringify({ time: new Date().toISOString(), level, event, ...fields })}\n`);
  };
  return {
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
  };
};

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
