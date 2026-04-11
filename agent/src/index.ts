import 'dotenv/config';
import { AgentLoop } from './loop';

async function main() {
  console.log('='.repeat(60));
  console.log('  HermesClaw - Autonomous Builder Agent on Solana');
  console.log('  Powered by NousResearch Hermes LLM via OpenClaw');
  console.log('='.repeat(60));
  console.log();

  const loop = new AgentLoop();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[main] Received SIGINT, shutting down...');
    loop.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[main] Received SIGTERM, shutting down...');
    loop.stop();
    process.exit(0);
  });

  await loop.start();
}

main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
