import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Researcher Finder - Find Top Researchers for Your Position",
  description: "Find the perfect researchers for your position. Paste a job description and we'll analyze arXiv papers to match you with top talent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
