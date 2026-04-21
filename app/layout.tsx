import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claribill — E-commerce Fee Analyzer",
  description: "วิเคราะห์ค่าธรรมเนียมอีคอมเมิร์ซจากสลิปของคุณ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
