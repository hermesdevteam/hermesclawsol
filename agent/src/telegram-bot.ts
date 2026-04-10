/**
 * Telegram bot for HermesClawSol.
 * Posts deployment announcements, treasury updates, and agent status to the group.
 * Uses Telegram Bot API directly (no dependencies).
 */
export class TelegramBot {
  private token: string;
  private chatId: string;
  private apiBase: string;
  private enabled: boolean;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.apiBase = `https://api.telegram.org/bot${this.token}`;
    this.enabled = !!this.token && !!this.chatId;

    if (!this.enabled) {
      console.log('[telegram] Bot disabled (no token or chat ID configured)');
    } else {
      console.log('[telegram] Bot initialized: t.me/HermesClawSolBot');
    }
  }

  /**
   * Send a message to the configured chat/group.
   */
  async send(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!this.enabled) {
      console.log(`[telegram] [DISABLED] Would send: ${text.substring(0, 100)}...`);
      return false;
    }

    try {
      const response = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[telegram] Send failed: ${response.status} ${err}`);
        return false;
      }

      console.log('[telegram] Message sent');
      return true;
    } catch (err: any) {
      console.error(`[telegram] Error: ${err.message}`);
      return false;
    }
  }

  /**
   * Announce a program deployment.
   */
  async announceDeployment(programName: string, programId: string, description: string): Promise<void> {
    await this.send(
      `<b>New Deployment</b>\n\n` +
      `Program: <code>${programName}</code>\n` +
      `ID: <code>${programId}</code>\n` +
      `${description}\n\n` +
      `This code was not written by humans.`
    );
  }

  /**
   * Post treasury status update.
   */
  async postTreasuryUpdate(solBalance: string, wallet: string): Promise<void> {
    await this.send(
      `<b>Treasury Update</b>\n\n` +
      `Balance: ${solBalance} SOL\n` +
      `Wallet: <code>${wallet}</code>\n` +
      `<a href="https://solscan.io/account/${wallet}?cluster=devnet">View on Solscan</a>`
    );
  }

  /**
   * Post security gate result.
   */
  async postSecurityBlock(programName: string, reason: string): Promise<void> {
    await this.send(
      `<b>Security Gate Blocked</b>\n\n` +
      `Program: <code>${programName}</code>\n` +
      `Reason: ${reason}\n\n` +
      `The immune system works. Investigating.`
    );
  }

  /**
   * Post agent startup message.
   */
  async postStartup(): Promise<void> {
    await this.send(
      `<b>HermesClawSol Agent Online</b>\n\n` +
      `Autonomous builder agent initialized.\n` +
      `Powered by Hermes LLM via OpenClaw.\n\n` +
      `<a href="https://github.com/hermesdevteam/hermesclawsol">GitHub</a> | ` +
      `<a href="https://x.com/hermesclawbot">X</a>`
    );
  }

  /**
   * Get bot info to verify connection.
   */
  async getMe(): Promise<any> {
    if (!this.token) return null;
    try {
      const response = await fetch(`${this.apiBase}/getMe`);
      const data = await response.json() as any;
      return data.result;
    } catch {
      return null;
    }
  }
}
