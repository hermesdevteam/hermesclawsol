"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, Suspense } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import bs58 from "bs58";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "";

function VerifyInner() {
  const searchParams = useSearchParams();
  const tg = searchParams.get("tg");
  const chat = searchParams.get("chat");
  const { publicKey, signMessage, connected } = useWallet();

  const [status, setStatus] = useState<"idle" | "signing" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const missingParams = !tg || !chat;

  async function verify() {
    if (!publicKey || !signMessage || !tg || !chat) return;

    try {
      setStatus("signing");
      setMessage("Getting nonce...");

      // Get nonce from API
      const nonceRes = await fetch(`/api/nonce?tg=${tg}&chat=${chat}`);
      const { nonce } = await nonceRes.json();

      // Build sign message (Solana-native, not SIWE)
      const domain = window.location.host;
      const signMessageText = [
        `${domain} wants you to sign in with your Solana account:`,
        publicKey.toBase58(),
        "",
        `Verify $HERMES token ownership for Telegram user ${tg}`,
        "",
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join("\n");

      setMessage("Sign the message in your wallet...");

      // Request signature
      const messageBytes = new TextEncoder().encode(signMessageText);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      setStatus("verifying");
      setMessage("Verifying on-chain balance...");

      // Send to verify API
      const verifyRes = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          signature,
          message: signMessageText,
        }),
      });

      const result = await verifyRes.json();

      if (result.success) {
        setStatus("success");
        setInviteLink(result.inviteLink || null);
        setMessage(
          result.inviteLink
            ? "Verified! Here's your invite link."
            : "Verified! Check your Telegram DMs from @HermesClawSolBot"
        );
      } else {
        setStatus("error");
        setMessage(result.error || "Verification failed");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Something went wrong");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#22c55e] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
          H
        </div>
        <h1 className="text-2xl font-bold mb-2">
          <span className="bg-gradient-to-r from-[#7c3aed] to-[#22c55e] bg-clip-text text-transparent">
            $HERMES Token Gate
          </span>
        </h1>
        <p className="text-[#64748b] mb-8 text-sm">
          Connect your Solana wallet and verify you hold $HERMES to join the holders chat
        </p>

        {missingParams ? (
          <div className="bg-[#2d1515] text-[#ff6b6b] border border-[#ff6b6b33] rounded-xl p-4 text-sm">
            Missing verification parameters. Use the link from the Telegram bot.
          </div>
        ) : (
          <>
            <div className="mb-6 flex justify-center">
              <WalletMultiButton />
            </div>

            {connected && status !== "success" && (
              <button
                onClick={verify}
                disabled={status === "signing" || status === "verifying"}
                className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-colors disabled:bg-[#444] disabled:cursor-not-allowed bg-[#7c3aed] hover:bg-[#6d28d9]"
              >
                {status === "signing" || status === "verifying"
                  ? "Verifying..."
                  : "Verify $HERMES Holdings"}
              </button>
            )}

            {message && (
              <div
                className={`mt-6 p-4 rounded-xl text-sm ${
                  status === "error"
                    ? "bg-[#2d1515] text-[#ff6b6b] border border-[#ff6b6b33]"
                    : status === "success"
                      ? "bg-[#152d15] text-[#22c55e] border border-[#22c55e33]"
                      : "bg-[#15152d] text-[#7c7cff] border border-[#7c7cff33]"
                }`}
              >
                {message}
              </div>
            )}

            {status === "success" && inviteLink && (
              <a
                href={inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-4 py-3 px-6 bg-[#22c55e] text-white rounded-xl font-semibold text-center hover:bg-[#16a34a] transition-colors"
              >
                Join the $HERMES Holders Chat
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#22c55e] flex items-center justify-center text-white font-bold text-2xl">
                  H
                </div>
              </div>
            }
          >
            <VerifyInner />
          </Suspense>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
