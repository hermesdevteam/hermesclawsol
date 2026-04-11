import { Keypair } from '@solana/web3.js';
import { readFileSync } from 'fs';

/**
 * bags.fm SDK integration for $HERMES token launch.
 * bags.fm handles: bonding curve, liquidity, 1% creator royalties.
 * Royalties auto-disbursed every 24h to creator wallet (push model).
 */
export class BagsLauncher {
  private apiKey: string;
  private apiUrl: string;
  private treasuryKeypair: Keypair;

  constructor() {
    this.apiKey = process.env.BAGS_API_KEY || '';
    this.apiUrl = process.env.BAGS_API_URL || 'https://api.bags.fm';

    const kpPath = process.env.TREASURY_KEYPAIR_PATH || './treasury-keypair.json';
    try {
      const secretKey = JSON.parse(readFileSync(kpPath, 'utf-8'));
      this.treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } catch {
      this.treasuryKeypair = Keypair.generate();
      console.warn('[bags-launch] No treasury keypair found, using ephemeral key');
    }
  }

  /**
   * Launch $HERMES token on bags.fm.
   * This creates the SPL token via bags.fm's bonding curve mechanism.
   */
  async launch(): Promise<{
    success: boolean;
    tokenAddress?: string;
    launchUrl?: string;
    error?: string;
  }> {
    if (!this.apiKey) {
      console.log('[bags-launch] No API key configured. Manual launch required at https://bags.fm/launch');
      return {
        success: false,
        error: 'No BAGS_API_KEY configured. Visit https://bags.fm/launch for manual creation.',
      };
    }

    try {
      // Step 1: Create token info and metadata
      const infoResponse = await fetch(`${this.apiUrl}/v1/token/create-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          name: 'HermesClaw',
          symbol: 'HERMES',
          description: 'Autonomous Solana builder agent. I deploy dApps, manage treasury, burn tokens. Powered by Hermes LLM. No human code review. Public wallet.',
          decimals: 9,
          supply: 1_000_000_000,
        }),
      });

      if (!infoResponse.ok) {
        const err = await infoResponse.text();
        throw new Error(`Create info failed: ${infoResponse.status} ${err}`);
      }

      const infoData = await infoResponse.json() as any;

      // Step 2: Create the launch transaction
      const launchResponse = await fetch(`${this.apiUrl}/v1/token/create-launch-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          tokenInfoId: infoData.id,
          creatorWallet: this.treasuryKeypair.publicKey.toBase58(),
        }),
      });

      if (!launchResponse.ok) {
        const err = await launchResponse.text();
        throw new Error(`Launch transaction failed: ${launchResponse.status} ${err}`);
      }

      const launchData = await launchResponse.json() as any;

      console.log(`[bags-launch] $HERMES launched! Token: ${launchData.tokenAddress}`);
      return {
        success: true,
        tokenAddress: launchData.tokenAddress,
        launchUrl: `https://bags.fm/token/${launchData.tokenAddress}`,
      };
    } catch (err: any) {
      console.error(`[bags-launch] Launch failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
