import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { readFileSync } from 'fs';

export interface TreasuryStatus {
  solBalance: number;
  solBalanceLamports: bigint;
  walletAddress: string;
}

/**
 * Treasury management: monitor balances, track royalties.
 * The actual burn/distribute operations happen via the on-chain hermes-treasury program.
 * This module handles off-chain monitoring and reporting.
 */
export class TreasuryManager {
  private connection: Connection;
  private keypair: Keypair;

  constructor(rpcUrl?: string, keypairPath?: string) {
    this.connection = new Connection(
      rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed',
    );

    const kpPath = keypairPath || process.env.TREASURY_KEYPAIR_PATH || './treasury-keypair.json';
    const secretKey = JSON.parse(readFileSync(kpPath, 'utf-8'));
    this.keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  }

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  get address(): string {
    return this.keypair.publicKey.toBase58();
  }

  /**
   * Get current SOL balance of the treasury wallet.
   */
  async getStatus(): Promise<TreasuryStatus> {
    const balanceLamports = await this.connection.getBalance(this.keypair.publicKey);
    return {
      solBalance: balanceLamports / LAMPORTS_PER_SOL,
      solBalanceLamports: BigInt(balanceLamports),
      walletAddress: this.address,
    };
  }

  /**
   * Request devnet airdrop (for testing only).
   */
  async requestAirdrop(solAmount: number = 2): Promise<string> {
    const signature = await this.connection.requestAirdrop(
      this.keypair.publicKey,
      solAmount * LAMPORTS_PER_SOL,
    );
    await this.connection.confirmTransaction(signature);
    console.log(`[treasury] Airdrop ${solAmount} SOL: ${signature}`);
    return signature;
  }

  /**
   * Generate a treasury report for X posting.
   */
  async generateReport(): Promise<string> {
    const status = await this.getStatus();
    return `Treasury: ${status.solBalance.toFixed(4)} SOL | Wallet: ${status.walletAddress}`;
  }
}
