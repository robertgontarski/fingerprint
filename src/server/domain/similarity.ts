import { createHash } from 'node:crypto';
import { COMPONENT_NAMES, type ComponentName, type Components } from '../../shared/contract.ts';

export type FingerprintSample = {
  readonly components: Components;
  readonly noisedComponents: readonly ComponentName[];
};

export type ComponentStatus = 'match' | 'differ' | 'noised' | 'missing';

export type ComponentComparison = {
  readonly name: ComponentName;
  readonly status: ComponentStatus;
  readonly weight: number;
  readonly left: string | undefined;
  readonly right: string | undefined;
};

export type FingerprintComparison = {
  readonly score: number;
  readonly comparableWeight: number;
  readonly components: readonly ComponentComparison[];
};

// why: rough entropy guesses in bits. Replace them with weights learned from pairs
// linked deterministically (orders, logins, handoff tokens) once real traffic exists.
export const COMPONENT_WEIGHTS: Readonly<Record<ComponentName, number>> = {
  canvas: 8,
  webglRender: 6,
  audio: 5,
  fonts: 6,
  voices: 3,
  webglRenderer: 4,
  webglVendor: 1,
  webglParameters: 3,
  userAgent: 3,
  uaHighEntropy: 2,
  platform: 1,
  languages: 3,
  timezone: 3,
  intl: 1,
  screen: 4,
  availableScreen: 2,
  devicePixelRatio: 1.5,
  hardwareConcurrency: 2,
  deviceMemory: 1.5,
  maxTouchPoints: 1,
  mediaQueries: 1.5,
  math: 1,
  mediaDevices: 2,
};

export const STABLE_COMPONENTS: readonly ComponentName[] = [
  'platform',
  'languages',
  'timezone',
  'intl',
  'screen',
  'devicePixelRatio',
  'hardwareConcurrency',
  'deviceMemory',
  'maxTouchPoints',
  'webglVendor',
  'webglRenderer',
  'math',
];

export const MATCH_THRESHOLD = 0.9;
export const MIN_COMPARABLE_WEIGHT = 20;
const KEY_LENGTH = 16;

const isNoised = (name: ComponentName, left: FingerprintSample, right: FingerprintSample): boolean =>
  left.noisedComponents.includes(name) || right.noisedComponents.includes(name);

const statusOf = (name: ComponentName, left: FingerprintSample, right: FingerprintSample): ComponentStatus => {
  const leftValue = left.components[name];
  const rightValue = right.components[name];
  if (leftValue === undefined || rightValue === undefined) {
    return 'missing';
  }
  if (isNoised(name, left, right)) {
    return 'noised';
  }
  return leftValue === rightValue ? 'match' : 'differ';
};

const totalWeight = (comparisons: readonly ComponentComparison[]): number =>
  comparisons.reduce((sum, comparison) => sum + comparison.weight, 0);

export const compareFingerprints = (left: FingerprintSample, right: FingerprintSample): FingerprintComparison => {
  const components = COMPONENT_NAMES.map((name) => ({
    name,
    status: statusOf(name, left, right),
    weight: COMPONENT_WEIGHTS[name],
    left: left.components[name],
    right: right.components[name],
  }));
  const comparable = components.filter(({ status }) => status === 'match' || status === 'differ');
  const comparableWeight = totalWeight(comparable);
  const matchedWeight = totalWeight(comparable.filter(({ status }) => status === 'match'));
  return { score: comparableWeight === 0 ? 0 : matchedWeight / comparableWeight, comparableWeight, components };
};

export const isConfidentMatch = ({ score, comparableWeight }: FingerprintComparison): boolean =>
  score >= MATCH_THRESHOLD && comparableWeight >= MIN_COMPARABLE_WEIGHT;

const keyOf = (components: Components, names: readonly ComponentName[]): string =>
  createHash('sha256')
    .update(names.map((name) => `${name}=${components[name] ?? ''}`).join('\n'))
    .digest('hex')
    .slice(0, KEY_LENGTH);

export const stableKeyOf = (components: Components): string => keyOf(components, STABLE_COMPONENTS);

export const fullKeyOf = (components: Components): string => keyOf(components, COMPONENT_NAMES);
