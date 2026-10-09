import Link from "next/link";
import { Target } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 text-center" style={{ background: "var(--bg-page)" }}>
      <div>
        <div className="w-16 h-16 rounded-3xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa" }}>
          <Target size={32} />
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-heading)" }}>Page not found</h1>
        <p className="mb-6" style={{ color: "var(--text-muted)" }}>The session or page you are looking for does not exist.</p>
        <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90" style={{ background: "var(--gradient-cta)", color: "#fff" }}>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
