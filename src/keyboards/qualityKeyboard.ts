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
      Markup.button.callback(t("op_merge", lang), `op_merge_${shortId}`),
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
      Markup.button.callback("MP3", `c_mp3_${shortId}`),
      Markup.button.callback("AAC", `c_aac_${shortId}`),
      Markup.button.callback("Opus", `c_opus_${shortId}`),
    ],
    [
      Markup.button.callback("OGG", `c_ogg_${shortId}`),
      Markup.button.callback("M4A", `c_m4a_${shortId}`),
      Markup.button.callback("MP4", `c_mp4_${shortId}`),
    ],
    [
      Markup.button.callback("WMA", `c_wma_${shortId}`),
      Markup.button.callback("AMR", `c_amr_${shortId}`),
      Markup.button.callback("3GP", `c_3gp_${shortId}`),
    ],
  ]);
}

export function getTrimKeyboard(
  shortId: string,
  fileDurationSeconds: number,
  lang: string,
) {
  const buttons: any[] = [];

  // First row: 1st and 2nd minute first
  const firstRow = [];
  if (fileDurationSeconds > 60) {
    firstRow.push(
      Markup.button.callback(t("trim_1min_first", lang), `t_first60_${shortId}`),
    );
  }
  if (fileDurationSeconds > 120) {
    firstRow.push(
      Markup.button.callback(t("trim_2min_first", lang), `t_first120_${shortId}`),
    );
  }
  if (firstRow.length > 0) buttons.push(firstRow);

  // Second row: 1st and 2nd minute last
  const secondRow = [];
  if (fileDurationSeconds > 60) {
    secondRow.push(
      Markup.button.callback(t("trim_1min_last", lang), `t_last60_${shortId}`),
    );
  }
  if (fileDurationSeconds > 120) {
    secondRow.push(
      Markup.button.callback(t("trim_2min_last", lang), `t_last120_${shortId}`),
    );
  }
  if (secondRow.length > 0) buttons.push(secondRow);

  // Third row: original presets (optional, keeping for backward compatibility or variety)
  const thirdRow = [
    Markup.button.callback("First 30s", `t_first30_${shortId}`),
  ];
  if (fileDurationSeconds > 30) {
    thirdRow.push(Markup.button.callback("Last 30s", `t_last30_${shortId}`));
  }
  buttons.push(thirdRow);

  // Fourth row: custom time input button
  buttons.push([
    Markup.button.callback(t("trim_custom", lang), `t_custom_${shortId}`),
  ]);

  return Markup.inlineKeyboard(buttons);
}

export function getMergeKeyboard(sessionId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Merge Now", `m_go_${sessionId}`),
      Markup.button.callback("❌ Cancel", `m_cancel_${sessionId}`),
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
