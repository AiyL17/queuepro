import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: "QueuePro - Pickleball Queue System",
  description: "Manage pickleball court queues, scores, and leaderboards",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("qp-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen" style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
