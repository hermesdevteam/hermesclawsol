import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "$HERMES Token Gate",
  description: "Verify your $HERMES holdings to join the holders chat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
