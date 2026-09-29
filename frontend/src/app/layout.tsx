import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Zap, Activity, BookOpen, ShieldAlert, Radio, Server } from "lucide-react";

export const metadata: Metadata = {
  title: "VAJRA (वज्र) — Multi-Source Convective Nowcasting System",
  description:
    "Real-time, multi-source convective nowcasting system for India (0–6 h). Smart India Hackathon 2026, Problem Statement 26084, NCMRWF / Ministry of Earth Sciences. Team CodeX_2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen flex flex-col font-sans antialiased">
        {/* Top Operational Header */}
        <header className="sticky top-0 z-50 border-b border-panel-border bg-panel/95 backdrop-blur-md px-4 py-2.5">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-vajra-orange via-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Zap className="w-5 h-5 text-slate-950 fill-current" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-display font-bold text-xl tracking-tight text-white">
                    VAJRA <span className="text-vajra-orange font-normal">(वज्र)</span>
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-vajra-orange/15 text-vajra-orange border border-vajra-orange/30 font-mono font-medium">
                    SIH 2026 PS 26084
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Convective Nowcasting 0–6 h · NCMRWF / Ministry of Earth Sciences · Team CodeX_2026
                </div>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex items-center space-x-1 sm:space-x-2 font-medium text-sm">
              <Link
                href="/console"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-white/5 text-slate-200 hover:text-white transition-colors"
              >
                <Radio className="w-4 h-4 text-vajra-orange" />
                <span>Console</span>
              </Link>
              <Link
                href="/"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
              >
                <Activity className="w-4 h-4 text-blue-400" />
                <span>Overview</span>
              </Link>
              <Link
                href="/method"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Methods</span>
              </Link>
              <Link
                href="/status"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md hover:bg-white/5 text-slate-300 hover:text-white transition-colors"
              >
                <Server className="w-4 h-4 text-purple-400" />
                <span>Status</span>
              </Link>
            </nav>

            {/* Forecaster Guidance Badge */}
            <div className="hidden lg:flex items-center space-x-2 text-xs">
              <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Guidance for IMD forecasters — not a public warning</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Global Footer */}
        <footer className="border-t border-panel-border bg-panel/60 py-2.5 px-4 text-xs text-slate-500 text-center flex flex-col sm:flex-row justify-between items-center max-w-[1920px] mx-auto w-full">
          <div>
            VAJRA Convective Scale Nowcasting System · Developed for NCMRWF / MoES · Smart India Hackathon 2026
          </div>
          <div className="flex items-center space-x-3 mt-1 sm:mt-0 font-mono text-[11px]">
            <span>Grid: 1 km Cartesian</span>
            <span>•</span>
            <span>Clock: 5 min</span>
            <span>•</span>
            <span className="text-vajra-orange">Strict Honesty Enforced</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
