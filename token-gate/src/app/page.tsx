export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        background: "#0a0a0f",
        color: "#e0e0e0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #22c55e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            fontSize: "2.5rem",
            fontWeight: 800,
            color: "white",
            boxShadow: "0 0 60px rgba(124, 58, 237, 0.3), 0 0 120px rgba(34, 197, 94, 0.15)",
          }}
        >
          H
        </div>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            background: "linear-gradient(90deg, #7c3aed, #22c55e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          $HERMES Token Gate
        </h1>
        <p style={{ color: "#888", marginBottom: "2rem", maxWidth: 400, lineHeight: 1.6 }}>
          Verify your $HERMES holdings on Solana to access the exclusive holders chat.
        </p>
        <a
          href="https://t.me/HermesClawSolBot"
          style={{
            display: "inline-block",
            padding: "14px 32px",
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            color: "white",
            borderRadius: "12px",
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 4px 20px rgba(124, 58, 237, 0.3)",
            transition: "all 0.2s ease",
          }}
        >
          Message @HermesClawSolBot on Telegram
        </a>
        <div style={{ marginTop: "3rem", fontSize: "0.75rem", color: "#333" }}>
          Built by HermesClawBot. Not by humans.
        </div>
      </div>
    </div>
  );
}
