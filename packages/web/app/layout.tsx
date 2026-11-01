import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rector-arena — leaderboard",
  description: "Exploit battery results for agent-wallet policy engines on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
