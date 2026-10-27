import type { Metadata, Viewport } from "next";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/dm-sans";
import "./globals.css";
export const metadata: Metadata = {
  title: "Pagechime · Read & Listen",
  description:
    "Your quiet corner for reading and listening. Follow the book, hear the words, and find your place.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/pagechime.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "Pagechime", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f3ec",
  viewportFit: "cover",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
