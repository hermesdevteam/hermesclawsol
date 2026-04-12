"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, Suspense } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import bs58 from "bs58";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

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

      const nonceRes = await fetch(`/api/nonce?tg=${tg}&chat=${chat}`);
      const { nonce } = await nonceRes.json();

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

      const messageBytes = new TextEncoder().encode(signMessageText);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      setStatus("verifying");
      setMessage("Verifying on-chain balance...");

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
            ? "Verified! You hold $HERMES. Welcome aboard."
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

  const isLoading = status === "signing" || status === "verifying";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "#0a0a0f",
        color: "#e0e0e0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        {/* Logo */}
        <img
          src="/bouncer.png"
          alt="HermesClaw Bouncer"
          style={{
            width: 120,
            height: 120,
            borderRadius: "16px",
            margin: "0 auto 1.5rem",
            boxShadow: "0 0 40px rgba(124, 58, 237, 0.3), 0 0 80px rgba(34, 197, 94, 0.15)",
          }}
        />

        {/* Title */}
        <h1
          style={{
            fontSize: "1.75rem",
            marginBottom: "0.5rem",
            fontWeight: 700,
            background: "linear-gradient(90deg, #7c3aed, #22c55e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          $HERMES Token Gate
        </h1>
        <p style={{ color: "#888", marginBottom: "2rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
          Connect your Solana wallet and verify you hold $HERMES to join the exclusive holders chat
        </p>

        {missingParams ? (
          <div style={errorStyle}>
            Missing verification parameters. Message{" "}
            <a href="https://t.me/HermesClawSolBot" style={{ color: "#7c3aed", textDecoration: "underline" }}>
              @HermesClawSolBot
            </a>{" "}
            on Telegram to get started.
          </div>
        ) : (
          <>
            {/* Step indicators */}
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <StepDot active={!connected} done={connected} label="1" />
              <div style={{ width: 30, height: 1, background: "#333", alignSelf: "center" }} />
              <StepDot active={connected && status === "idle"} done={status === "success"} label="2" />
              <div style={{ width: 30, height: 1, background: "#333", alignSelf: "center" }} />
              <StepDot active={isLoading} done={status === "success"} label="3" />
            </div>

            {/* Step label */}
            <p style={{ color: "#555", fontSize: "0.75rem", marginBottom: "1.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {!connected
                ? "Step 1: Connect Wallet"
                : status === "idle"
                  ? "Step 2: Verify Holdings"
                  : status === "success"
                    ? "Verified"
                    : "Step 3: Checking Balance..."}
            </p>

            {/* Wallet connect */}
            <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "center" }}>
              <WalletMultiButton
                style={{
                  background: connected ? "#1a1a2e" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  borderRadius: "12px",
                  fontSize: "0.9rem",
                  height: "48px",
                  border: connected ? "1px solid #333" : "none",
                }}
              />
            </div>

            {/* Connected wallet display */}
            {connected && publicKey && (
              <div
                style={{
                  background: "#111118",
                  border: "1px solid #1e1e2e",
                  borderRadius: "12px",
                  padding: "0.75rem 1rem",
                  marginBottom: "1.5rem",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  color: "#7c3aed",
                  wordBreak: "break-all",
                }}
              >
                {publicKey.toBase58()}
              </div>
            )}

            {/* Verify button */}
            {connected && status !== "success" && (
              <button
                onClick={verify}
                disabled={isLoading}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "14px 32px",
                  background: isLoading
                    ? "#333"
                    : "linear-gradient(135deg, #7c3aed, #22c55e)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isLoading ? "none" : "0 4px 20px rgba(124, 58, 237, 0.3)",
                }}
              >
                {isLoading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    <Spinner /> Verifying...
                  </span>
                ) : (
                  "Verify $HERMES Holdings"
                )}
              </button>
            )}

            {/* Status message */}
            {message && (
              <div
                style={{
                  marginTop: "1.5rem",
                  padding: "1rem 1.25rem",
                  borderRadius: "12px",
                  fontSize: "0.9rem",
                  lineHeight: 1.5,
                  ...(status === "error" ? errorStyle : status === "success" ? successStyle : infoStyle),
                }}
              >
                {status === "success" && <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.5rem" }}>&#10003;</span>}
                {message}
              </div>
            )}

            {/* Join button */}
            {status === "success" && inviteLink && (
              <a
                href={inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  marginTop: "1rem",
                  padding: "14px 32px",
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "white",
                  borderRadius: "12px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 4px 20px rgba(34, 197, 94, 0.3)",
                  transition: "all 0.2s ease",
                }}
              >
                Join the $HERMES Holders Chat
              </a>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: "3rem", fontSize: "0.75rem", color: "#444" }}>
          <a href="https://x.com/hermesclawbot" style={{ color: "#555", marginRight: "1rem" }}>X</a>
          <a href="https://t.me/HermesClawSolBot" style={{ color: "#555", marginRight: "1rem" }}>Telegram</a>
          <a href="https://github.com/hermesdevteam/hermesclawsol" style={{ color: "#555" }}>GitHub</a>
          <p style={{ marginTop: "0.75rem", color: "#333" }}>Built by HermesClawBot. Not by humans.</p>
        </div>
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 600,
        border: `2px solid ${done ? "#22c55e" : active ? "#7c3aed" : "#333"}`,
        background: done ? "#22c55e" : active ? "#7c3aed22" : "transparent",
        color: done ? "white" : active ? "#7c3aed" : "#555",
        transition: "all 0.3s ease",
      }}
    >
      {done ? "\u2713" : label}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="#666" strokeWidth="2" />
      <path d="M8 2 A6 6 0 0 1 14 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const errorStyle = { background: "#2d1515", color: "#ff6b6b", border: "1px solid rgba(255,107,107,0.2)" };
const successStyle = { background: "#0d2d0d", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" };
const infoStyle = { background: "#0d0d2d", color: "#7c7cff", border: "1px solid rgba(124,124,255,0.2)" };

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
              <div style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0a0a0f",
              }}>
                <img
                  src="/bouncer.png"
                  alt="HermesClaw Bouncer"
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "16px",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
                <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
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
