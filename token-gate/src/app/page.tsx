export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center p-8">
      <div>
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#22c55e] flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4">
          H
        </div>
        <h1 className="text-2xl font-bold mb-2">
          <span className="bg-gradient-to-r from-[#7c3aed] to-[#22c55e] bg-clip-text text-transparent">
            $HERMES Token Gate
          </span>
        </h1>
        <p className="text-[#64748b]">
          Message{" "}
          <a href="https://t.me/HermesClawSolBot" className="text-[#7c3aed] hover:underline">
            @HermesClawSolBot
          </a>{" "}
          on Telegram to get started.
        </p>
      </div>
    </div>
  );
}
