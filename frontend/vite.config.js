import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from project root (for Docker/Production) and frontend folder (standard Vite)
  // Vite looks in process.cwd() which is /app in the container.
  const env = loadEnv(mode, process.cwd(), '')
  
  const allowedHosts = []
  
  // Extract hostname from PUBLIC_SERVER_URL if it exists
  if (env.PUBLIC_SERVER_URL) {
    try {
      const url = new URL(env.PUBLIC_SERVER_URL)
      allowedHosts.push(url.hostname)
    } catch (e) {
      console.warn("Invalid PUBLIC_SERVER_URL in .env:", env.PUBLIC_SERVER_URL)
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    },
    build: {
      chunkSizeWarningLimit: 800, // Increase limit slightly
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) return 'icons';
              return 'vendor'; 
            }
          }
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.js',
    },
  }
})
