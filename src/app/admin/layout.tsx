import type { Metadata } from "next";
import { Barlow_Condensed, Rubik } from "next/font/google";
import "../globals.css";

// Eigen root-layout voor het beheer: geen Google Tag Manager, geen cookiebanner, nooit indexeren.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display-src", display: "swap" });
const body = Rubik({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body-src", display: "swap" });

export const metadata: Metadata = { title: { default: "Beheer", template: "%s · Beheer BluePure Marine" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${display.variable} ${body.variable}`}>
      <body className="bg-paper font-sans text-[0.95rem] leading-normal text-ink">{children}</body>
    </html>
  );
}
