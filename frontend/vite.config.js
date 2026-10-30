import fs from "fs";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let target = env.VITE_API_BASE_URL || "https://event-manager-api-aeyc.onrender.com";

  // If running inside a Docker container, localhost:8000 refers to the container itself.
  // Resolve to the Docker service name 'backend'.
  const isDocker = fs.existsSync("/.dockerenv");
  if (isDocker && (target.includes("localhost:8000") || target.includes("127.0.0.1:8000"))) {
    target = target.replace(/localhost:8000|127\.0\.0\.1:8000/, "backend:8000");
  }

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
