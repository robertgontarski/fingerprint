export type SafeHtml = { readonly html: string; readonly safe: true };

type Interpolation = string | number | SafeHtml | readonly SafeHtml[] | null | undefined | false;

const ESCAPES: ReadonlyMap<string, string> = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES.get(char) ?? char);

const isSafeHtml = (value: SafeHtml | readonly SafeHtml[]): value is SafeHtml => 'safe' in value;

const render = (value: Interpolation): string => {
  if (value === null || value === undefined || value === false) {
    return '';
  }
  if (typeof value === 'string') {
    return escapeHtml(value);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return isSafeHtml(value) ? value.html : value.map((item) => item.html).join('');
};

export const html = (strings: TemplateStringsArray, ...values: readonly Interpolation[]): SafeHtml => ({
  safe: true,
  html: strings.reduce((output, chunk, index) => output + chunk + render(values[index]), ''),
});
