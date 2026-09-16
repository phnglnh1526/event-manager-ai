import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_BASE_URL || "https://event-manager-api-aeyc.onrender.com";

  return {
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: target.replace(/\/api\/?$/, ""),
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
