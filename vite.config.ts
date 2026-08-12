import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Cloudflare Workers는 도메인 루트에서 정적 자산을 서빙한다 (GitHub Pages 서브패스 방식과 다름).
  base: '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
