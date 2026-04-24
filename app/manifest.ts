import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const basePath = process.env.NODE_ENV === "production" ? "/claribill" : "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "วิเคราะห์บิล-Claribill",
    short_name: "วิเคราะห์บิล-Claribill",
    description: "วิเคราะห์ค่าธรรมเนียมอีคอมเมิร์ซจากสลิปของคุณ",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f4ed",
    theme_color: "#c96442",
    lang: "th",
    icons: [
      {
        src: `${basePath}/icon.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icon.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${basePath}/apple-icon.png`,
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
