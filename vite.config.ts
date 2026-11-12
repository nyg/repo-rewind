import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "connect-src https://api.github.com",
  "img-src 'self' data: https://avatars.githubusercontent.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

// The access token lives in localStorage, so the built page may only talk to GitHub.
function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: CONTENT_SECURITY_POLICY,
        },
        injectTo: "head-prepend",
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
