import { hashString } from '../hash.ts';
import { withTimeout } from '../timeout.ts';

const VOICES_TIMEOUT_MS = 800;
const HIGH_ENTROPY_HINTS = ['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList'] as const;

const loadVoices = async (): Promise<readonly SpeechSynthesisVoice[]> => {
  if (typeof speechSynthesis === 'undefined') {
    return [];
  }
  const immediate = speechSynthesis.getVoices();
  if (immediate.length > 0) {
    return immediate;
  }
  const announced = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
  });
  return (await withTimeout(announced, VOICES_TIMEOUT_MS)) ?? [];
};

export const collectVoices = async (): Promise<string | undefined> => {
  const voices = await loadVoices();
  if (voices.length === 0) {
    return undefined;
  }
  const description = voices
    .map((voice) => `${voice.name}|${voice.lang}|${voice.localService}`)
    .sort()
    .join(';');
  return `${voices.length}:${hashString(description)}`;
};

export const collectMediaDevices = async (): Promise<string | undefined> => {
  if (navigator.mediaDevices === undefined) {
    return undefined;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const counts = new Map<string, number>();
  for (const device of devices) {
    counts.set(device.kind, (counts.get(device.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}=${count}`)
    .join(';');
};

export const collectUaHighEntropy = async (): Promise<string | undefined> => {
  const userAgentData: unknown = Reflect.get(navigator, 'userAgentData');
  if (typeof userAgentData !== 'object' || userAgentData === null) {
    return undefined;
  }
  const getHighEntropyValues: unknown = Reflect.get(userAgentData, 'getHighEntropyValues');
  if (typeof getHighEntropyValues !== 'function') {
    return undefined;
  }
  const values: unknown = await Reflect.apply(getHighEntropyValues, userAgentData, [[...HIGH_ENTROPY_HINTS]]);
  if (typeof values !== 'object' || values === null) {
    return undefined;
  }
  return JSON.stringify(HIGH_ENTROPY_HINTS.map((hint): [string, unknown] => [hint, Reflect.get(values, hint)]));
};
