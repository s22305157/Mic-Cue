import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mic Cue',
        short_name: 'Mic Cue',
        description: 'Accessible speech cue cards for performance and communication.',
        start_url: './',
        display: 'standalone',
        background_color: '#0b0b0e',
        theme_color: '#5b36d6',
        orientation: 'any',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}']
      }
    })
  ]
})
