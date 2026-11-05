import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/app/components/site-nav";
import SiteFooter from "@/app/components/site-footer";

export const metadata: Metadata = {
  title: "rector-arena: Damn Vulnerable Agent Wallets",
  description:
    "An exploit battery that hunts agent-wallet policy engines on NEAR and the wallet that survives.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-6xl px-4">
          <SiteNav />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
