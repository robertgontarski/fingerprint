import {
  isComponentName,
  type CollectRequest,
  type ComponentName,
  type MutableComponents,
  type ProtectionReport,
} from '../shared/contract.ts';
import { isRecord } from '../shared/guards.ts';

const MAX_COMPONENT_LENGTH = 4096;
const MAX_TOKEN_LENGTH = 512;

const isComponentValue = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_COMPONENT_LENGTH;

const isComponentNameValue = (value: unknown): value is ComponentName =>
  typeof value === 'string' && isComponentName(value);

export const parseComponentList = (value: unknown): ComponentName[] | undefined =>
  Array.isArray(value) && value.every(isComponentNameValue) ? [...new Set(value)] : undefined;

export const parseComponents = (value: unknown): MutableComponents | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const components: MutableComponents = {};
  for (const [name, raw] of Object.entries(value)) {
    if (!isComponentName(name) || !isComponentValue(raw)) {
      return undefined;
    }
    components[name] = raw;
  }
  return components;
};

const parseProtection = (value: unknown): ProtectionReport | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { brave, globalPrivacyControl } = value;
  const noisedComponents = parseComponentList(value['noisedComponents']);
  if (noisedComponents === undefined || typeof brave !== 'boolean' || typeof globalPrivacyControl !== 'boolean') {
    return undefined;
  }
  return { noisedComponents, brave, globalPrivacyControl };
};

const isHandoffTokenValue = (value: unknown): value is string | undefined =>
  value === undefined || (typeof value === 'string' && value.length <= MAX_TOKEN_LENGTH);

export const parseCollectRequest = (value: unknown): CollectRequest | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const components = parseComponents(value['components']);
  const protection = parseProtection(value['protection']);
  const handoffToken = value['handoffToken'];
  if (components === undefined || protection === undefined || !isHandoffTokenValue(handoffToken)) {
    return undefined;
  }
  return handoffToken === undefined ? { components, protection } : { components, protection, handoffToken };
};

export const parseConsentRequest = (value: unknown): boolean | undefined => {
  if (!isRecord(value) || typeof value['granted'] !== 'boolean') {
    return undefined;
  }
  return value['granted'];
};
