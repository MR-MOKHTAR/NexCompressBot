import { Telegraf, session } from "telegraf";
import { config } from "dotenv";
import { handleAudio } from "./handlers/mediaHandler";
import { handleCallback } from "./handlers/callbackHandler";
import { handleTextInput } from "./handlers/textHandler";
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

const bot = new Telegraf(BOT_TOKEN, {
  handlerTimeout: 9_000_000,
  ...(process.env.TELEGRAM_API_ROOT
    ? {
        telegram: {
          apiRoot: process.env.TELEGRAM_API_ROOT,
        },
      }
    : {}),
});

bot.use(session());

bot.start(async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const userLang =
    (await getUserLang(userId)) || ctx.from?.language_code || "en";
  ctx.reply(t("welcome", userLang));
});

bot.command("lang", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const userLang =
    (await getUserLang(userId)) || ctx.from?.language_code || "en";

  ctx.reply(t("select_language", userLang), {
    reply_markup: getLanguageKeyboard().reply_markup,
  });
});

bot.on(["audio", "voice"], handleAudio);

bot.on("callback_query", handleCallback);

bot.on("text", handleTextInput);

// Catch errors
bot.catch(async (err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
  if (ctx.from) {
    const userLang =
      (await getUserLang(ctx.from.id)) || ctx.from?.language_code || "en";
    ctx.reply(t("error_generic", userLang)).catch(console.error);
  }
});

let stopping = false;

async function startBot() {
  while (!stopping) {
    try {
      console.log("Connecting to Telegram...");
      // bot.launch() resolves only after bot.stop() is called, or rejects
      // if the polling loop hits an error telegraf doesn't retry itself
      // (e.g. a connection reset while the local Bot API server restarts).
      await bot.launch();
      break;
    } catch (err) {
      if (stopping) break;
      console.error("Bot polling crashed, restarting in 5s:", err);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  console.log("Bot stopped.");
}

startBot();

// Prevent transient/unexpected errors elsewhere from killing the whole process.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

// Enable graceful stop
process.once("SIGINT", () => {
  stopping = true;
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  stopping = true;
  bot.stop("SIGTERM");
});
