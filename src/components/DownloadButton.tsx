"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SKILL_LEVELS, PlayerSessionScore, PairScore } from "@/lib/types";

export function DownloadButton({ scores, pairs, sessionId }: { scores: PlayerSessionScore[], pairs: PairScore[], sessionId: string }) {
  const handleDownload = useCallback(() => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("QueuePro Leaderboard", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Session ID: ${sessionId}`, 14, 22);

    const individualHeaders = [["Rank", "Skill Level", "Player Name", "Games Played", "Total Score"]];
    const individualRows = scores.map((s, idx) => [
      (idx + 1).toString(),
      SKILL_LEVELS.find(sl => sl.value === s.player?.skill_level)?.label || s.player?.skill_level || "Unknown",
      s.player?.name || "Unknown",
      s.games_played.toString(),
      s.total_score.toString()
    ]);

    const pairsHeaders = [["Rank", "Skill Level", "Player 1", "Player 2", "Games Played", "Total Score"]];
    const pairRows = pairs.map((p, idx) => [
      (idx + 1).toString(),
      SKILL_LEVELS.find(sl => sl.value === p.player1?.skill_level)?.label || p.player1?.skill_level || "Unknown",
      p.player1?.name || "Unknown",
      p.player2?.name || "Unknown",
      p.games_played.toString(),
      p.total_score.toString()
    ]);

    let finalY = 25;

    if (individualRows.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Individual Rankings", 14, finalY + 5);
      autoTable(doc, {
        startY: finalY + 8,
        head: individualHeaders,
        body: individualRows,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [124, 58, 237] },
      });
      finalY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (pairRows.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Best Pairs", 14, finalY + 5);
      autoTable(doc, {
        startY: finalY + 8,
        head: pairsHeaders,
        body: pairRows,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [124, 58, 237] },
      });
    }

    doc.save(`leaderboard-${sessionId}.pdf`);
  }, [scores, pairs, sessionId]);

  return (
    <button
      onClick={handleDownload}
      aria-label="Export Leaderboard PDF"
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80 active:scale-95 flex-shrink-0 cursor-pointer shadow-sm"
      style={{
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
      title="Download PDF Summary"
    >
      <Download size={15} />
    </button>
  );
}
