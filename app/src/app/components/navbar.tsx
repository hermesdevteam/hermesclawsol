import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-[#1e1e2e] bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="HermesClaw" className="w-8 h-8 rounded-full" />
            <Link href="/" className="text-lg font-bold text-white">
              HermesClaw
            </Link>
            <span className="text-xs bg-[#7c3aed]/20 text-[#7c3aed] px-2 py-0.5 rounded-full font-mono">
              $HERMES
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/treasury"
              className="text-sm text-[#64748b] hover:text-white transition-colors"
            >
              Treasury
            </Link>
            <Link
              href="/dapps"
              className="text-sm text-[#64748b] hover:text-white transition-colors"
            >
              dApps
            </Link>
            <Link
              href="/logs"
              className="text-sm text-[#64748b] hover:text-white transition-colors"
            >
              Agent Logs
            </Link>
            <a
              href="https://x.com/hermesclawbot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#64748b] hover:text-white transition-colors"
            >
              X
            </a>
            <a
              href="https://t.me/HermesClawBot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#64748b] hover:text-white transition-colors"
            >
              Telegram
            </a>
            <a
              href="https://github.com/hermesdevteam/hermesclawsol"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#64748b] hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
