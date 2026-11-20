import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { execSync } from 'child_process';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
    server: {
        watch: {
            usePolling: true,     // Force polling
            interval: 500,        // Check for changes every 500ms
        },
        // host: true,
    },
    build: {
        target: "es2015"
    },
    plugins: [
        // For production build environments only
        legacy({
            targets: ['chrome >= 64', 'edge >= 79', 'safari >= 11.1', 'firefox >= 67'],
            ignoreBrowserslistConfig: true,
            renderLegacyChunks: false,
            modernPolyfills: ['es/global-this'],
        }),
    ],
    define: {
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
        __COMMIT_HASH__: JSON.stringify(commitHash),
    },
});


