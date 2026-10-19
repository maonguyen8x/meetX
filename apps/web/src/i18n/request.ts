import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

import { routing } from './routing';

const messages = {
  en: () => import('../messages/en.json').then((module) => module.default),
  ja: () => import('../messages/ja.json').then((module) => module.default),
  vi: () => import('../messages/vi.json').then((module) => module.default),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = hasLocale(routing.locales, requestedLocale) ? requestedLocale : routing.defaultLocale;

  return { locale, messages: await messages[locale]() };
});
