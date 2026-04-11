# HermesClaw Architecture

## Overview

HermesClaw is an autonomous builder agent on Solana that deploys dApps, manages a public treasury, and announces everything via X. Powered by NousResearch Hermes LLM via OpenClaw.

## Components

### Solana Programs (Anchor/Rust)
- **hermes-treasury** — Burns, buybacks, distributions for bags.fm-created $HERMES
- **hermes-staking** — Stake $HERMES, earn yield, auto-burn fees
- **hermes-prediction** — Binary yes/no prediction markets
- **hermes-launchpad** — Community token launches with fee to treasury
- **hermes-nft** — Agent-generated NFT collection

### Agent (TypeScript)
- **loop.ts** — Core autonomous cycle: PLAN -> BUILD -> TEST -> SECURITY -> DEPLOY -> ANNOUNCE
- **hermes.ts** — OpenClaw/Hermes LLM client for parameterization and security review
- **deployer.ts** — Anchor build/test/deploy automation
- **security-gate.ts** — Multi-layer security: clippy + LLM adversarial review
- **treasury.ts** — On-chain treasury monitoring
- **x-bot.ts** — X/Twitter persona bot
- **bags-launch.ts** — bags.fm SDK integration for $HERMES launch

### Template System
Programs are 80% human-written (security-critical code) with 20% parameterized by Hermes LLM. Config JSONs in `templates/` define parameterizable fields with valid ranges.

## Security Model

1. `anchor test` must pass (happy path + boundary + unauthorized access + PDA collisions)
2. `cargo clippy` clean
3. LLM adversarial review (best-effort, zero critical/high to pass)
4. All programs use upgradeable BPF loader
5. Mainnet graduation requires professional security audit
