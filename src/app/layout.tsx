import type { Metadata } from "next";
import { productName } from "@/lib/config";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: `${productName} · Your team’s voice`,
    template: `%s · ${productName}`,
  },
  description:
    "Private employee content, author-approved publishing, and attribution.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
