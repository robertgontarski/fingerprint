import type { ComponentName, Components, MutableComponents, ProtectionReport } from '../shared/contract.ts';
import { collectMediaDevices, collectUaHighEntropy, collectVoices } from './signals/async-apis.ts';
import { collectAudio } from './signals/audio.ts';
import { collectCanvas, type RenderSignal } from './signals/canvas.ts';
import { collectEnvironment, isBrave, sendsGlobalPrivacyControl } from './signals/environment.ts';
import { collectFonts } from './signals/fonts.ts';
import { collectWebgl } from './signals/webgl.ts';

export type Fingerprint = { readonly components: Components; readonly protection: ProtectionReport };

type Collection = { readonly components: MutableComponents; readonly noised: ComponentName[] };

const describeError = (error: unknown): string => `error:${error instanceof Error ? error.name : 'unknown'}`;

const storeRender = (collection: Collection, name: ComponentName, signal: RenderSignal | undefined): void => {
  if (signal === undefined) {
    return;
  }
  collection.components[name] = signal.value;
  if (signal.noised) {
    collection.noised.push(name);
  }
};

const record = (collection: Collection, name: ComponentName, read: () => string | undefined): void => {
  try {
    const value = read();
    if (value !== undefined) {
      collection.components[name] = value;
    }
  } catch (error) {
    collection.components[name] = describeError(error);
  }
};

const recordAsync = async (
  collection: Collection,
  name: ComponentName,
  read: () => Promise<string | undefined>,
): Promise<void> => {
  try {
    const value = await read();
    if (value !== undefined) {
      collection.components[name] = value;
    }
  } catch (error) {
    collection.components[name] = describeError(error);
  }
};

const recordCanvas = (collection: Collection): void => {
  try {
    storeRender(collection, 'canvas', collectCanvas());
  } catch (error) {
    collection.components.canvas = describeError(error);
  }
};

const recordAudio = async (collection: Collection): Promise<void> => {
  try {
    storeRender(collection, 'audio', await collectAudio());
  } catch (error) {
    collection.components.audio = describeError(error);
  }
};

const recordWebgl = (collection: Collection): void => {
  try {
    const webgl = collectWebgl();
    if (webgl === undefined) {
      return;
    }
    collection.components.webglVendor = webgl.vendor;
    collection.components.webglRenderer = webgl.renderer;
    collection.components.webglParameters = webgl.parameters;
    storeRender(collection, 'webglRender', webgl.render);
  } catch (error) {
    collection.components.webglRenderer = describeError(error);
  }
};

export const collectFingerprint = async (): Promise<Fingerprint> => {
  const collection: Collection = { components: {}, noised: [] };
  collectEnvironment(collection.components);
  recordCanvas(collection);
  recordWebgl(collection);
  record(collection, 'fonts', collectFonts);
  await Promise.all([
    recordAudio(collection),
    recordAsync(collection, 'voices', collectVoices),
    recordAsync(collection, 'mediaDevices', collectMediaDevices),
    recordAsync(collection, 'uaHighEntropy', collectUaHighEntropy),
  ]);
  return {
    components: collection.components,
    protection: {
      noisedComponents: collection.noised,
      brave: isBrave(),
      globalPrivacyControl: sendsGlobalPrivacyControl(),
    },
  };
};
