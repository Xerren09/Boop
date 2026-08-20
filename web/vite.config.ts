import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig((env) => {
    const config: UserConfig = {
        plugins: [react()],
        build: {
            outDir: "../bin/web",
            emptyOutDir: true
        },
        base: env.command === "build" ? "/boop/" : "./"
    };
    return config;
})
