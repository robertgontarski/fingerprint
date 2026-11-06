import type { Site } from '../config.ts';
import type { ConsentState } from '../http/cookies.ts';
import { html, type SafeHtml } from './html.ts';

export const layout = (site: Site, title: string, consent: ConsentState, content: SafeHtml): SafeHtml => html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} - ${site.name}</title>
    <link rel="stylesheet" href="/static/style.css">
  </head>
  <body class="theme-${site.theme}" data-consent="${consent}">
    <header class="masthead">
      <p class="brand">${site.name} <span class="origin">${site.origin}</span></p>
      <nav aria-label="Navigation">
        <a href="/">Shop</a>
        <a href="/lab">Lab</a>
      </nav>
    </header>
    <main>${content}</main>
  </body>
</html>`;
