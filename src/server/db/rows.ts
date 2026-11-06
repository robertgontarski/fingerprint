import { isRecord, type UnknownRecord } from '../../shared/guards.ts';

export class DataIntegrityError extends Error {
  override readonly name = 'DataIntegrityError';
}

export const asRow = (value: unknown): UnknownRecord => {
  if (!isRecord(value)) {
    throw new DataIntegrityError('Database returned a row that is not an object');
  }
  return value;
};

export const text = (row: UnknownRecord, column: string): string => {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new DataIntegrityError(`Column ${column} is not text`);
  }
  return value;
};

export const integer = (row: UnknownRecord, column: string): number => {
  const value = row[column];
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new DataIntegrityError(`Column ${column} is not an integer`);
  }
  return value;
};

export const branded = <Brand extends string>(
  row: UnknownRecord,
  column: string,
  guard: (value: string) => value is Brand,
): Brand => {
  const value = text(row, column);
  if (!guard(value)) {
    throw new DataIntegrityError(`Column ${column} holds an unexpected identifier`);
  }
  return value;
};

export const parsedJson = <Parsed>(row: UnknownRecord, column: string, parse: (value: unknown) => Parsed | undefined): Parsed => {
  const parsed = parse(JSON.parse(text(row, column)));
  if (parsed === undefined) {
    throw new DataIntegrityError(`Column ${column} holds unexpected JSON`);
  }
  return parsed;
};
