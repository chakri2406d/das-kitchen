import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NavProgress } from "@/components/layout/nav-progress";
import { RegisterSW } from "@/components/pwa/register-sw";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Das Kitchen — Homemade Happiness Delivered Fresh",
  description:
    "Freshly prepared homemade meals from Das Kitchen. Order breakfast, lunch, dinner and combos, delivered warm to your door.",
  manifest: "/manifest.json",
  applicationName: "Das Kitchen",
  appleWebApp: {
    capable: true,
    title: "Das Kitchen",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/logo.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#b08d00",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
