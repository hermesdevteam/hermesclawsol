import { HermesClient } from './hermes';
import { Deployer } from './deployer';
import { SecurityGate } from './security-gate';
import { TreasuryManager } from './treasury';
import { XBot } from './x-bot';
import { TelegramBot } from './telegram-bot';

// Programs to deploy in priority order
const PROGRAM_QUEUE = [
  { name: 'hermes-treasury', configPath: './templates/token-config.json', description: 'Treasury ops: burn, buyback, distribute $HERMES' },
  { name: 'hermes-staking', configPath: './templates/staking-config.json', description: 'Stake $HERMES to earn yield from treasury distributions' },
  { name: 'hermes-prediction', configPath: './templates/prediction-config.json', description: 'Binary prediction markets with $HERMES' },
  { name: 'hermes-launchpad', configPath: './templates/launchpad-config.json', description: 'Token launchpad for community launches' },
  { name: 'hermes-nft', configPath: './templates/nft-config.json', description: 'Agent-generated NFT collection' },
];

const MAX_RETRIES = 3;
const SAFE_MODE_THRESHOLD = 3; // consecutive failures before safe mode

export type LoopStage = 'PLAN' | 'PARAMETERIZE' | 'BUILD' | 'TEST' | 'SECURITY' | 'DEPLOY' | 'ANNOUNCE' | 'TREASURY' | 'SLEEP';

/**
 * Core autonomous agent loop.
 * PLAN -> PARAMETERIZE -> BUILD -> TEST -> SECURITY -> DEPLOY -> ANNOUNCE -> TREASURY -> SLEEP
 */
export class AgentLoop {
  private hermes: HermesClient;
  private deployer: Deployer;
  private securityGate: SecurityGate;
  private treasury: TreasuryManager;
  private xBot: XBot;
  private telegram: TelegramBot;
  private intervalMs: number;
  private deployedPrograms: Set<string> = new Set();
  private consecutiveFailures: number = 0;
  private safeMode: boolean = false;
  private running: boolean = false;

  constructor() {
    this.hermes = new HermesClient();
    this.deployer = new Deployer();
    this.securityGate = new SecurityGate(this.hermes, this.deployer);
    this.treasury = new TreasuryManager();
    this.xBot = new XBot();
    this.telegram = new TelegramBot();
    this.intervalMs = parseInt(process.env.AGENT_LOOP_INTERVAL_MS || '21600000', 10); // 6 hours default
  }

  /**
   * Start the autonomous loop.
   */
  async start(): Promise<void> {
    console.log('[loop] HermesClaw agent loop starting...');
    console.log(`[loop] Treasury: ${this.treasury.address}`);
    console.log(`[loop] Interval: ${this.intervalMs / 1000 / 60 / 60}h`);
    console.log(`[loop] Programs in queue: ${PROGRAM_QUEUE.length}`);

    this.running = true;

    // Announce startup on Telegram
    await this.telegram.postStartup();

    while (this.running) {
      if (this.safeMode) {
        console.log('[loop] In safe mode. Waiting for human review.');
        await this.xBot.postSafeMode('3 consecutive failures detected');
        break;
      }

      await this.runCycle();

      if (this.running && !this.safeMode) {
        console.log(`[loop] Sleeping for ${this.intervalMs / 1000 / 60} minutes...`);
        await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
      }
    }
  }

