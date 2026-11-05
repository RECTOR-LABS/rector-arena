import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const columns = [
  {
    title: "Project",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Attacks", href: "/attacks" },
      { label: "Impact", href: "/impact" },
      { label: "Simulate", href: "/simulate" },
    ],
  },
  {
    title: "Evidence",
    links: [
      { label: "Verify", href: "/verify" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "GitHub", href: "https://github.com/RECTOR-LABS/rector-arena" },
    ],
  },
  {
    title: "Docs",
    links: [
      { label: "PRD.md", href: "https://github.com/RECTOR-LABS/rector-arena/blob/main/PRD.md" },
      {
        label: "ATTACK-BATTERY.md",
        href: "https://github.com/RECTOR-LABS/rector-arena/blob/main/docs/ATTACK-BATTERY.md",
      },
      {
        label: "ARCHITECTURE.md",
        href: "https://github.com/RECTOR-LABS/rector-arena/blob/main/docs/ARCHITECTURE.md",
      },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-border py-8 text-sm">
      <div className="flex flex-col gap-2">
        <span className="font-display text-lg text-foreground">rector-arena</span>
        <p className="text-muted-foreground">
          An open arena that hunts agent-wallet policy engines on NEAR and ships the wallet that
          survives.
        </p>
      </div>

      <Separator className="my-6" />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <span className="text-muted-foreground">{col.title}</span>
            {col.links.map((l) =>
              l.href.startsWith("http") ? (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </Link>
              ),
            )}
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      <p className="text-muted-foreground text-xs">
        MIT. Hardening reference, not a consumer product (PRD.md §1). Type: IBM Plex Mono + Pixelify
        Sans (OFL).
      </p>
    </footer>
  );
}
