import { hashBytes, hashString } from '../hash.ts';
import type { RenderSignal } from './canvas.ts';

export type WebglSignals = {
  readonly vendor: string;
  readonly renderer: string;
  readonly parameters: string;
  readonly render: RenderSignal | undefined;
};

const RENDER_SIZE = 64;
const FLOATS_PER_VERTEX = 5;
const TRIANGLE = new Float32Array([-0.9, -0.7, 1, 0.2, 0.1, 0.8, -0.9, 0.1, 1, 0.3, 0.1, 0.95, 0.3, 0.2, 1]);
const VERTEX_SOURCE =
  'attribute vec2 position; attribute vec3 color; varying vec3 vColor;' +
  'void main() { vColor = color; gl_Position = vec4(position, 0.0, 1.0); }';
const FRAGMENT_SOURCE =
  'precision mediump float; varying vec3 vColor;' +
  'void main() { gl_FragColor = vec4(vColor * vec3(0.71, 0.53, 0.97), 0.87); }';

const PARAMETER_NAMES = [
  'MAX_TEXTURE_SIZE',
  'MAX_RENDERBUFFER_SIZE',
  'MAX_VERTEX_ATTRIBS',
  'MAX_VERTEX_UNIFORM_VECTORS',
  'MAX_FRAGMENT_UNIFORM_VECTORS',
  'MAX_VARYING_VECTORS',
  'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
  'MAX_TEXTURE_IMAGE_UNITS',
  'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
  'MAX_CUBE_MAP_TEXTURE_SIZE',
  'ALIASED_LINE_WIDTH_RANGE',
  'ALIASED_POINT_SIZE_RANGE',
  'MAX_VIEWPORT_DIMS',
] as const satisfies ReadonlyArray<keyof WebGLRenderingContext>;

const PRECISIONS = ['LOW_FLOAT', 'MEDIUM_FLOAT', 'HIGH_FLOAT', 'LOW_INT', 'MEDIUM_INT', 'HIGH_INT'] as const;

const formatParameter = (value: unknown): string =>
  ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength).join('.') : String(value);

const describeParameters = (gl: WebGLRenderingContext): string => {
  const parameters = PARAMETER_NAMES.map((name) => `${name}=${formatParameter(gl.getParameter(gl[name]))}`);
  const precisions = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].flatMap((shader) =>
    PRECISIONS.map((precision) => {
      const format = gl.getShaderPrecisionFormat(shader, gl[precision]);
      return format === null ? 'none' : `${format.rangeMin},${format.rangeMax},${format.precision}`;
    }),
  );
  const extensions = [...(gl.getSupportedExtensions() ?? [])].sort();
  return hashString([...parameters, ...precisions, ...extensions].join(';'));
};

const compile = (gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true ? shader : null;
};

const linkProgram = (gl: WebGLRenderingContext): WebGLProgram | null => {
  const program = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  if (program === null || vertex === null || fragment === null) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) === true ? program : null;
};

const bindAttribute = (gl: WebGLRenderingContext, program: WebGLProgram, name: string, size: number, offset: number): void => {
  const location = gl.getAttribLocation(program, name);
  const stride = FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * Float32Array.BYTES_PER_ELEMENT);
};

const readPixels = (gl: WebGLRenderingContext): Uint8Array => {
  const pixels = new Uint8Array(RENDER_SIZE * RENDER_SIZE * 4);
  gl.readPixels(0, 0, RENDER_SIZE, RENDER_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
};

const renderTriangle = (gl: WebGLRenderingContext): string | undefined => {
  const program = linkProgram(gl);
  if (program === null) {
    return undefined;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, TRIANGLE, gl.STATIC_DRAW);
  bindAttribute(gl, program, 'position', 2, 0);
  bindAttribute(gl, program, 'color', 3, 2);
  gl.viewport(0, 0, RENDER_SIZE, RENDER_SIZE);
  gl.clearColor(0.1, 0.1, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return hashBytes(readPixels(gl));
};

const failsKnownAnswer = (gl: WebGLRenderingContext): boolean => {
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixels = readPixels(gl);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset] !== 255 || pixels[offset + 1] !== 0 || pixels[offset + 2] !== 0 || pixels[offset + 3] !== 255) {
      return true;
    }
  }
  return false;
};

const collectRender = (gl: WebGLRenderingContext): RenderSignal | undefined => {
  const first = renderTriangle(gl);
  if (first === undefined) {
    return undefined;
  }
  const second = renderTriangle(gl);
  return { value: first, noised: first !== second || failsKnownAnswer(gl) };
};

export const collectWebgl = (): WebglSignals | undefined => {
  const canvas = document.createElement('canvas');
  canvas.width = RENDER_SIZE;
  canvas.height = RENDER_SIZE;
  const gl = canvas.getContext('webgl');
  if (gl === null) {
    return undefined;
  }
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    vendor: String(gl.getParameter(debugInfo?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR)),
    renderer: String(gl.getParameter(debugInfo?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)),
    parameters: describeParameters(gl),
    render: collectRender(gl),
  };
};
