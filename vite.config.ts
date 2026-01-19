import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Para GitHub Pages de projeto (não username.github.io), usar /nome-repo/
  // URL final: https://john89010130.github.io/netipflix/
  const base = '/netipflix/';
  
  return {
    base,
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
          start_url: base,
          scope: base,
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ],
          categories: ["entertainment", "video"],
          screenshots: [
            {
              src: `${base}screenshot-wide.png`,
              sizes: "1280x720",
              type: "image/png",
              form_factor: "wide"
            },
            {
              src: `${base}screenshot-mobile.png`,
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
      }),
      // Plugin para garantir que 404.html existe (usa o do public se disponível)
      {
        name: 'ensure-404-html',
        closeBundle() {
          const distPath = path.resolve(__dirname, 'dist');
          const publicPath = path.resolve(__dirname, 'public');
          const notFoundDist = path.join(distPath, '404.html');
          const notFoundPublic = path.join(publicPath, '404.html');
          
          // Se o 404.html do public foi copiado, manter ele (tem lógica de redirect para HashRouter)
          if (fs.existsSync(notFoundDist)) {
            console.log('✅ 404.html do public/ já existe em dist/');
          } else if (fs.existsSync(notFoundPublic)) {
            // Copiar do public se não foi copiado automaticamente
            fs.copyFileSync(notFoundPublic, notFoundDist);
            console.log('✅ 404.html copiado do public/ para dist/');
          } else {
            // Fallback: copiar index.html se não houver 404.html customizado
            const indexPath = path.join(distPath, 'index.html');
            if (fs.existsSync(indexPath)) {
              fs.copyFileSync(indexPath, notFoundDist);
              console.log('✅ 404.html criado a partir do index.html');
            }
          }
        }
      }
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
