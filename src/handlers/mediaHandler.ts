import { Context } from "telegraf";
import {
  getAudioKeyboard,
  getVideoKeyboard,
} from "../keyboards/qualityKeyboard";
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

  // @ts-ignore
  const audioObj = ctx.message?.audio || ctx.message?.voice;
  const fileId = audioObj?.file_id;

  if (!fileId) return;

  const size = formatSize(audioObj?.file_size);
  const duration = formatDuration(audioObj?.duration);
  const fileName = audioObj?.file_name;
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

export async function handleVideo(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const userLang =
    (await getUserLang(userId)) || ctx.from?.language_code || "en";

  // @ts-ignore
  const videoObj =
    ctx.message?.video || ctx.message?.video_note || ctx.message?.document;
  // some videos are sent as document
  if (!videoObj?.file_id) return;
  const fileId = videoObj.file_id;

  const size = formatSize(videoObj?.file_size);
  const duration = formatDuration(videoObj?.duration); // duration might be undefined for documents
  const fileName = videoObj?.file_name;
  const shortId = saveMedia(fileId, "video", fileName);

  const msgText = t("select_video_quality", userLang)
    .replace("{{size}}", size)
    .replace("{{duration}}", duration === "00:00" ? "??" : duration);

  await ctx.reply(msgText, {
    reply_markup: getVideoKeyboard(shortId).reply_markup,
    ...(ctx.message?.message_id
      ? { reply_parameters: { message_id: ctx.message.message_id } }
      : {}),
  });
}
