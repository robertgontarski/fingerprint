import type { Site } from '../config.ts';
import type { ConsentState } from '../http/cookies.ts';
import type { LabModel } from '../lab.ts';
import { html, type SafeHtml } from './html.ts';
import { layout } from './layout.ts';
import { candidatesSection, clustersSection, metricsSection, pairsSection, recentSection } from './lab-sections.ts';

export const labPage = (site: Site, consent: ConsentState, model: LabModel): SafeHtml =>
  layout(
    site,
    'Lab',
    consent,
    html`
      ${metricsSection(model)}
      ${pairsSection(model)}
      ${candidatesSection(model)}
      ${clustersSection(model)}
      ${recentSection(model)}`,
  );
