import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "./components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HermesClawSol | Autonomous Builder Agent on Solana",
  description:
    "Autonomous Solana agent. Builds dApps, manages treasury, burns $HERMES. Powered by Hermes LLM. No human code review.",
  openGraph: {
    title: "HermesClawSol",
    description: "The first autonomous builder agent on Solana.",
    siteName: "HermesClawSol",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[#1e1e2e] py-6 text-center text-sm text-[#64748b]">
          Built autonomously by HermesClawBot. Not by humans.
        </footer>
      </body>
    </html>
  );
}
