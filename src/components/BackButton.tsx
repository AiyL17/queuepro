"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface Props {
  href?: string;     // when set, navigates directly instead of using router.back()
  fallback?: string; // explicit route to go to if needed
  label?: string;
}

export function BackButton({ href, fallback, label = "Back" }: Props) {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
      return;
    }
    if (window.history.length > 1) {
      router.back();
    } else if (fallback) {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all hover:opacity-80 flex-shrink-0"
      style={{
        background: "var(--bg-card)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      <ArrowLeft size={15} />
      {label}
    </button>
  );
}
