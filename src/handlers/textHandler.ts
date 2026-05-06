import { Context } from "telegraf";
import { getMedia } from "../utils/store";
import { downloadFile, cleanupFiles } from "../utils/fileHelper";
import {
  trimAudio,
  getAudioDuration,
  parseTimeInput,
} from "../processors/audioTrimmer";
import { t } from "../i18n";
import { getUserLang } from "../utils/db";
import { processingQueue } from "../utils/queueManager";
import fs from "fs";
import path from "path";

function buildProgressBar(percent: number): string {
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  const totalBars = 10;
  const filledBars = Math.round((percent / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  return `[${"█".repeat(filledBars)}${"░".repeat(emptyBars)}] ${percent}%`;
}

function formatSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

export async function handleTextInput(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId || !ctx.message || !("text" in ctx.message)) return;

  const userLang =
    (await getUserLang(userId)) || ctx.from?.language_code || "en";

  // @ts-ignore
  const trimMode = ctx.session?.trimMode;

  if (!trimMode) {
    // Not in trim mode, ignore text input
    return;
  }

  const timeInput = ctx.message.text;
  const timeParsed = parseTimeInput(timeInput);

  if (!timeParsed) {
    await ctx.reply(t("trim_invalid_time", userLang));
    return;
  }

  const mediaData = getMedia(trimMode);
  if (!mediaData) {
    await ctx.reply(t("error_generic", userLang));
    // @ts-ignore
    ctx.session.trimMode = null;
    return;
  }

  // Clear trim mode
  // @ts-ignore
  ctx.session.trimMode = null;

  const [startSeconds, endSeconds] = timeParsed;
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

  const processingMsg = await ctx.reply(initialText);

  processingQueue.enqueue({
    userId,
    operationType: "trim",
    execute: async () => {
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
          } catch (err) {}
        }
      };

      try {
        const fileUrl = await ctx.telegram.getFileLink(mediaData.fileId);
        downloadedPath = await downloadFile(fileUrl.href, ".mp3");

        await handleProgress(10);

        // Validate trim range against actual file duration
        const duration = await getAudioDuration(downloadedPath);
        if (endSeconds > duration) {
          throw new Error(
            `Trim end time (${endSeconds}s) exceeds file duration (${duration}s)`,
          );
        }

        processedPath = await trimAudio(
          downloadedPath,
          startSeconds,
          endSeconds,
          handleProgress,
        );

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

        if (!downloadedPath || !processedPath) {
          throw new Error("Download or processing failed");
        }

        const newBytes = fs.statSync(processedPath).size;
        const finalReport = t("trim_done", userLang).replace(
          "{{newSize}}",
          formatSize(newBytes),
        );

        try {
          await ctx.telegram.editMessageText(
            ctx.chat!.id,
            processingMsg.message_id,
            undefined,
            t("uploading", userLang),
          );
        } catch (err) {}

        let finalFileName = mediaData.fileName;
        if (finalFileName) {
          const nameWithoutExt = path.parse(finalFileName).name;
          // Trim always outputs .mp3 currently
          finalFileName = `${nameWithoutExt}.mp3`;
        }

        const fileOpts = {
          source: processedPath,
          ...(finalFileName ? { filename: finalFileName } : {}),
        };
        await ctx.replyWithAudio(fileOpts as any, { caption: finalReport });

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
