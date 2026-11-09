"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/demo", label: "Demo" },
  { href: "/battery", label: "Run" },
  { href: "/simulate", label: "Simulate" },
  { href: "/attacks", label: "Attacks" },
  { href: "/impact", label: "Impact" },
  { href: "/verify", label: "Verify" },
  { href: "/building", label: "Build" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/leaderboard", label: "Leaderboard" },
];

function linkClass(href: string, pathname: string) {
  return href === pathname
    ? "text-foreground font-medium"
    : "text-muted-foreground hover:text-foreground";
}

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="py-3 flex items-center gap-4" aria-label="Site">
      <Link href="/" className="font-display text-lg text-foreground hover:text-primary">
        rector-arena
      </Link>

      <div className="hidden xl:flex items-center gap-4 ml-auto text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href, pathname)}>
            {l.label}
          </Link>
        ))}
        <a
          href="https://github.com/RECTOR-LABS/rector-arena"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          GitHub
        </a>
        <Button render={<Link href="/battery" />} nativeButton={false}>Run the battery</Button>
      </div>

      <div className="xl:hidden ml-auto">
        <MobileMenu pathname={pathname} />
      </div>
    </nav>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  // Client-side navigations re-render but do not unmount this component, so
  // the expanded panel would otherwise cover the page the user navigated to.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col items-end">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Menu className="h-4 w-4" aria-hidden="true" />
        Menu
      </Button>
      {open && (
        <div className="mt-3 flex flex-col items-start gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href, pathname)}>
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/RECTOR-LABS/rector-arena"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
          <Button render={<Link href="/battery" />} nativeButton={false}>Run the battery</Button>
        </div>
      )}
    </div>
  );
}
