import { Context } from "telegraf";
import { getAudioKeyboard } from "../keyboards/qualityKeyboard";
import { saveMedia } from "../utils/store";
import { t } from "../i18n";
import { getUserLang } from "../utils/db";

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "0.00";
  return (bytes / (1024 * 1024)).toFixed(2);
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export async function handleAudio(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const userLang =
    (await getUserLang(userId)) || ctx.from?.language_code || "en";

  const msg = ctx.message;
  if (!msg) return;

  let fileId: string | undefined;
  let fileSize: number | undefined;
  let durationMs: number | undefined;
  let fileNameRaw: string | undefined;

  if ("audio" in msg) {
    fileId = msg.audio.file_id;
    fileSize = msg.audio.file_size;
    durationMs = msg.audio.duration;
    fileNameRaw = msg.audio.file_name;
  } else if ("voice" in msg) {
    fileId = msg.voice.file_id;
    fileSize = msg.voice.file_size;
    durationMs = msg.voice.duration;
  }

  if (!fileId) return;

  const size = formatSize(fileSize);
  const duration = formatDuration(durationMs);
  const fileName = fileNameRaw;
  const shortId = saveMedia(fileId, "audio", fileName);

  const msgText = t("select_audio_quality", userLang)
    .replace("{{size}}", size)
    .replace("{{duration}}", duration);

  await ctx.reply(msgText, {
    reply_markup: getAudioKeyboard(shortId).reply_markup,
    ...(ctx.message?.message_id
      ? { reply_parameters: { message_id: ctx.message.message_id } }
      : {}),
  });
}
