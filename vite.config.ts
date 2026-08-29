import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  return {
    base: '/',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false
        },
        includeAssets: [
          'logo.jpeg',
          'logo.png',
          'favicon.png',
          'favicon.ico',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'notification-icon.png',
          'robots.txt',
          'sitemap.xml',
          'assetlinks.json'
        ],
        manifest: {
          name: 'YouFi - Personal & SME Financial Co-Pilot',
          short_name: 'YouFi',
          description: 'Personal Finance and SME Manager with AI Co-Pilot',
          theme_color: '#10b981',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/?source=pwa',
          scope: '/',
          categories: ['finance', 'business', 'productivity'],
          prefer_related_applications: false,
          related_applications: [
            {
              platform: 'play',
              id: 'app.youfi.twa',
              url: 'https://play.google.com/store/apps/details?id=app.youfi.twa'
            }
          ],
          shortcuts: [
            {
              name: 'Dashboard',
              short_name: 'Dashboard',
              description: 'Open YouFi Financial Dashboard',
              url: '/?source=pwa_shortcut',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'Business & Invoices',
              short_name: 'Invoices',
              description: 'Manage Business Invoices',
              url: '/business-invoices?source=pwa_shortcut',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
            }
          ],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // 10 MB
        }
      })
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
