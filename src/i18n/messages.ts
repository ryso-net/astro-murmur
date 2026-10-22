import english from "./locales/en";
import chinese from "./locales/zh-CN";

export const messagesByLocale = {
  "zh-CN": chinese,
  en: english,
};

export type Locale = keyof typeof messagesByLocale;

export function getMessagesForLocale(locale: Locale) {
  return messagesByLocale[locale];
}
