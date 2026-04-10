# HermesClawSol

## Project Overview
Autonomous builder agent token on Solana. Replicates the Clawdbotatg.eth model (Base) on Solana, powered by NousResearch Hermes LLM via OpenClaw. $HERMES token launches on bags.fm.

## Architecture
- **programs/** — Anchor/Rust Solana programs (5 programs, human-written 80% templates)
- **agent/** — TypeScript agent core (OpenClaw + Hermes LLM, autonomous deploy loop)
- **app/** — Next.js dashboard (out of scope for Phase 1)
- **tests/** — Anchor integration tests
- **templates/** — Parameterizable program configs (JSON)

## Key Decisions
- Template + Parameterize approach: 80% human-written, 20% LLM-parameterized
- bags.fm for $HERMES token launch (1% trading volume royalties)
- Security gate: anchor test + cargo clippy + LLM adversarial review before every deploy
- Devnet first, mainnet after professional security audit
- Program priority: P0 (treasury + staking), P1 (prediction), P2 (launchpad + NFT)

## Commands
- `anchor build` — compile all programs
- `anchor test` — run tests on localnet
- `anchor deploy --provider.cluster devnet` — deploy to devnet
- `cd agent && npm start` — start agent loop

## Design Doc
Full design doc at `~/.gstack/projects/hermesclawsol/eesheng_eth-unknown-design-20260410-215120.md`
