export type UnknownRecord = { readonly [key: string]: unknown };

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
