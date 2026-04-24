import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "วิเคราะห์บิล-Claribill",
  description: "วิเคราะห์ค่าธรรมเนียมอีคอมเมิร์ซจากสลิปของคุณ",
  applicationName: "วิเคราะห์บิล-Claribill",
  appleWebApp: {
    capable: true,
    title: "วิเคราะห์บิล-Claribill",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#c96442",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
