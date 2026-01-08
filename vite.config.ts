import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/netipflix/' : '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "NETIPFLIX - Streaming de TV e Filmes",
        short_name: "NETIPFLIX",
        description: "Sua plataforma de streaming com TV ao vivo e os melhores filmes",
        theme_color: "#E50914",
        background_color: "#0F0F0F",
        display: "standalone",
        orientation: "any",
        start_url: mode === 'production' ? '/netipflix/' : '/',
        scope: mode === 'production' ? '/netipflix/' : '/',
        icons: [
          {
            src: mode === 'production' ? '/netipflix/pwa-192x192.png' : '/pwa-192x192.png',
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: mode === 'production' ? '/netipflix/pwa-512x512.png' : '/pwa-512x512.png',
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        categories: ["entertainment", "video"],
        screenshots: [
          {
            src: mode === 'production' ? '/netipflix/screenshot-wide.png' : '/screenshot-wide.png',
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide"
          },
          {
            src: "/screenshot-mobile.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
