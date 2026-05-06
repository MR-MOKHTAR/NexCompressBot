import { Context } from "telegraf";
import {
  getOperationMenu,
  getMergeKeyboard,
} from "../keyboards/qualityKeyboard";
import {
  saveMedia,
  getActiveUserMergeSession,
  addFileToMergeSession,
} from "../utils/store";
import { t } from "../i18n";
import { getUserLang } from "../utils/db";
import { Markup } from "telegraf";

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

  // Check if user has an active merge session
  const activeMergeSession = getActiveUserMergeSession(userId);

  if (activeMergeSession) {
    // User is in merge mode, ask if they want to add this file
    const addedSuccessfully = addFileToMergeSession(
      activeMergeSession.sessionId,
      fileId,
      fileName,
      durationMs,
    );

    if (addedSuccessfully) {
      const msgText = t("merge_file_added", userLang)
        .replace("{{count}}", (activeMergeSession.files.length + 1).toString())
        .replace("{{size}}", size)
        .replace("{{duration}}", duration);

      await ctx.reply(msgText, {
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback("➕ Add Another", "merge_continue"),
            Markup.button.callback(
              "✅ Merge Now",
              `m_go_${activeMergeSession.sessionId}`,
            ),
          ],
          [
            Markup.button.callback(
              "❌ Cancel",
              `m_cancel_${activeMergeSession.sessionId}`,
            ),
          ],
        ]).reply_markup,
      });
      return;
    }
  }

  // Normal operation menu
  const msgText = t("select_operation", userLang)
    .replace("{{size}}", size)
    .replace("{{duration}}", duration);

  await ctx.reply(msgText, {
    reply_markup: getOperationMenu(shortId).reply_markup,
    ...(ctx.message?.message_id
      ? { reply_parameters: { message_id: ctx.message.message_id } }
      : {}),
  });
}
