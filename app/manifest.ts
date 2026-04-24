import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "วิเคราะห์บิล-Claribill",
    short_name: "วิเคราะห์บิล-Claribill",
    description: "วิเคราะห์ค่าธรรมเนียมอีคอมเมิร์ซจากสลิปของคุณ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f4ed",
    theme_color: "#c96442",
    lang: "th",
    icons: [
      {
        src: "/icon",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
