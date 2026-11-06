export const COMPONENT_NAMES = [
  'userAgent',
  'uaHighEntropy',
  'platform',
  'languages',
  'timezone',
  'intl',
  'screen',
  'availableScreen',
  'devicePixelRatio',
  'hardwareConcurrency',
  'deviceMemory',
  'maxTouchPoints',
  'mediaQueries',
  'math',
  'webglVendor',
  'webglRenderer',
  'webglParameters',
  'webglRender',
  'canvas',
  'audio',
  'fonts',
  'voices',
  'mediaDevices',
] as const;

export type ComponentName = (typeof COMPONENT_NAMES)[number];

export type Components = { readonly [Name in ComponentName]?: string };

export type MutableComponents = { -readonly [Name in ComponentName]?: string };

export type ProtectionReport = {
  readonly noisedComponents: readonly ComponentName[];
  readonly brave: boolean;
  readonly globalPrivacyControl: boolean;
};

export type CollectRequest = {
  readonly components: Components;
  readonly protection: ProtectionReport;
  readonly handoffToken?: string;
};

export const HANDOFF_OUTCOMES = [
  'absent',
  'linked',
  'malformed',
  'bad-signature',
  'expired',
  'wrong-destination',
  'reused',
] as const;

export type HandoffOutcome = (typeof HANDOFF_OUTCOMES)[number];

export type CandidateSummary = {
  readonly site: string;
  readonly visitorId: string;
  readonly score: number;
  readonly sameIdentity: boolean | null;
};

export type CollectResponse = {
  readonly visitorId: string;
  readonly observationId: number;
  readonly handoff: HandoffOutcome;
  readonly bestCandidate: CandidateSummary | null;
};

export const isComponentName = (value: string): value is ComponentName =>
  COMPONENT_NAMES.some((name) => name === value);
