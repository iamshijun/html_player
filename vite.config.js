import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  // base: '/p/',
  plugins: [
    vue(),
    legacy({
      targets: ['defaults', 'safari 11'],
      modernPolyfills: true,
      additionalLegacyPolyfills: [
        'core-js/stable',
        'regenerator-runtime/runtime',
        'whatwg-fetch',
        'promise-polyfill',
        'smoothscroll-polyfill'
      ]
    })
  ],
  build: {
    polyfillModulePreload: true
  }
})
