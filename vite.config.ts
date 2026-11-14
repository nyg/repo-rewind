import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

const GITHUB_API = "https://api.github.com"

// The access token lives in localStorage, so the built page may only talk to GitHub and the sign-in service.
function contentSecurityPolicy(connectSources: string[]): Plugin {
  const policy = [
    "default-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")

  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: policy,
        },
        injectTo: "head-prepend",
      },
    ],
  }
}

function connectSources(mode: string) {
  const env = loadEnv(mode, import.meta.dirname, "VITE_")
  const exchangeUrl = env.VITE_TOKEN_EXCHANGE_URL?.trim()
  return exchangeUrl ? [GITHUB_API, new URL(exchangeUrl).origin] : [GITHUB_API]
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(connectSources(mode)),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
}))
