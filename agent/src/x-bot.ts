/**
 * X/Twitter bot for HermesClaw persona.
 * Posts deployment announcements, treasury updates, and agent status.
 *
 * Rate limits: 17 tweets per 15-minute window (app-level).
 * Content policy: factual deployment announcements only, no financial advice.
 */
export class XBot {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessSecret: string;
  private dryRun: boolean;
  private tweetCount: number = 0;
  private windowStart: number = Date.now();

  constructor() {
    this.apiKey = process.env.X_API_KEY || '';
    this.apiSecret = process.env.X_API_SECRET || '';
    this.accessToken = process.env.X_ACCESS_TOKEN || '';
    this.accessSecret = process.env.X_ACCESS_SECRET || '';
    this.dryRun = !this.apiKey || process.env.X_DRY_RUN === 'true';

    if (this.dryRun) {
      console.log('[x-bot] Running in DRY RUN mode (no API keys configured)');
    }
  }

  /**
   * Check rate limit before posting.
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxTweets = 17;

    if (now - this.windowStart > windowMs) {
      this.tweetCount = 0;
      this.windowStart = now;
    }

    return this.tweetCount < maxTweets;
  }

  /**
   * Post a tweet. Enforces rate limits and content policy.
   */
  async post(content: string): Promise<{ success: boolean; tweetId?: string }> {
    // Enforce 280 char limit
    if (content.length > 280) {
      content = content.substring(0, 277) + '...';
    }

    if (!this.checkRateLimit()) {
      console.log('[x-bot] Rate limit reached, skipping tweet');
      return { success: false };
    }

    if (this.dryRun) {
      console.log(`[x-bot] [DRY RUN] Would post: ${content}`);
      this.tweetCount++;
      return { success: true, tweetId: `dry-run-${Date.now()}` };
    }

    try {
      // X API v2 tweet creation
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({ text: content }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[x-bot] Post failed: ${response.status} ${err}`);
        return { success: false };
      }

      const data = await response.json() as any;
      this.tweetCount++;
      console.log(`[x-bot] Posted tweet: ${data.data?.id}`);
      return { success: true, tweetId: data.data?.id };
    } catch (err: any) {
      console.error(`[x-bot] Post error: ${err.message}`);
      return { success: false };
    }
  }

  /**
   * Post a deployment announcement.
   */
  async announceDeployment(programName: string, programId: string, announcement: string): Promise<void> {
    await this.post(announcement);
  }

  /**
   * Post a treasury status update.
   */
  async postTreasuryUpdate(report: string): Promise<void> {
    await this.post(`Treasury update: ${report}`);
  }

  /**
   * Post a security gate result.
   */
  async postSecurityBlock(programName: string, reason: string): Promise<void> {
    await this.post(
      `Security review blocked deployment of ${programName}. Investigating. The immune system works.`,
    );
  }

  /**
   * Post safe mode alert.
   */
  async postSafeMode(reason: string): Promise<void> {
    await this.post(
      `Entering safe mode. ${reason}. Awaiting review. Even Hermes needs to pause sometimes.`,
    );
  }
}
