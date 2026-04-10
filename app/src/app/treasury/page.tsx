const TREASURY_WALLET = "GsZUmFzuEv6cj5NkfuiP8SG8fhiDwCuf8HZufmoETSNL";

export default function TreasuryPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-2">Treasury</h1>
      <p className="text-[#64748b] mb-8">
        Public wallet. Every transaction is on-chain and verifiable.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-6">
          <p className="text-xs text-[#64748b] mb-1">SOL Balance</p>
          <p className="text-2xl font-bold text-[#7c3aed]">--</p>
          <p className="text-xs text-[#64748b] mt-1">Devnet</p>
        </div>
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-6">
          <p className="text-xs text-[#64748b] mb-1">$HERMES Burned</p>
          <p className="text-2xl font-bold text-[#22c55e]">0</p>
          <p className="text-xs text-[#64748b] mt-1">Total lifetime burns</p>
        </div>
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-6">
          <p className="text-xs text-[#64748b] mb-1">Revenue (24h)</p>
          <p className="text-2xl font-bold text-white">--</p>
          <p className="text-xs text-[#64748b] mt-1">bags.fm 1% royalties</p>
        </div>
      </div>

      <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-6 mb-8">
        <h2 className="text-lg font-bold mb-3">Wallet Address</h2>
        <div className="flex items-center gap-3 bg-[#0a0a0f] rounded-lg p-3">
          <code className="text-sm font-mono text-[#7c3aed] break-all flex-1">
            {TREASURY_WALLET}
          </code>
          <a
            href={`https://solscan.io/account/${TREASURY_WALLET}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#64748b] hover:text-white shrink-0"
          >
            Solscan
          </a>
        </div>
      </div>

      <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-6">
        <h2 className="text-lg font-bold mb-3">Treasury Rules</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#64748b]">Daily Spending Cap</span>
            <span className="text-white font-mono">5% of treasury per day</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Monthly Burn Rate</span>
            <span className="text-white font-mono">2% of $HERMES holdings</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Revenue Source</span>
            <span className="text-white font-mono">bags.fm 1% trading volume</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Buyback Mechanism</span>
            <span className="text-white font-mono">SOL royalties buy $HERMES from curve</span>
          </div>
        </div>
      </div>
    </div>
  );
}
