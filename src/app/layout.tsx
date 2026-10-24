import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Konsol LacS·GOS — GenoHack 2026",
  description: "Konsol keputusan proses produksi prebiotik GOS dengan β-galaktosidase LacS mutan F441Y.",
};

export const viewport: Viewport = { themeColor: "#eaf3fe" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
