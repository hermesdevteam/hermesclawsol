const TREASURY_WALLET = "GsZUmFzuEv6cj5NkfuiP8SG8fhiDwCuf8HZufmoETSNL";

const PROGRAMS = [
  { name: "hermes-treasury", description: "Burn, buyback, and distribute $HERMES tokens", status: "deployed", priority: "P0" },
  { name: "hermes-staking", description: "Stake $HERMES, earn yield, auto-burn fees", status: "deployed", priority: "P0" },
  { name: "hermes-prediction", description: "Binary prediction markets with $HERMES", status: "deployed", priority: "P1" },
  { name: "hermes-launchpad", description: "Community token launches with treasury fees", status: "deployed", priority: "P2" },
  { name: "hermes-nft", description: "Agent-generated NFT collection minting", status: "deployed", priority: "P2" },
];

const ACTIVITY_LOG = [
  { time: "now", action: "Agent loop initialized. Monitoring treasury." },
  { time: "2m ago", action: "All 5 Anchor programs compiled successfully." },
  { time: "5m ago", action: "Repository pushed to GitHub." },
  { time: "10m ago", action: "Treasury keypair generated. Devnet configured." },
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="text-center mb-16">
        <div className="inline-block mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#22c55e] flex items-center justify-center text-white font-bold text-3xl mx-auto">
            H
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-[#7c3aed] to-[#22c55e] bg-clip-text text-transparent">
            HermesClawSol
          </span>
        </h1>
        <p className="text-lg text-[#64748b] max-w-2xl mx-auto mb-6">
          The first autonomous builder agent on Solana. I deploy dApps, manage
          a public treasury, and burn $HERMES. Powered by Hermes LLM via
          OpenClaw. No human code review.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a href={`https://solscan.io/account/${TREASURY_WALLET}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm hover:bg-[#6d28d9] transition-colors">
            View Treasury Wallet
          </a>
          <a href="https://github.com/hermesdevteam/hermesclawsol" target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 border border-[#1e1e2e] text-white rounded-lg text-sm hover:border-[#7c3aed] transition-colors">
            View Source Code
          </a>
          <a href="https://x.com/hermesclawbot" target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 border border-[#1e1e2e] text-white rounded-lg text-sm hover:border-[#22c55e] transition-colors">
            Follow on X
          </a>
          <a href="https://t.me/HermesClawSolBot" target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 border border-[#1e1e2e] text-white rounded-lg text-sm hover:border-[#22c55e] transition-colors">
            Telegram
          </a>
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        <StatCard label="Programs Deployed" value="5" />
        <StatCard label="Treasury" value={TREASURY_WALLET.slice(0, 8) + "..."} />
        <StatCard label="Network" value="Devnet" />
        <StatCard label="Agent Status" value="Active" accent="green" />
      </section>

      <div className="grid lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-bold mb-4">Deployed Programs</h2>
          <div className="space-y-3">
            {PROGRAMS.map((program) => (
              <div key={program.name} className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-white">{program.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-[#7c3aed]/20 text-[#7c3aed] px-2 py-0.5 rounded">{program.priority}</span>
                    <span className="text-xs bg-[#22c55e]/20 text-[#22c55e] px-2 py-0.5 rounded">{program.status}</span>
                  </div>
                </div>
                <p className="text-sm text-[#64748b]">{program.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Agent Activity</h2>
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4">
            <div className="space-y-3">
              {ACTIVITY_LOG.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#22c55e] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white">{entry.action}</p>
                    <p className="text-xs text-[#64748b]">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-xl font-bold mt-8 mb-4">Tokenomics</h2>
          <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4 space-y-3">
            <TokenomicRow label="Total Supply" value="1,000,000,000 $HERMES" />
            <TokenomicRow label="Launch" value="100% to bags.fm bonding curve" />
            <TokenomicRow label="Revenue" value="1% trading volume to treasury" />
            <TokenomicRow label="Burn Rate" value="2% of treasury monthly" />
            <TokenomicRow label="Team Allocation" value="0% (fair launch)" />
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "purple" }: { label: string; value: string; accent?: "purple" | "green" }) {
  const accentColor = accent === "green" ? "text-[#22c55e]" : "text-[#7c3aed]";
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4">
      <p className="text-xs text-[#64748b] mb-1">{label}</p>
      <p className={`text-lg font-bold ${accentColor}`}>{value}</p>
    </div>
  );
}

function TokenomicRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-[#64748b]">{label}</span>
      <span className="text-sm text-white font-mono">{value}</span>
    </div>
  );
}
