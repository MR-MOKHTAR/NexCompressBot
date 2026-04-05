import { Context } from "telegraf";
import { getMedia } from "../utils/store";
import { downloadFile, cleanupFiles } from "../utils/fileHelper";
import { processAudio } from "../processors/audioProcessor";
import { processVideo } from "../processors/videoProcessor";
import { t } from "../i18n";
import { getUserLang, setUserLang } from "../utils/db";
import { processingQueue } from "../utils/queueManager";
import fs from "fs";

function formatSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function buildProgressBar(percent: number): string {
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  const totalBars = 10;
  const filledBars = Math.round((percent / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  return `[${"█".repeat(filledBars)}${"░".repeat(emptyBars)}] ${percent}%`;
}

export async function handleCallback(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  // @ts-ignore
  const data = ctx.callbackQuery?.data as string;
  if (!data) return;

  // Handle language updates
  if (data.startsWith("lang_")) {
    const selectedLang = data.replace("lang_", "");
    await setUserLang(userId, selectedLang);
    await ctx.answerCbQuery(t("language_saved", selectedLang), {
      show_alert: true,
    });
    // @ts-ignore
    await ctx.editMessageText(t("language_saved", selectedLang));
    return;
  }

  const userLang =
    (await getUserLang(userId)) || ctx.from?.language_code || "en";

  // data format: {type}_{quality}_{shortId}  e.g.  a_128k_abcd1234
  const parts = data.split("_");
  if (parts.length !== 3) return;

  const [typeCode, quality, shortId] = parts;
  const mediaData = getMedia(shortId);

  if (!mediaData) {
    await ctx.answerCbQuery(t("error_generic", userLang), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();

  const queuePos = processingQueue.getQueueLength();
  let initialText = "";
  if (queuePos > 0) {
    initialText = t("queued", userLang).replace("{{pos}}", queuePos.toString());
  } else {
    initialText = t("processing", userLang).replace(
      "{{progress}}",
      buildProgressBar(0),
    );
  }

  // Safely get message_id to reply to
  const message = ctx.callbackQuery?.message;
  const msgId = (message && 'reply_to_message' in message)
    ? (message as any).reply_to_message?.message_id
    : undefined;

  const processingMsg = await ctx.reply(initialText, {
    ...(msgId ? { reply_parameters: { message_id: msgId } } : {}),
  });

  processingQueue.enqueue({
    execute: async () => {
      // If it was queued, show processing text now
      if (queuePos > 0) {
        const text = t("processing", userLang).replace(
          "{{progress}}",
          buildProgressBar(0),
        );
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            undefined,
            text,
          );
        } catch (err) {}
      }

      let downloadedPath: string | undefined;
      let processedPath: string | undefined;

      let lastUpdateTime = Date.now();

      const handleProgress = async (percent: number) => {
        const now = Date.now();
        // Only update Telegram message every 2 seconds to avoid rate limits
        if (now - lastUpdateTime > 2000) {
          lastUpdateTime = now;
          const updatedText = t("processing", userLang).replace(
            "{{progress}}",
            buildProgressBar(percent),
          );
          try {
            await ctx.telegram.editMessageText(
              ctx.chat!.id,
              processingMsg.message_id,
              undefined,
              updatedText,
            );
          } catch (err) {
            // Ignored, message not modified
          }
        }
      };

      try {
        const fileUrl = await ctx.telegram.getFileLink(mediaData.fileId);

        // Download
        downloadedPath = await downloadFile(
          fileUrl.href,
          mediaData.type === "audio" ? ".mp3" : ".mp4",
        );

        // Ensure it updates processing status during a long task
        await handleProgress(10); // Start processing immediately after download finishes

        // Process
        if (mediaData.type === "audio") {
          processedPath = await processAudio(
            downloadedPath,
            quality,
            handleProgress,
          );
        } else {
          processedPath = await processVideo(
            downloadedPath,
            quality,
            handleProgress,
          );
        }

        // Set final 100% processing bar
        const finalText = t("processing", userLang).replace(
          "{{progress}}",
          buildProgressBar(100),
        );
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            undefined,
            finalText,
          );
        } catch (err) {}

        const oldBytes = fs.statSync(downloadedPath).size;
        const newBytes = fs.statSync(processedPath).size;
        const savedPercent =
          oldBytes > 0
            ? (((oldBytes - newBytes) / oldBytes) * 100).toFixed(1)
            : "0.0";

        const finalReport = t("done_stats", userLang)
          .replace("{{oldSize}}", formatSize(oldBytes))
          .replace("{{newSize}}", formatSize(newBytes))
          .replace("{{savedPercent}}", savedPercent);

        // Determine upload method
        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            undefined,
            t("uploading", userLang),
          );
        } catch (err) {}

        if (mediaData.type === "audio") {
          const fileOpts = mediaData.fileName
            ? { source: processedPath, filename: mediaData.fileName }
            : { source: processedPath };
          await ctx.replyWithAudio(fileOpts, { caption: finalReport });
        } else {
          const fileOpts = mediaData.fileName
            ? { source: processedPath, filename: mediaData.fileName }
            : { source: processedPath };
          await ctx.replyWithVideo(fileOpts, { caption: finalReport });
        }

        // Cleanup message
        await ctx.telegram
          .deleteMessage(ctx.chat!.id, processingMsg.message_id)
          .catch(() => {});
      } catch (error) {
        console.error("Processing error:", error);
        await ctx.reply(t("error_generic", userLang));
      } finally {
        cleanupFiles(downloadedPath, processedPath);
      }
    },
  });
}
