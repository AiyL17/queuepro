import {
  Home, ClipboardList, Users, Play, Zap, Trophy, UserCheck,
  QrCode, History, Power, Swords, Shuffle, Plus, Download,
  Star, Hash, ArrowRight, Info, Target, Medal, Flame,
  TrendingUp, Filter, Eye, LayoutDashboard,
} from "lucide-react";
import type { HelpPageKey } from "@/hooks/useHelp";
import type { ElementType } from "react";

export interface HelpStep {
  icon: ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  tip?: string;
  targetSelector?: string;
  preferredPlacement?: "top" | "bottom" | "left" | "right";
}

export const HELP_CONTENT: Record<HelpPageKey, HelpStep[]> = {

  /* ─────────────────────── HOME ─────────────────────── */
  home: [
    {
      icon: Home,
      iconColor: "#a78bfa",
      iconBg: "rgba(124,58,237,0.15)",
      title: "Welcome to QueuePro",
      body: "Real-time pickleball queuing, court rotations, and live leaderboards.",
      tip: "Works instantly on phones and computers with zero downloads.",
    },
    {
      icon: ClipboardList,
      iconColor: "#8b5cf6",
      iconBg: "rgba(139,92,246,0.15)",
      title: "Start a Session",
      body: "Create a session as organizer to configure courts and add players.",
      targetSelector: 'a[href="/session/new"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Hash,
      iconColor: "#06b6d4",
      iconBg: "rgba(6,182,212,0.15)",
      title: "Join with Code",
      body: "Have a code from your coordinator? Tap here to join the queue.",
      targetSelector: 'a[href="/session/join"]',
      preferredPlacement: "bottom",
    },
    {
      icon: QrCode,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Scan to Check In",
      body: "Players scan the on-court QR code with their phone camera to join directly.",
      targetSelector: '[data-tour="home-qr"]',
      preferredPlacement: "right",
    },
  ],

  /* ─────────────────────── NEW SESSION STEP 1 ─────────────────────── */
  "new-session-step1": [
    {
      icon: Play,
      iconColor: "#8b5cf6",
      iconBg: "rgba(139,92,246,0.15)",
      title: "Game Format",
      body: "Choose Doubles (4 players/court) or Singles (2 players/court).",
      targetSelector: '[data-tour="game-mode"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Target,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Courts & Skills",
      body: "Assign each court a target skill level. Players match by their rating.",
      targetSelector: '[data-tour="courts-list"]',
      preferredPlacement: "left",
    },
    {
      icon: Plus,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Add Courts",
      body: "Tap to add as many courts as your venue has available.",
      targetSelector: '[data-tour="add-court-btn"]',
      preferredPlacement: "top",
    },
    {
      icon: ArrowRight,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Add Players Next",
      body: "Proceed to register initial players for your session.",
      targetSelector: '[data-tour="step1-next-btn"]',
      preferredPlacement: "top",
    },
  ],

  /* ─────────────────────── NEW SESSION STEP 2 ─────────────────────── */
  "new-session-step2": [
    {
      icon: UserCheck,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Register Players",
      body: "Enter names and skill ratings. Press Enter to add quickly.",
      tip: "Players can also self-check-in later via QR code.",
      targetSelector: '[data-tour="add-player-card"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Users,
      iconColor: "#06b6d4",
      iconBg: "rgba(6,182,212,0.15)",
      title: "Active Roster",
      body: "Review added players. Courts auto-fill, and remainder join the waitlist.",
      targetSelector: '[data-tour="roster-list"]',
      preferredPlacement: "left",
    },
    {
      icon: Zap,
      iconColor: "#fbbf24",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Launch Session",
      body: "Starts the session and opens the live management dashboard.",
      targetSelector: '[data-tour="launch-session-btn"]',
      preferredPlacement: "top",
    },
  ],

  /* ─────────────────────── DASHBOARD — ORGANIZER ─────────────────────── */
  "dashboard-organizer": [
    {
      icon: LayoutDashboard,
      iconColor: "#a78bfa",
      iconBg: "rgba(124,58,237,0.15)",
      title: "Organizer Dashboard",
      body: "Live control center for court matches, queue rotations, and rankings.",
    },
    {
      icon: Swords,
      iconColor: "#ef4444",
      iconBg: "rgba(239,68,68,0.15)",
      title: "Court Cards & Scores",
      body: "Tap any active court to enter match scores. Players rotate automatically.",
      targetSelector: '[data-tour="courts-container"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Plus,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Add Court",
      body: "Open another court anytime; it auto-fills immediately if players are waiting.",
      targetSelector: '[data-tour="add-court-action"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Users,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Waiting Queue",
      body: "Shows waiting players in line. They take open courts automatically.",
      targetSelector: '[data-tour="queue-container"]',
      preferredPlacement: "left",
    },
    {
      icon: UserCheck,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Manual Check-In",
      body: "Directly add walk-in players to the queue without phone scanning.",
      targetSelector: '[data-tour="checkin-action"]',
      preferredPlacement: "bottom",
    },
    {
      icon: QrCode,
      iconColor: "#06b6d4",
      iconBg: "rgba(6,182,212,0.15)",
      title: "Check-In QR Code",
      body: "Display the session QR on a screen for player self-registration.",
      targetSelector: '[data-tour="qr-header-btn"]',
      preferredPlacement: "bottom",
    },
    {
      icon: History,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Match History",
      body: "Review finished games, scores, and export session records to CSV.",
      targetSelector: '[data-tour="history-header-btn"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Trophy,
      iconColor: "#a78bfa",
      iconBg: "rgba(124,58,237,0.15)",
      title: "Live Leaderboard",
      body: "View real-time individual and pair rankings.",
      targetSelector: '[data-tour="leaderboard-header-btn"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Power,
      iconColor: "#ef4444",
      iconBg: "rgba(239,68,68,0.15)",
      title: "End Session",
      body: "Closes the session and displays the final leaderboard copy.",
      targetSelector: '[data-tour="end-session-action"]',
      preferredPlacement: "top",
    },
  ],

  /* ─────────────────────── DASHBOARD — PLAYER ─────────────────────── */
  "dashboard-player": [
    {
      icon: Eye,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Session Dashboard",
      body: "Watch court games and queue movement in real time.",
    },
    {
      icon: Users,
      iconColor: "#06b6d4",
      iconBg: "rgba(6,182,212,0.15)",
      title: "Your Queue Position",
      body: "Find your name in line. You advance as courts finish.",
      targetSelector: '[data-tour="queue-container"]',
      preferredPlacement: "left",
    },
    {
      icon: Swords,
      iconColor: "#ef4444",
      iconBg: "rgba(239,68,68,0.15)",
      title: "Court Assignments",
      body: "When your name appears on a court card, head over to play!",
      targetSelector: '[data-tour="courts-container"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Trophy,
      iconColor: "#a78bfa",
      iconBg: "rgba(124,58,237,0.15)",
      title: "Leaderboard",
      body: "Check live scores, win streaks 🔥, and best partner pairings.",
      targetSelector: '[data-tour="leaderboard-header-btn"]',
      preferredPlacement: "bottom",
    },
  ],

  /* ─────────────────────── CHECK-IN ─────────────────────── */
  checkin: [
    {
      icon: UserCheck,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Your Name",
      body: "Type your name or nickname to appear on courts and rankings.",
      targetSelector: '[data-tour="checkin-name-input"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Star,
      iconColor: "#f59e0b",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Select Skill Level",
      body: "Choose your level for balanced matchmaking with similar players.",
      targetSelector: '[data-tour="checkin-skill-picker"]',
      preferredPlacement: "left",
    },
    {
      icon: ArrowRight,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Join Queue",
      body: "Tap to enter the queue and go straight to the live court view.",
      targetSelector: '[data-tour="checkin-submit-btn"]',
      preferredPlacement: "top",
    },
  ],

  /* ─────────────────────── LEADERBOARD ─────────────────────── */
  leaderboard: [
    {
      icon: Trophy,
      iconColor: "#fbbf24",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Live Rankings",
      body: "Scores and win streaks update live as matches finish.",
    },
    {
      icon: Filter,
      iconColor: "#06b6d4",
      iconBg: "rgba(6,182,212,0.15)",
      title: "Filter by Skill",
      body: "Filter leaderboard by skill tier or view all together.",
      targetSelector: '[data-tour="leaderboard-filters"]',
      preferredPlacement: "bottom",
    },
    {
      icon: Download,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Download CSV",
      body: "Export all player scores and pair stats into a spreadsheet.",
      targetSelector: '[data-tour="leaderboard-download-btn"]',
      preferredPlacement: "bottom",
    },
  ],

  /* ─────────────────────── JOIN ─────────────────────── */
  join: [
    {
      icon: Hash,
      iconColor: "#a78bfa",
      iconBg: "rgba(124,58,237,0.15)",
      title: "Session ID",
      body: "Enter the session code from your coordinator.",
      targetSelector: '[data-tour="join-code-input"]',
      preferredPlacement: "bottom",
    },
    {
      icon: ArrowRight,
      iconColor: "#22c55e",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Join Now",
      body: "Tap to proceed to player check-in.",
      targetSelector: '[data-tour="join-submit-btn"]',
      preferredPlacement: "top",
    },
  ],
};
