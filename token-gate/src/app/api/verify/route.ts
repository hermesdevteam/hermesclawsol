import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyNonce } from "~/lib/nonce";
import { checkBalance } from "~/lib/token";
import { setUser } from "~/lib/store";

const INVITE_LINK = process.env.TELEGRAM_INVITE_LINK;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramInvite(telegramUserId: string) {
  if (!BOT_TOKEN || !INVITE_LINK) return null;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: Number(telegramUserId),
        text: `✅ Verified! Your wallet holds $HERMES.\n\nHere's your invite to the holders chat:\n👉 ${INVITE_LINK}\n\nWelcome to HermesClaw!`,
      }),
    });
    return INVITE_LINK;
  } catch (err: any) {
    console.error("[verify] Telegram send failed:", err.message);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, signature, message } = await req.json();

    if (!walletAddress || !signature || !message) {
      return NextResponse.json({ error: "Missing walletAddress, signature, or message" }, { status: 400 });
    }

    // Verify the signature using tweetnacl
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Extract nonce from the signed message and verify it
    const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9_-]+)/);
    if (!nonceMatch) {
      return NextResponse.json({ error: "Nonce not found in message" }, { status: 400 });
    }

    const nonceData = verifyNonce(nonceMatch[1]);
    if (!nonceData) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 400 });
    }

    // Check $HERMES token balance
    const hasBalance = await checkBalance(walletAddress);
    if (!hasBalance) {
      return NextResponse.json(
        { error: "Insufficient $HERMES balance. You need to hold $HERMES tokens on Solana." },
        { status: 403 },
      );
    }

    // Save verification
    setUser(nonceData.tg, walletAddress, nonceData.chat);

    // Send invite via Telegram DM
    const inviteLink = await sendTelegramInvite(nonceData.tg);

    console.log(`[verify] Verified: tg=${nonceData.tg} wallet=${walletAddress}`);

    return NextResponse.json({
      success: true,
      address: walletAddress,
      telegramUserId: nonceData.tg,
      inviteLink: INVITE_LINK,
    });
  } catch (err: any) {
    console.error("[verify] Error:", err.message);
    return NextResponse.json({ error: "Verification failed: " + err.message }, { status: 400 });
  }
}
