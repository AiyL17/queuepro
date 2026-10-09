import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QueuePro - Pickleball Queue System",
  description: "Manage pickleball court queues, scores, and leaderboards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Inline script runs synchronously during HTML parsing — before any paint —
          so the correct theme is applied with zero flash. The try/catch handles
          environments where localStorage is unavailable (e.g. private browsing).
          Technique from: Next.js docs › Preventing Flash Before Hydration › Themes
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("qp-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}
