import { Context } from "telegraf";
import {
  getMedia,
  getActiveUserMergeSession,
  getMergeSession,
  deleteMergeSession,
  createMergeSession,
} from "../utils/store";
import { downloadFile, cleanupFiles } from "../utils/fileHelper";
import { processAudio } from "../processors/audioProcessor";
import { convertAudio } from "../processors/formatConverter";
import {
  trimAudio,
  getAudioDuration,
  parseTimeInput,
} from "../processors/audioTrimmer";
import {
  mergeAudios,
  getTotalDuration,
  formatDuration,
} from "../processors/audioMerger";
import { t } from "../i18n";
import { getUserLang, setUserLang } from "../utils/db";
import { processingQueue } from "../utils/queueManager";
import {
  getAudioKeyboard,
  getFormatKeyboard,
  getTrimKeyboard,
  getMergeKeyboard,
} from "../keyboards/qualityKeyboard";
import fs from "fs";
import path from "path";

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

  // Handle operation menu routing
  if (data.startsWith("op_")) {
    const parts = data.split("_");
    if (parts.length === 3) {
      const [, operationType, shortId] = parts;
      const mediaData = getMedia(shortId);

      if (!mediaData) {
        await ctx.answerCbQuery(t("error_generic", userLang), {
          show_alert: true,
        });
        return;
      }

      await ctx.answerCbQuery();

      // Route to appropriate keyboard based on operation type
      if (operationType === "compress") {
        // @ts-ignore
        await ctx.editMessageText(t("select_audio_quality", userLang), {
          reply_markup: getAudioKeyboard(shortId).reply_markup,
        });
      } else if (operationType === "convert") {
        // @ts-ignore
        await ctx.editMessageText(t("select_format", userLang), {
          reply_markup: getFormatKeyboard(shortId).reply_markup,
        });
      } else if (operationType === "trim") {
        // Get audio duration for adaptive trim keyboard
        try {
          const fileUrl = await ctx.telegram.getFileLink(mediaData.fileId);
          const tempFile = await downloadFile(fileUrl.href, ".mp3");
          const duration = await getAudioDuration(tempFile);
          cleanupFiles(tempFile);

          // @ts-ignore
          await ctx.editMessageText(t("select_trim_option", userLang), {
            reply_markup: getTrimKeyboard(shortId, duration, userLang).reply_markup,
          });
        } catch (err) {
          console.error("Error getting audio duration:", err);
          await ctx.reply(t("error_generic", userLang));
        }
      } else if (operationType === "merge") {
        const activeSession = getActiveUserMergeSession(userId);
        if (activeSession) {
          // Session exists, create a new one
          const newSessionId = createMergeSession(userId);
          await ctx.answerCbQuery();
          await ctx.reply(t("merge_start_session", userLang));
        } else {
          // No session exists, create one
          const sessionId = createMergeSession(userId);
          await ctx.answerCbQuery();
          await ctx.reply(t("merge_start_session", userLang));
        }
      }
    }
    return;
  }

  // Handle merge continue callback
  if (data === "merge_continue") {
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    // User will send next file, no action needed
    return;
  }

  // Handle merge cancel callback
  if (data.startsWith("m_cancel_")) {
    const sessionId = data.replace("m_cancel_", "");
    const session = getMergeSession(sessionId);

    if (session && session.userId === userId) {
      deleteMergeSession(sessionId);
      await ctx.answerCbQuery();
      await ctx.editMessageText(t("merge_canceled", userLang));
    } else {
      await ctx.answerCbQuery(t("error_generic", userLang), {
        show_alert: true,
      });
    }
    return;
  }

  // Handle merge execution callback
  if (data.startsWith("m_go_")) {
    const sessionId = data.replace("m_go_", "");
    const session = getMergeSession(sessionId);

    if (!session || session.userId !== userId || session.files.length < 2) {
      await ctx.answerCbQuery(t("error_generic", userLang), {
        show_alert: true,
      });
      return;
    }

    await ctx.answerCbQuery();

    const queuePos = processingQueue.getQueueLength();
    let initialText = "";
    if (queuePos > 0) {
      initialText = t("queued", userLang).replace(
        "{{pos}}",
        queuePos.toString(),
      );
    } else {
      initialText = t("processing", userLang).replace(
        "{{progress}}",
        buildProgressBar(0),
      );
    }

    const processingMsg = await ctx.reply(initialText);

    processingQueue.enqueue({
      userId,
      operationType: "merge",
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

        const filePaths: string[] = [];
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
          // Download all files
          for (const file of session.files) {
            const fileUrl = await ctx.telegram.getFileLink(file.fileId);
            const filePath = await downloadFile(fileUrl.href, ".mp3");
            filePaths.push(filePath);
          }

          await handleProgress(10);

          // Merge all files
          const mergedPath = await mergeAudios(filePaths, handleProgress);

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

          const mergedSize = fs.statSync(mergedPath).size;
          const totalDur = await getTotalDuration(filePaths);
          const finalReport = t("merge_done", userLang)
            .replace("{{fileCount}}", session.files.length.toString())
            .replace("{{duration}}", formatDuration(totalDur))
            .replace("{{newSize}}", formatSize(mergedSize));

          try {
            await ctx.telegram.editMessageText(
              ctx.chat!.id,
              processingMsg.message_id,
              undefined,
              t("uploading", userLang),
            );
          } catch (err) {}

          let mergeFileName = "merged_audio.mp3";
          if (session.files.length > 0 && session.files[0].fileName) {
            const nameWithoutExt = path.parse(session.files[0].fileName).name;
            mergeFileName = `${nameWithoutExt}_merged.mp3`;
          }

          await ctx.replyWithAudio(
            { source: mergedPath, filename: mergeFileName },
            { caption: finalReport },
          );

          await ctx.telegram
            .deleteMessage(ctx.chat!.id, processingMsg.message_id)
            .catch(() => {});

          // Cleanup session
          deleteMergeSession(sessionId);
        } catch (error) {
          console.error("Merge error:", error);
          await ctx.reply(t("error_generic", userLang));
          deleteMergeSession(sessionId);
        } finally {
          // Cleanup downloaded files
          for (const filePath of filePaths) {
            cleanupFiles(filePath);
          }
        }
      },
    });
    return;
  }

  // data format: {type}_{param}_{shortId}  e.g.  a_128k_abcd1234, c_mp3_abcd1234, t_first30_abcd1234
  const parts = data.split("_");
  if (parts.length < 3) return;

  const typeCode = parts[0];
  const shortId = parts[parts.length - 1]; // Last part is always shortId
  const mediaData = getMedia(shortId);

  if (!mediaData) {
    await ctx.answerCbQuery(t("error_generic", userLang), { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();

  // Determine operation type and parameters from callback data
  let operationType: "compress" | "convert" | "trim" | "merge" = "compress";
  let operationParam = "";

  if (typeCode === "a") {
    // Compression: a_128k_shortId
    operationType = "compress";
    operationParam = parts[1]; // quality (e.g., "128k")
  } else if (typeCode === "c") {
    // Format conversion: c_mp3_shortId
    operationType = "convert";
    operationParam = parts[1]; // format (e.g., "mp3")
  } else if (typeCode === "t") {
    // Trim: t_first30_shortId or t_custom_shortId
    operationType = "trim";
    operationParam = parts[1]; // trim type (e.g., "first30", "last10", "custom")
  } else {
    return; // Unknown operation
  }

  // Handle custom trim input (requires text input from user)
  if (operationType === "trim" && operationParam === "custom") {
    await ctx.reply(t("trim_enter_start", userLang));
    // @ts-ignore
    ctx.session = ctx.session || {};
    // @ts-ignore
    ctx.session.trimMode = shortId;
    // @ts-ignore
    ctx.session.trimStep = "start";
    return;
  }

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
  const msgId =
    message && "reply_to_message" in message
      ? (message as any).reply_to_message?.message_id
      : undefined;

  const processingMsg = await ctx.reply(initialText, {
    ...(msgId ? { reply_parameters: { message_id: msgId } } : {}),
  });

  processingQueue.enqueue({
    userId,
    operationType,
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
        downloadedPath = await downloadFile(fileUrl.href, ".mp3");

        // Ensure it updates processing status during a long task
        await handleProgress(10); // Start processing immediately after download finishes

        // Process based on operation type
        if (operationType === "compress") {
          processedPath = await processAudio(
            downloadedPath!,
            operationParam, // quality
            handleProgress,
          );
        } else if (operationType === "convert") {
          processedPath = await convertAudio(
            downloadedPath!,
            operationParam as any, // format
            handleProgress,
          );
        } else if (operationType === "trim") {
          // Calculate start and end times based on trim type
          const duration = await getAudioDuration(downloadedPath!);
          let startSeconds = 0;
          let endSeconds = Math.min(30, duration); // Default to first 30 or less

          if (operationParam === "first10") {
            startSeconds = 0;
            endSeconds = Math.min(10, duration);
          } else if (operationParam === "first30") {
            startSeconds = 0;
            endSeconds = Math.min(30, duration);
          } else if (operationParam === "first60") {
            startSeconds = 0;
            endSeconds = Math.min(60, duration);
          } else if (operationParam === "first120") {
            startSeconds = 0;
            endSeconds = Math.min(120, duration);
          } else if (operationParam === "last10") {
            startSeconds = Math.max(0, duration - 10);
            endSeconds = duration;
          } else if (operationParam === "last30") {
            startSeconds = Math.max(0, duration - 30);
            endSeconds = duration;
          } else if (operationParam === "last60") {
            startSeconds = Math.max(0, duration - 60);
            endSeconds = duration;
          } else if (operationParam === "last120") {
            startSeconds = Math.max(0, duration - 120);
            endSeconds = duration;
          }

          processedPath = await trimAudio(
            downloadedPath!,
            startSeconds,
            endSeconds,
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

        // Ensure paths exist before stat'ing
        if (!downloadedPath || !processedPath) {
          throw new Error("Download or processing failed");
        }

        const oldBytes = fs.statSync(downloadedPath).size;
        const newBytes = fs.statSync(processedPath).size;
        const savedPercent =
          oldBytes > 0
            ? (((oldBytes - newBytes) / oldBytes) * 100).toFixed(1)
            : "0.0";

        let finalReport = "";
        if (operationType === "compress") {
          finalReport = t("done_stats", userLang)
            .replace("{{oldSize}}", formatSize(oldBytes))
            .replace("{{newSize}}", formatSize(newBytes))
            .replace("{{savedPercent}}", savedPercent);
        } else if (operationType === "convert") {
          finalReport = t("convert_done", userLang)
            .replace("{{format}}", operationParam.toUpperCase())
            .replace("{{newSize}}", formatSize(newBytes));
        } else if (operationType === "trim") {
          finalReport = t("trim_done", userLang).replace(
            "{{newSize}}",
            formatSize(newBytes),
          );
        }

        // Determine upload method
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
          if (operationType === "convert") {
            finalFileName = `${nameWithoutExt}.${operationParam}`;
          } else {
            // For compress and trim, we always output .mp3 currently
            finalFileName = `${nameWithoutExt}.mp3`;
          }
        }

        const fileOpts = {
          source: processedPath,
          ...(finalFileName ? { filename: finalFileName } : {}),
        };
        await ctx.replyWithAudio(fileOpts as any, { caption: finalReport });

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
