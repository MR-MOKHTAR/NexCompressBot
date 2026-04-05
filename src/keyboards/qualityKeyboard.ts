import { Markup } from "telegraf";

export function getAudioKeyboard(fileId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("128 kbps", `a_128k_${fileId}`),
      Markup.button.callback("64 kbps", `a_64k_${fileId}`),
    ],
    [
      Markup.button.callback("48 kbps", `a_48k_${fileId}`),
      Markup.button.callback("32 kbps", `a_32k_${fileId}`),
    ],
  ]);
}

export function getLanguageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("فارسی 🇮🇷", "lang_fa"),
      Markup.button.callback("العربية 🇸🇦", "lang_ar"),
      Markup.button.callback("English 🇺🇸", "lang_en"),
    ],
  ]);
}
