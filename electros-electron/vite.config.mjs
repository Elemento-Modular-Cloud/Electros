import { defineConfig } from 'vite'
import { resolve } from 'path'
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    // Root is the project root so it can find all subfolders (electros/, terminal/, etc.)
    root: resolve(__dirname),
    base: './', // Crucial for Electron to load relative assets in production
    resolve: {
        preserveSymlinks: true
    },
    build: {
        outDir: 'dist-renderer',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'electros/electros.html'),
                terminal: resolve(__dirname, 'terminal/terminal.html'),
                // Add any other window HTML files here
            }
        }
    },
    plugins: [
      tsconfigPaths({
          projects: [ resolve(__dirname, 'electros/tsconfig.json') ],
      }),
    ],
    server: {
        port: 5173,
        strictPort: true,
        watch: {
            usePolling: true,
            followSymlinks: true
        }
    }
})