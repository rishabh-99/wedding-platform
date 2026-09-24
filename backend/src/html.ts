import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import { env } from './config/env';
import { logger } from './lib/logger';
import { settingsService } from './services/settings.service';

/**
 * Serves the SPA shell with SEO/OpenGraph tags rendered from WeddingSettings,
 * so link previews (WhatsApp, iMessage, X…) show the couple's names and image
 * even though crawlers do not execute JavaScript.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let template: string | null = null;

async function loadTemplate(): Promise<string | null> {
  if (template && env.isProd) return template;
  if (!env.FRONTEND_DIST) return null;
  try {
    template = await fs.readFile(path.join(env.FRONTEND_DIST, 'index.html'), 'utf8');
    return template;
  } catch (err) {
    logger.warn({ err }, 'frontend index.html not found');
    return null;
  }
}

export async function renderSeoBlock(pagePath: string): Promise<string> {
  const s = await settingsService.get();
  const base = env.PUBLIC_URL.replace(/\/$/, '');
  const title = s.siteTitle || `${s.coupleName1} & ${s.coupleName2}`;
  const description = s.siteDescription;
  const image = `${base}/api/og-image`;
  const url = `${base}${pagePath === '/' ? '' : pagePath}`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(`${s.coupleName1} & ${s.coupleName2}`)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(`${s.coupleName1} & ${s.coupleName2} — wedding invitation`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ];
  return tags.join('\n    ');
}

export async function serveSpaShell(req: Request, res: Response): Promise<void> {
  const html = await loadTemplate();
  if (!html) {
    res.status(404).send('Frontend not built');
    return;
  }
  let seo: string;
  try {
    seo = await renderSeoBlock(req.path);
  } catch (err) {
    logger.error({ err }, 'failed to render SEO tags');
    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    return;
  }
  const out = html.replace(/<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, `<!-- seo:start -->\n    ${seo}\n    <!-- seo:end -->`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(out);
}
