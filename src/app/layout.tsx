import type { Metadata } from "next";
import { Exo_2, Noto_Sans_SC } from "next/font/google";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const sans = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"]
});

const serif = Exo_2({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "FOMO Firewall MVP"
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
        {children}
      </body>
    </html>
  );
}
