import { Markup } from "telegraf";

export function getOperationMenu(shortId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🗜️ Compress", `op_compress_${shortId}`),
      Markup.button.callback("🎵 Convert", `op_convert_${shortId}`),
    ],
    [
      Markup.button.callback("✂️ Trim", `op_trim_${shortId}`),
      Markup.button.callback("🔗 Merge", `op_merge_${shortId}`),
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

export function getTrimKeyboard(shortId: string, fileDurationSeconds: number) {
  const buttons: any[] = [];

  // First row: presets for first N seconds
  buttons.push([
    Markup.button.callback("First 10s", `t_first10_${shortId}`),
    Markup.button.callback("First 30s", `t_first30_${shortId}`),
  ]);

  // Second row: presets for last N seconds (only if file is long enough)
  const secondRowButtons = [];
  if (fileDurationSeconds > 10) {
    secondRowButtons.push(
      Markup.button.callback("Last 10s", `t_last10_${shortId}`),
    );
  }
  if (fileDurationSeconds > 30) {
    secondRowButtons.push(
      Markup.button.callback("Last 30s", `t_last30_${shortId}`),
    );
  }

  if (secondRowButtons.length > 0) {
    buttons.push(secondRowButtons);
  }

  // Third row: custom time input button
  buttons.push([
    Markup.button.callback("Custom Time Input", `t_custom_${shortId}`),
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
