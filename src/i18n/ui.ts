import { murmurConfig } from "../config";
import { messagesByLocale } from "./messages";
import type { Messages } from "./types";

export type Locale = keyof typeof messagesByLocale;
export const siteLocale: Locale = murmurConfig.i18n.locale;

const messages = messagesByLocale satisfies Record<Locale, Messages>;
const languageNames = new Intl.DisplayNames([siteLocale], { type: "language" });

export function getMessages() {
  return messages[siteLocale];
}

export function getFallbackNotice(contentLocale: Locale) {
  const language = languageNames.of(contentLocale) ?? contentLocale;
  return getMessages().fallbackNotice.replace("{language}", language);
}
