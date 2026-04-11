import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, removeUser } from "~/lib/store";
import { checkBalance } from "~/lib/token";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const RECHECK_SECRET = process.env.NONCE_SECRET!;

async function kickUser(telegramUserId: string) {
  // Ban for 60 seconds = kick (they can rejoin if re-verified)
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/banChatMember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: Number(CHAT_ID),
      user_id: Number(telegramUserId),
      until_date: Math.floor(Date.now() / 1000) + 60,
    }),
  });

  // DM notification
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: Number(telegramUserId),
      text: `You've been removed from the $HERMES holders chat because your balance dropped below the minimum.\n\nGet more $HERMES and re-verify anytime: /start`,
    }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const cronHeader = req.headers.get("authorization");
  const isVercelCron = cronHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && secret !== RECHECK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = getAllUsers();
  const results = { kicked: [] as string[], ok: [] as string[], errors: [] as string[] };

  for (const [tgUserId, data] of Object.entries(users)) {
    try {
      const hasBalance = await checkBalance(data.wallet);
      if (!hasBalance) {
        await kickUser(tgUserId);
        removeUser(tgUserId);
        results.kicked.push(tgUserId);
      } else {
        results.ok.push(tgUserId);
      }
    } catch (err: any) {
      results.errors.push(`${tgUserId}: ${err.message}`);
    }
  }

  return NextResponse.json(results);
}
