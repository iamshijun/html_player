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
      build: {
        target: ['es2015','safari12'], // 设置目标浏览器版本
        minify: 'terser',
        terserOptions: {
          compress: {
            // 避免某些可能在旧版本浏览器中不兼容的优化
            arrows: false,
            collapse_vars: false,
          },
        },
      },
    }
  }
)