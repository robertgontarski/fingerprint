const BASE_FONTS = ['monospace', 'sans-serif', 'serif'] as const;
const SAMPLE_TEXT = 'mmMwWLliI0fiflO&1';
const SAMPLE_SIZE = '72px';
const CANDIDATE_FONTS = [
  'American Typewriter',
  'Andale Mono',
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Avenir',
  'Avenir Next',
  'Baskerville',
  'Calibri',
  'Cambria',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Courier New',
  'DejaVu Sans',
  'Didot',
  'Fira Sans',
  'Futura',
  'Georgia',
  'Gill Sans',
  'Helvetica',
  'Helvetica Neue',
  'Hiragino Sans',
  'Impact',
  'Liberation Sans',
  'Lucida Console',
  'Lucida Grande',
  'Menlo',
  'Microsoft Sans Serif',
  'Monaco',
  'MS Gothic',
  'Noto Sans',
  'Open Sans',
  'Optima',
  'Palatino',
  'PingFang SC',
  'Roboto',
  'Segoe UI',
  'SimSun',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Ubuntu',
  'Verdana',
] as const;

const measure = (context: CanvasRenderingContext2D, fontFamily: string): number => {
  context.font = `${SAMPLE_SIZE} ${fontFamily}`;
  return context.measureText(SAMPLE_TEXT).width;
};

export const collectFonts = (): string | undefined => {
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) {
    return undefined;
  }
  const baseWidths = BASE_FONTS.map((base) => measure(context, base));
  const isInstalled = (font: string): boolean =>
    BASE_FONTS.some((base, index) => measure(context, `"${font}", ${base}`) !== baseWidths[index]);
  return CANDIDATE_FONTS.filter(isInstalled).join(',');
};
