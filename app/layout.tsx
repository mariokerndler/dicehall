import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dicehall",
  description: "Real-time dice rolls for online campaigns"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
