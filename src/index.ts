import { Telegraf } from "telegraf";
import { config } from "dotenv";
import { handleAudio, handleVideo } from "./handlers/mediaHandler";
import { handleCallback } from "./handlers/callbackHandler";
import { t } from "./i18n";
import { initDb, getUserLang } from "./utils/db";
import { getLanguageKeyboard } from "./keyboards/qualityKeyboard";

config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing in .env properties");
  process.exit(1);
}

// Initialize SQLite database
initDb();

const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 9_000_000 });

bot.start(async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const userLang = (await getUserLang(userId)) || ctx.from?.language_code || "en";
  ctx.reply(t("welcome", userLang));
});

bot.command("language", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const userLang = (await getUserLang(userId)) || ctx.from?.language_code || "en";
  
  ctx.reply(t("select_language", userLang), {
    reply_markup: getLanguageKeyboard().reply_markup
  });
});

bot.on(["audio", "voice"], handleAudio);
bot.on(["video", "video_note", "document"], handleVideo);

bot.on("callback_query", handleCallback);

// Catch errors
bot.catch(async (err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  if (ctx.from) {
    const userLang = (await getUserLang(ctx.from.id)) || ctx.from?.language_code || "en";
    ctx.reply(t("error_generic", userLang)).catch(console.error);
  }
});

bot.launch().then(() => {
  console.log("Bot started successfully.");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
