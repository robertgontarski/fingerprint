import type { MutableComponents } from '../../shared/contract.ts';
import { hashString } from '../hash.ts';

const MEDIA_FEATURES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['color-gamut', ['rec2020', 'p3', 'srgb']],
  ['dynamic-range', ['high', 'standard']],
  ['prefers-color-scheme', ['dark', 'light']],
  ['prefers-reduced-motion', ['reduce', 'no-preference']],
  ['prefers-contrast', ['more', 'less', 'custom', 'no-preference']],
  ['forced-colors', ['active', 'none']],
  ['inverted-colors', ['inverted', 'none']],
  ['pointer', ['fine', 'coarse', 'none']],
  ['hover', ['hover', 'none']],
];

const describeMediaQueries = (): string =>
  MEDIA_FEATURES.map(([feature, values]) => {
    const matched = values.find((value) => window.matchMedia(`(${feature}: ${value})`).matches);
    return `${feature}=${matched ?? '?'}`;
  }).join(';');

const describeMath = (): string =>
  hashString(
    [
      Math.acos(0.123124234234234242),
      Math.acosh(1e308),
      Math.asinh(1),
      Math.atanh(0.5),
      Math.cbrt(100),
      Math.cosh(1),
      Math.expm1(1),
      Math.log1p(10),
      Math.sinh(1),
      Math.tan(-1e300),
      Math.tanh(1),
      Math.pow(Math.PI, -100),
    ].join(','),
  );

const describeIntl = (): string => {
  const dateOptions = new Intl.DateTimeFormat().resolvedOptions();
  const numberOptions = new Intl.NumberFormat().resolvedOptions();
  return [dateOptions.locale, dateOptions.calendar, dateOptions.numberingSystem, numberOptions.locale].join('|');
};

const readDeviceMemory = (): string | undefined => {
  const memory: unknown = Reflect.get(navigator, 'deviceMemory');
  return typeof memory === 'number' ? String(memory) : undefined;
};

export const collectEnvironment = (target: MutableComponents): void => {
  target.userAgent = navigator.userAgent;
  target.platform = navigator.platform;
  target.languages = navigator.languages.join(',');
  target.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  target.intl = describeIntl();
  target.screen = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  target.availableScreen = `${screen.availWidth}x${screen.availHeight}`;
  target.devicePixelRatio = String(window.devicePixelRatio);
  target.hardwareConcurrency = String(navigator.hardwareConcurrency);
  target.maxTouchPoints = String(navigator.maxTouchPoints);
  target.mediaQueries = describeMediaQueries();
  target.math = describeMath();
  const memory = readDeviceMemory();
  if (memory !== undefined) {
    target.deviceMemory = memory;
  }
};

export const isBrave = (): boolean => Reflect.get(navigator, 'brave') !== undefined;

export const sendsGlobalPrivacyControl = (): boolean => Reflect.get(navigator, 'globalPrivacyControl') === true;
