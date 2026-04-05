import i18next from "i18next";
import fa from "./locales/fa.json";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

i18next.init({
  fallbackLng: "en",
  supportedLngs: ["en", "fa", "ar"],
  resources: {
    en: { translation: en },
    fa: { translation: fa },
    ar: { translation: ar },
  },
  interpolation: {
    escapeValue: false, // not needed for telegraf
  },
});

export const t = (key: string, lang = "en"): string => {
  const selectedLang = ["en", "fa", "ar"].includes(lang) ? lang : "en";
  return i18next.t(key, { lng: selectedLang }) as string;
};

export default i18next;
