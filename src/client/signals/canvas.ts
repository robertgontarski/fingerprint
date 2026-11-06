import { hashString } from '../hash.ts';

export type RenderSignal = { readonly value: string; readonly noised: boolean };

type Rgb = readonly [number, number, number];

const SCENE_WIDTH = 280;
const SCENE_HEIGHT = 60;
const PROBE_SIZE = 4;
const PROBE_LEFT: Rgb = [255, 0, 0];
const PROBE_RIGHT: Rgb = [0, 0, 255];
const OPAQUE = 255;
const CIRCLES: ReadonlyArray<readonly [string, number]> = [
  ['#f2f', 40],
  ['#2ff', 80],
  ['#ff2', 60],
];

const createContext = (width: number, height: number): CanvasRenderingContext2D | null => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d', { willReadFrequently: true });
};

const drawScene = (context: CanvasRenderingContext2D): void => {
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#f60';
  context.fillRect(125, 1, 62, 20);
  context.fillStyle = '#069';
  context.font = '15px "Times New Roman"';
  context.fillText('Sphinx of black quartz \u{1F603} <canvas> 1.0', 2, 15);
  context.fillStyle = 'rgba(102, 204, 0, 0.7)';
  context.font = '18px Arial';
  context.fillText('Cwm fjordbank glyphs vext quiz', 4, 45);
  context.globalCompositeOperation = 'multiply';
  for (const [color, x] of CIRCLES) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, 40, 20, 0, Math.PI * 2, true);
    context.closePath();
    context.fill();
  }
};

const renderScene = (): string | undefined => {
  const context = createContext(SCENE_WIDTH, SCENE_HEIGHT);
  if (context === null) {
    return undefined;
  }
  drawScene(context);
  return context.canvas.toDataURL();
};

const pixelMatches = (pixels: Uint8ClampedArray, offset: number, [red, green, blue]: Rgb): boolean =>
  pixels[offset] === red &&
  pixels[offset + 1] === green &&
  pixels[offset + 2] === blue &&
  pixels[offset + 3] === OPAQUE;

// why: integer-aligned solid rectangles render to exact colours in every engine,
// so any deviation on readback means the browser deliberately adds noise.
const failsKnownAnswer = (): boolean => {
  const context = createContext(PROBE_SIZE * 2, PROBE_SIZE);
  if (context === null) {
    return true;
  }
  context.fillStyle = `rgb(${PROBE_LEFT.join(',')})`;
  context.fillRect(0, 0, PROBE_SIZE, PROBE_SIZE);
  context.fillStyle = `rgb(${PROBE_RIGHT.join(',')})`;
  context.fillRect(PROBE_SIZE, 0, PROBE_SIZE, PROBE_SIZE);
  const pixels = context.getImageData(0, 0, PROBE_SIZE * 2, PROBE_SIZE).data;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const column = (offset / 4) % (PROBE_SIZE * 2);
    if (!pixelMatches(pixels, offset, column < PROBE_SIZE ? PROBE_LEFT : PROBE_RIGHT)) {
      return true;
    }
  }
  return false;
};

export const collectCanvas = (): RenderSignal | undefined => {
  const first = renderScene();
  if (first === undefined) {
    return undefined;
  }
  const second = renderScene();
  return { value: hashString(first), noised: first !== second || failsKnownAnswer() };
};
