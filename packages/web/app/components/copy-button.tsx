"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

const RESET_DELAY_MS = 2000;

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), RESET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void copy()}
      aria-label={label}
      className="disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {state === "copied" ? "copied" : state === "failed" ? "copy failed" : label}
    </Button>
  );
}

export default CopyButton;