  /**
   * Run one cycle of the agent loop.
   */
  async runCycle(): Promise<void> {
    // PLAN: select next program to deploy
    const nextProgram = this.selectNextProgram();
    if (!nextProgram) {
      console.log('[loop] All programs deployed. Running treasury ops only.');
      await this.runTreasuryOps();
      return;
    }

    console.log(`[loop] === Cycle start: ${nextProgram.name} ===`);
    const startTime = Date.now();

    // BUILD
    console.log(`[loop] STAGE: BUILD ${nextProgram.name}`);
    let buildResult = this.deployer.build(nextProgram.name);
    if (!buildResult.success) {
      console.log('[loop] Build failed, retrying with fresh build...');
      buildResult = this.deployer.build(nextProgram.name);
      if (!buildResult.success) {
        this.handleFailure(`Build failed for ${nextProgram.name}`);
        return;
      }
    }

    // TEST
    console.log(`[loop] STAGE: TEST ${nextProgram.name}`);
    let testRetries = 0;
    let testResult = this.deployer.test(nextProgram.name);
    while (!testResult.success && testRetries < MAX_RETRIES) {
      testRetries++;
      console.log(`[loop] Test failed, retry ${testRetries}/${MAX_RETRIES}...`);
      testResult = this.deployer.test(nextProgram.name);
    }
    if (!testResult.success) {
      this.handleFailure(`Tests failed for ${nextProgram.name} after ${MAX_RETRIES} retries`);
      return;
    }

    // SECURITY
    console.log(`[loop] STAGE: SECURITY ${nextProgram.name}`);
    const securityResult = await this.securityGate.review(nextProgram.name);
    if (!securityResult.passed) {
      console.log(`[loop] Security gate blocked ${nextProgram.name}`);
      await this.xBot.postSecurityBlock(nextProgram.name, securityResult.blockedReasons.join('; '));
      await this.telegram.postSecurityBlock(nextProgram.name, securityResult.blockedReasons.join('; '));
      this.handleFailure(`Security gate blocked ${nextProgram.name}`);
      return;
    }

    // DEPLOY
    console.log(`[loop] STAGE: DEPLOY ${nextProgram.name}`);
    let deployResult = this.deployer.deploy(nextProgram.name);
    if (!deployResult.success) {
      // Retry with backoff
      for (const delay of [30_000, 60_000, 120_000]) {
        console.log(`[loop] Deploy failed, retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        deployResult = this.deployer.deploy(nextProgram.name);
        if (deployResult.success) break;
      }
      if (!deployResult.success) {
        this.handleFailure(`Deploy failed for ${nextProgram.name}`);
        return;
      }
    }

    // ANNOUNCE
    console.log(`[loop] STAGE: ANNOUNCE ${nextProgram.name}`);
    const announcement = await this.hermes.generateAnnouncement(
      nextProgram.name,
      deployResult.programId || 'unknown',
      nextProgram.description,
    );
    await this.xBot.announceDeployment(nextProgram.name, deployResult.programId || '', announcement);
    await this.telegram.announceDeployment(nextProgram.name, deployResult.programId || 'unknown', nextProgram.description);

    // Git commit
    this.deployer.gitCommit(`deploy: ${nextProgram.name} to devnet [${deployResult.programId}]`);

    // Mark as deployed
    this.deployedPrograms.add(nextProgram.name);
    this.consecutiveFailures = 0;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[loop] === Cycle complete: ${nextProgram.name} (${elapsed}s) ===`);

    // TREASURY
    await this.runTreasuryOps();
  }

  private selectNextProgram() {
    return PROGRAM_QUEUE.find((p) => !this.deployedPrograms.has(p.name)) || null;
  }

  private async runTreasuryOps(): Promise<void> {
    console.log('[loop] STAGE: TREASURY');
    try {
      const report = await this.treasury.generateReport();
      console.log(`[loop] ${report}`);
    } catch (err: any) {
      console.error(`[loop] Treasury ops error: ${err.message}`);
    }
  }

  private handleFailure(reason: string): void {
    this.consecutiveFailures++;
    console.error(`[loop] Failure (${this.consecutiveFailures}/${SAFE_MODE_THRESHOLD}): ${reason}`);
    if (this.consecutiveFailures >= SAFE_MODE_THRESHOLD) {
      this.safeMode = true;
    }
  }

  stop(): void {
    this.running = false;
    console.log('[loop] Agent loop stopping...');
  }
}
