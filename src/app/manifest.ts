import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QueuePro - Pickleball Queue System",
    short_name: "QueuePro",
    description: "Manage pickleball court queues, scores, and leaderboards",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon.jpg",
        sizes: "any",
        type: "image/png",
      },
      {
        src: "/icon.jpg",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.jpg",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
