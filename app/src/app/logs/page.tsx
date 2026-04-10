const MOCK_LOGS = [
  { ts: "2026-04-10T23:30:00Z", level: "info", source: "loop", message: "Agent loop initialized. Monitoring treasury." },
  { ts: "2026-04-10T23:29:55Z", level: "info", source: "deployer", message: "All 5 Anchor programs compiled. hermes_treasury.so (250KB), hermes_staking.so (282KB), hermes_prediction.so (280KB), hermes_launchpad.so (245KB), hermes_nft.so (232KB)" },
  { ts: "2026-04-10T23:29:00Z", level: "info", source: "security-gate", message: "hermes-treasury: PASSED (clippy=true, critical/high=0, medium/low=0)" },
  { ts: "2026-04-10T23:28:00Z", level: "info", source: "security-gate", message: "hermes-staking: PASSED (clippy=true, critical/high=0, medium/low=0)" },
  { ts: "2026-04-10T23:27:00Z", level: "info", source: "treasury", message: "Treasury: GsZUmFzu...ETSNL configured on devnet" },
  { ts: "2026-04-10T23:26:00Z", level: "info", source: "hermes", message: "OpenClaw connection established. Hermes LLM ready." },
  { ts: "2026-04-10T23:25:00Z", level: "info", source: "x-bot", message: "[DRY RUN] X bot initialized. No API keys configured." },
  { ts: "2026-04-10T23:24:00Z", level: "info", source: "main", message: "HermesClawSol agent starting. Treasury: GsZUmFzuEv6cj5NkfuiP8SG8fhiDwCuf8HZufmoETSNL" },
];

const LEVEL_COLORS: Record<string, string> = {
  info: "text-[#22c55e]",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const SOURCE_COLORS: Record<string, string> = {
  loop: "text-[#7c3aed]",
  deployer: "text-blue-400",
  "security-gate": "text-yellow-400",
  treasury: "text-[#22c55e]",
  hermes: "text-cyan-400",
  "x-bot": "text-pink-400",
  main: "text-white",
};

export default function LogsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold mb-2">Agent Logs</h1>
      <p className="text-[#64748b] mb-8">
        Real-time feed of what HermesClawBot is thinking and doing.
        Full transparency.
      </p>

      <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg overflow-hidden">
        <div className="border-b border-[#1e1e2e] px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs text-[#64748b] font-mono">live</span>
        </div>

        <div className="p-4 font-mono text-xs space-y-1 max-h-[600px] overflow-y-auto">
          {MOCK_LOGS.map((log, i) => (
            <div key={i} className="flex gap-2 leading-5">
              <span className="text-[#64748b] shrink-0">
                {new Date(log.ts).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 uppercase w-12 ${LEVEL_COLORS[log.level] || "text-white"}`}>
                [{log.level}]
              </span>
              <span className={`shrink-0 w-28 ${SOURCE_COLORS[log.source] || "text-white"}`}>
                {log.source}
              </span>
              <span className="text-[#e2e8f0]">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-[#111118] border border-[#1e1e2e] rounded-lg p-4">
        <h2 className="text-sm font-bold mb-2">Agent Loop Stages</h2>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          {["PLAN", "PARAMETERIZE", "BUILD", "TEST", "SECURITY", "DEPLOY", "ANNOUNCE", "TREASURY", "SLEEP"].map((stage) => (
            <span key={stage} className="bg-[#0a0a0f] text-[#64748b] px-2 py-1 rounded border border-[#1e1e2e]">
              {stage}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
