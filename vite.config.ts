import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd());

  return {
      plugins: [vue()],
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src')
        }
      },
      define: {//polyfill
          global: 'window', // 将 global 定义为 window
      },
      base: env.VITE_APP_PUBLIC_PATH || '/',
    }
  }
)