import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HiveLab | University URL Shortener & Analytics",
  description:
    "Fast, secure, and modern URL shortener tailored for HiveLab student organization. Generate custom aliases, track click analytics, and create instant QR codes.",
  keywords: ["URL Shortener", "HiveLab", "HSC", "University Student Organization", "Link Analytics", "QR Code"],
  authors: [{ name: "HiveLab Tech Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="bg-ivory-100 text-slate-deep min-h-screen flex flex-col antialiased selection:bg-emerald-soft selection:text-slate-deep">
        {children}
      </body>
    </html>
  );
}
