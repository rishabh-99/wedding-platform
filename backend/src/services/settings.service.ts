import type { Prisma, WeddingSettings } from '@prisma/client';
import { DEFAULT_SECTIONS, DEFAULT_TIMEZONE, settingsInputSchema, type SettingsDTO, type SectionToggles } from '@wedding/shared';
import type { z } from 'zod';
import { prisma } from '../lib/prisma';
import { storage } from '../storage';
import { broker } from '../realtime/sseBroker';

const SETTINGS_ID = 'default';
let cache: { value: SettingsDTO; at: number } | null = null;
const CACHE_MS = 30_000;

export const FALLBACK_SETTINGS: Omit<WeddingSettings, 'createdAt' | 'updatedAt'> = {
  id: SETTINGS_ID,
  coupleName1: 'Rishabh',
  coupleName2: 'Nandita',
  familiesLine: 'Together with their families',
  inviteLine: 'invite you to celebrate their wedding',
  welcomeMessage: '',
  weddingDatesLabel: '20 October 2026 · 3–4 December 2026',
  weddingHashtag: null,
  timezone: DEFAULT_TIMEZONE,
  contactPhone: null,
  contactWhatsapp: null,
  contactEmail: null,
  whatsappGroupUrl: null,
  siteTitle: 'Rishabh & Nandita — The Wedding',
  siteDescription: 'Join us as we celebrate our wedding in Kanpur.',
  sections: DEFAULT_SECTIONS as unknown as Prisma.JsonValue,
  theme: null,
  liveMode: 'AUTO',
  liveBannerText: 'The celebrations have begun',
  archiveHeadline: 'The celebrations have come to a close.',
  archiveSubheadline: 'But the memories remain.',
  logoAssetId: null,
  ogImageAssetId: null,
};

async function assetUrl(id: string | null): Promise<string | null> {
  if (!id) return null;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return null;
  const variants = (asset.variants ?? {}) as { medium?: { key: string } };
  return storage().getUrl(variants.medium?.key ?? asset.storageKey);
}

async function toDTO(row: Omit<WeddingSettings, 'createdAt' | 'updatedAt'>): Promise<SettingsDTO> {
  return {
    coupleName1: row.coupleName1,
    coupleName2: row.coupleName2,
    familiesLine: row.familiesLine,
    inviteLine: row.inviteLine,
    welcomeMessage: row.welcomeMessage,
    weddingDatesLabel: row.weddingDatesLabel,
    weddingHashtag: row.weddingHashtag,
    timezone: row.timezone,
    contactPhone: row.contactPhone,
    contactWhatsapp: row.contactWhatsapp,
    contactEmail: row.contactEmail,
    whatsappGroupUrl: row.whatsappGroupUrl,
    siteTitle: row.siteTitle,
    siteDescription: row.siteDescription,
    sections: { ...DEFAULT_SECTIONS, ...((row.sections ?? {}) as Partial<SectionToggles>) },
    liveMode: row.liveMode,
    liveBannerText: row.liveBannerText,
    archiveHeadline: row.archiveHeadline,
    archiveSubheadline: row.archiveSubheadline,
    logoAssetId: row.logoAssetId,
    ogImageAssetId: row.ogImageAssetId,
    logoUrl: await assetUrl(row.logoAssetId),
    ogImageUrl: await assetUrl(row.ogImageAssetId),
  };
}

export const settingsService = {
  async get(): Promise<SettingsDTO> {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
    const row = await prisma.weddingSettings.findUnique({ where: { id: SETTINGS_ID } });
    const value = await toDTO(row ?? FALLBACK_SETTINGS);
    cache = { value, at: Date.now() };
    return value;
  },

  async timezone(): Promise<string> {
    return (await this.get()).timezone;
  },

  async update(input: z.output<typeof settingsInputSchema>): Promise<SettingsDTO> {
    const data = { ...input, sections: input.sections as unknown as Prisma.InputJsonValue };
    await prisma.weddingSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });
    this.invalidate();
    broker.publish('SETTINGS_CHANGED');
    return this.get();
  },

  invalidate(): void {
    cache = null;
  },
};
