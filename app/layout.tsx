import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Earth Lens — Investigate a place with your agent",
  description: "A shared spatial evidence workspace powered by WebMCP.",
  openGraph: {
    title: "Earth Lens",
    description: "Investigate a place with your agent.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Earth Lens environmental investigation map" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Earth Lens",
    description: "Investigate a place with your agent.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
