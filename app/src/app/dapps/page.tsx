const DAPPS = [
  {
    name: "hermes-treasury",
    description: "Treasury operations for $HERMES: burn tokens, buyback from bonding curve, distribute to stakers. Enforces daily spending limits and monthly burn schedule.",
    priority: "P0",
    status: "Compiled",
    instructions: ["initialize", "burn_tokens", "distribute", "update_config"],
    features: ["Daily spending cap (5%)", "Monthly auto-burn (2%)", "Overflow-safe math", "Upgradeable via BPF loader"],
  },
  {
    name: "hermes-staking",
    description: "Stake $HERMES to earn yield from treasury distributions. Configurable APR, time-locked staking with minimum amounts.",
    priority: "P0",
    status: "Compiled",
    instructions: ["initialize_pool", "stake", "unstake", "claim_rewards"],
    features: ["Time-lock enforcement", "Configurable 1-50% APR", "Auto-burn on fees", "Per-user PDA accounts"],
  },
  {
    name: "hermes-prediction",
    description: "Binary YES/NO prediction markets. Users bet $HERMES on outcomes. Agent resolves markets. Resolution fees go to treasury.",
    priority: "P1",
    status: "Compiled",
    instructions: ["create_market", "place_bet", "resolve_market", "claim_winnings"],
    features: ["Binary outcomes", "Proportional payouts", "Resolution fee to treasury", "Expiration enforcement"],
  },
  {
    name: "hermes-launchpad",
    description: "Community token launches through the agent. Contributors send SOL. On finalization, fee goes to treasury, remainder to creator.",
    priority: "P2",
    status: "Compiled",
    instructions: ["create_launch", "contribute", "finalize_launch"],
    features: ["SOL-based contributions", "Configurable launch fee", "Duration enforcement", "Creator + treasury split"],
  },
  {
    name: "hermes-nft",
    description: "Agent-generated NFT collection. Users pay SOL to mint. All mint fees go to treasury. Collection can be paused.",
    priority: "P2",
    status: "Compiled",
    instructions: ["initialize_collection", "mint_nft", "toggle_collection", "update_mint_price"],
    features: ["Max supply enforcement", "SOL mint pricing", "Collection pause/resume", "Sequential token IDs"],
  },
];

export default function DAppsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-2">dApps</h1>
      <p className="text-[#64748b] mb-8">
        5 Solana programs built autonomously by HermesClawBot. All compiled and
        ready for devnet deployment.
      </p>

      <div className="space-y-6">
        {DAPPS.map((dapp) => (
          <div
            key={dapp.name}
            className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold font-mono text-white">
                {dapp.name}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-[#7c3aed]/20 text-[#7c3aed] px-2 py-0.5 rounded">
                  {dapp.priority}
                </span>
                <span className="text-xs bg-[#22c55e]/20 text-[#22c55e] px-2 py-0.5 rounded">
                  {dapp.status}
                </span>
              </div>
            </div>

            <p className="text-sm text-[#64748b] mb-4">{dapp.description}</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#64748b] mb-2 uppercase tracking-wider">
                  Instructions
                </p>
                <div className="flex flex-wrap gap-1">
                  {dapp.instructions.map((ix) => (
                    <span
                      key={ix}
                      className="text-xs font-mono bg-[#0a0a0f] text-[#7c3aed] px-2 py-1 rounded"
                    >
                      {ix}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-[#64748b] mb-2 uppercase tracking-wider">
                  Features
                </p>
                <ul className="text-sm text-[#64748b] space-y-1">
                  {dapp.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
