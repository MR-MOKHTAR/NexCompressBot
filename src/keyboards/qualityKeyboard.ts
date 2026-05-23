import { Markup } from "telegraf";
import { t } from "../i18n";

export function getOperationMenu(shortId: string, lang: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t("op_compress", lang), `op_compress_${shortId}`),
      Markup.button.callback(t("op_convert", lang), `op_convert_${shortId}`),
    ],
    [
      Markup.button.callback(t("op_trim", lang), `op_trim_${shortId}`),
    ],
  ]);
}

export function getAudioKeyboard(fileId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("128 kbps", `a_128k_${fileId}`),
      Markup.button.callback("96 kbps", `a_96k_${fileId}`),
    ],
    [
      Markup.button.callback("64 kbps", `a_64k_${fileId}`),
      Markup.button.callback("48 kbps", `a_48k_${fileId}`),
    ],
    [Markup.button.callback("32 kbps", `a_32k_${fileId}`)],
  ]);
}

export function getFormatKeyboard(shortId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🎙 Voice", `c_voice_${shortId}`),
      Markup.button.callback("MP3", `c_mp3_${shortId}`),
      Markup.button.callback("AAC", `c_aac_${shortId}`),
    ],
    [
      Markup.button.callback("OGG", `c_ogg_${shortId}`),
      Markup.button.callback("Opus", `c_opus_${shortId}`),
      Markup.button.callback("M4A", `c_m4a_${shortId}`),
    ],
    [
      Markup.button.callback("WAV", `c_wav_${shortId}`),
      Markup.button.callback("FLAC", `c_flac_${shortId}`),
    ],
  ]);
}

export function getTrimKeyboard(
  shortId: string,
  fileDurationSeconds: number,
  lang: string,
) {
  const buttons: any[] = [];

  // Row 1: First presets (10s, 30s, 1min)
  const row1 = [];
  row1.push(
    Markup.button.callback(t("trim_10s_first", lang), `t_first10_${shortId}`),
  );
  if (fileDurationSeconds > 10) {
    row1.push(
      Markup.button.callback(t("trim_30s_first", lang), `t_first30_${shortId}`),
    );
  }
  if (fileDurationSeconds > 30) {
    row1.push(
      Markup.button.callback(t("trim_1min_first", lang), `t_first60_${shortId}`),
    );
  }
  buttons.push(row1);

  // Row 2: Last presets (10s, 30s, 1min)
  if (fileDurationSeconds > 10) {
    const row2 = [];
    row2.push(
      Markup.button.callback(t("trim_10s_last", lang), `t_last10_${shortId}`),
    );
    if (fileDurationSeconds > 10) {
      row2.push(
        Markup.button.callback(t("trim_30s_last", lang), `t_last30_${shortId}`),
      );
    }
    if (fileDurationSeconds > 30) {
      row2.push(
        Markup.button.callback(t("trim_1min_last", lang), `t_last60_${shortId}`),
      );
    }
    buttons.push(row2);
  }

  // Row 3: 2 min first / 2 min last (only if duration > 120s)
  if (fileDurationSeconds > 120) {
    buttons.push([
      Markup.button.callback(t("trim_2min_first", lang), `t_first120_${shortId}`),
      Markup.button.callback(t("trim_2min_last", lang), `t_last120_${shortId}`),
    ]);
  }

  // Row 4: Half first / Half second (only if duration > 20s)
  if (fileDurationSeconds > 20) {
    buttons.push([
      Markup.button.callback(t("trim_half_first", lang), `t_half1_${shortId}`),
      Markup.button.callback(t("trim_half_second", lang), `t_half2_${shortId}`),
    ]);
  }

  // Row 5: Custom time input
  buttons.push([
    Markup.button.callback(t("trim_custom", lang), `t_custom_${shortId}`),
  ]);

  return Markup.inlineKeyboard(buttons);
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
