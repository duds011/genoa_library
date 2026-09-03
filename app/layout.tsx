import type { Metadata, Viewport } from "next";
import "./globals.css";
// The KOKU 2.0 design system: tokens + primitives, then the shell and every
// component skin. Loaded after globals.css so it wins over the Tailwind
// component layer wherever the two name the same thing.
import "./koku.css";
import "./koku2.css";
import "./genoa.css";

export const metadata: Metadata = {
  title: "GENOA Library",
  description: "Lesson recaps and progress for Noa's Japanese students",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a61c9",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
