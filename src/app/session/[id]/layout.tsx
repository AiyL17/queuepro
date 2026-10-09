"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // We need to await params in Next.js 15, but since this is 14 (or we just use the prop), we'll do:
  // Since `useParams` could be used, let's stick to the prop for now.
  // Actually, we can use `params.id`. Wait, in client components `params` is a promise in Next 15.
  // Next 16 is turbopack, Next 15 handles params differently. I'll just use `usePathname` to get the id.
  
  const id = pathname.split("/")[2];

  // Haptic feedback function
  const vibrate = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([30]);
    }
  };

  const navItems = [
    { name: "Dashboard", href: `/session/${id}`, icon: LayoutDashboard },
    { name: "Leaderboard", href: `/session/${id}/leaderboard`, icon: Trophy },
    { name: "Check In", href: `/session/${id}/checkin`, icon: Users },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 pb-[72px] lg:pb-0">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pt-2 border-t"
        style={{
          background: "var(--bg-page)",
          borderColor: "var(--border-subtle)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex justify-around items-center max-w-md mx-auto mb-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={vibrate}
                className="flex flex-col items-center justify-center w-16 gap-1"
                style={{ color: isActive ? "var(--text-heading)" : "var(--text-faint)" }}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{ 
                    background: isActive ? "rgba(124,58,237,0.15)" : "transparent",
                    color: isActive ? "#a78bfa" : "inherit"
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-semibold tracking-wide">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
