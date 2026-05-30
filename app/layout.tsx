import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Language Teacher Portal",
  description: "Student progress dashboard for language teachers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
