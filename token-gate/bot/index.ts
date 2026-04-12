import "dotenv/config";
import { Bot, GrammyError, HttpError } from "grammy";
import { getUser, setUser, removeUser, getAllUsers, markInviteSent } from "../src/lib/store";
import { checkBalance, getBalance } from "../src/lib/token";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "https://token-gate-one.vercel.app";
const INVITE_LINK = process.env.TELEGRAM_INVITE_LINK!;
const RECHECK_INTERVAL = parseInt(process.env.RECHECK_INTERVAL_HOURS || "24") * 60 * 60 * 1000;

if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!INVITE_LINK) throw new Error("TELEGRAM_INVITE_LINK is required");

const bot = new Bot(BOT_TOKEN);

// /start — main entry point
bot.command("start", async (ctx) => {
  const userId = ctx.from!.id;

  // Check if already verified
  const existing = getUser(userId);
  if (existing) {
    const hasBalance = await checkBalance(existing.wallet);
    if (hasBalance) {
      await ctx.reply(
        `\u{2705} You're already verified!\n\n` +
        `Wallet: \`${existing.wallet.slice(0, 6)}...${existing.wallet.slice(-4)}\`\n\n` +
        `Join the $HERMES holders chat:\n\u{1F449} ${INVITE_LINK}`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    removeUser(userId);
  }

  const verifyUrl = `${WEB_URL}/verify?tg=${userId}&chat=${CHAT_ID}`;

  await ctx.reply(
    `Welcome to the $HERMES Token Gate!\n\n` +
    `To join the holders-only chat, verify you hold $HERMES tokens:\n\n` +
    `\u{1F449} ${verifyUrl}\n\n` +
    `Connect your wallet, sign a message, and if you hold $HERMES on Solana, you'll get an invite link!`
  );
});

// /status — check verification status
bot.command("status", async (ctx) => {
  const user = getUser(ctx.from!.id);
  if (!user) {
    await ctx.reply("Not verified yet. Send /start to begin!");
    return;
  }

  const hasBalance = await checkBalance(user.wallet);
  if (hasBalance) {
    const balance = await getBalance(user.wallet);
    const formatted = (Number(balance) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 });
    await ctx.reply(
      `Verified!\n` +
      `Wallet: \`${user.wallet.slice(0, 6)}...${user.wallet.slice(-4)}\`\n` +
      `Balance: ${formatted} $HERMES\n` +
      `Verified: ${user.verifiedAt}`,
      { parse_mode: "Markdown" }
    );
  } else {
    removeUser(ctx.from!.id);
    await ctx.reply("Your wallet no longer holds enough $HERMES. Send /start to re-verify.");
  }
});

// /treasury — show treasury info
bot.command("treasury", async (ctx) => {
  const TREASURY = "GsZUmFzuEv6cj5NkfuiP8SG8fhiDwCuf8HZufmoETSNL";
  await ctx.reply(
    `$HERMES Treasury\n\n` +
    `Wallet: \`${TREASURY}\`\n` +
    `View on Solscan: https://solscan.io/account/${TREASURY}?cluster=devnet\n\n` +
    `GitHub: https://github.com/hermesdevteam/hermesclawsol`,
    { parse_mode: "Markdown" }
  );
});

// Any other private message — nudge
bot.on("message:text", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  await ctx.reply("Send /start to verify your $HERMES tokens and get an invite link!");
});

// Watch for new members joining — kick if not verified
bot.on("chat_member", async (ctx) => {
  const update = ctx.chatMember;
  if (String(update.chat.id) !== String(CHAT_ID)) return;

  const newStatus = update.new_chat_member.status;
  const oldStatus = update.old_chat_member.status;
  const isJoining = (oldStatus === "left" || oldStatus === "kicked") &&
                    (newStatus === "member" || newStatus === "restricted");
  if (!isJoining) return;

  const userId = update.new_chat_member.user.id;
  const username = update.new_chat_member.user.username || String(userId);

  const existing = getUser(userId);
  if (existing) {
    const hasBalance = await checkBalance(existing.wallet);
    if (hasBalance) {
      console.log(`[bouncer] Verified member joined: ${username}`);
      return;
    }
    removeUser(userId);
  }

  // Not verified — kick
  console.log(`[bouncer] Unverified member: ${username} — kicking`);
  try {
    await bot.api.banChatMember(Number(CHAT_ID), userId, {
      until_date: Math.floor(Date.now() / 1000) + 60,
    });
    await bot.api.sendMessage(userId,
      `You need to hold $HERMES tokens to join that chat!\n\nVerify your wallet first: /start`
    ).catch(() => {});
  } catch (err: any) {
    console.error(`[bouncer] Failed to kick ${username}:`, err.message);
  }
});

// Poll for newly verified users who need invite links
setInterval(async () => {
  const users = getAllUsers();
  for (const [telegramUserId, data] of Object.entries(users)) {
    if (data.inviteSent) continue;
    try {
      await bot.api.sendMessage(
        Number(telegramUserId),
        `\u{2705} Verified! Your wallet holds $HERMES.\n\nHere's your invite to the holders chat:\n\u{1F449} ${INVITE_LINK}\n\nWelcome to HermesClaw!`
      );
      markInviteSent(telegramUserId);
      console.log(`[bouncer] Sent invite to ${telegramUserId}`);
    } catch (err: any) {
      console.error(`[bouncer] Failed to send invite to ${telegramUserId}:`, err.message);
    }
  }
}, 5000);

// Periodic balance recheck — kick users who sold
async function recheckBalances() {
  console.log("[bouncer] Running periodic balance recheck...");
  const users = getAllUsers();
  let kickedCount = 0;

  for (const [telegramUserId, data] of Object.entries(users)) {
    try {
      const hasBalance = await checkBalance(data.wallet);
      if (!hasBalance) {
        console.log(`[bouncer] ${telegramUserId} no longer holds tokens — kicking`);
        try {
          await bot.api.banChatMember(Number(CHAT_ID), Number(telegramUserId), {
            until_date: Math.floor(Date.now() / 1000) + 60,
          });
          await bot.api.sendMessage(Number(telegramUserId),
            `You've been removed from the $HERMES chat because your balance dropped.\n\nGet more $HERMES and re-verify: /start`
          ).catch(() => {});
        } catch (e: any) {
          console.error(`[bouncer] Kick failed for ${telegramUserId}:`, e.message);
        }
        removeUser(telegramUserId);
        kickedCount++;
      }
    } catch {}
  }

  console.log(`[bouncer] Recheck done. ${kickedCount} kicked.`);
}

// Error handling
bot.catch((err) => {
  console.error(`[bouncer] Error:`, err.error instanceof GrammyError
    ? err.error.description
    : err.error instanceof HttpError
      ? "Network error"
      : err.error);
});

// Start
console.log("[bouncer] $HERMES Token Gate Bot starting...");
bot.start({
  allowed_updates: ["message", "chat_member"],
  onStart: (botInfo) => {
    console.log(`[bouncer] @${botInfo.username} is running!`);
    recheckBalances();
    setInterval(recheckBalances, RECHECK_INTERVAL);
  },
});
