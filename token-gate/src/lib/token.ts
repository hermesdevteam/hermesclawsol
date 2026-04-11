import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

const HERMES_TOKEN_MINT = process.env.NEXT_PUBLIC_HERMES_TOKEN_MINT || "";
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MIN_BALANCE = BigInt(process.env.HERMES_MIN_BALANCE || "1000000000"); // 1 HERMES (9 decimals)

let _connection: Connection | null = null;

function getConnection(): Connection {
  if (!_connection) _connection = new Connection(SOLANA_RPC, "confirmed");
  return _connection;
}

/**
 * Check if a wallet holds enough $HERMES SPL tokens.
 */
export async function checkBalance(walletAddress: string): Promise<boolean> {
  if (!HERMES_TOKEN_MINT) {
    console.warn("[token] HERMES_TOKEN_MINT not set, skipping balance check");
    return true; // Allow through if token not launched yet
  }

  try {
    const connection = getConnection();
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(HERMES_TOKEN_MINT);

    // Get the associated token account
    const ata = getAssociatedTokenAddressSync(mint, wallet);

    const account = await getAccount(connection, ata);
    return account.amount >= MIN_BALANCE;
  } catch (err: any) {
    // TokenAccountNotFoundError means 0 balance
    if (err.name === "TokenAccountNotFoundError") return false;
    console.error(`[token] Balance check failed for ${walletAddress}:`, err.message);
    return false;
  }
}

/**
 * Get raw token balance for a wallet.
 */
export async function getBalance(walletAddress: string): Promise<bigint> {
  if (!HERMES_TOKEN_MINT) return 0n;

  try {
    const connection = getConnection();
    const wallet = new PublicKey(walletAddress);
    const mint = new PublicKey(HERMES_TOKEN_MINT);
    const ata = getAssociatedTokenAddressSync(mint, wallet);
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return 0n;
  }
}
