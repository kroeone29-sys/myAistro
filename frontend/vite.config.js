import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Single dev server: Vite serves the React app on :5173, and proxies any
// /api/* request to the FastAPI backend on :8000. Frontend code uses
// relative URLs ("/api/sot/graph"), which works:
//   - locally (proxy hops to localhost:8000)
//   - through a Cloudflare Tunnel pointing at :5173 (everything goes
//     through the same hostname; the proxy keeps /api/* on the same
//     origin, so no CORS, no second tunnel)
//
// Streaming endpoints (/api/ingest, /api/advisor/chat, /api/chat/general)
// need ws:true semantics? No — they're plain NDJSON over HTTP. The proxy
// passes them through as-is.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Bind to all interfaces so devices on the same LAN (or tailnet)
    // can reach the dev server — e.g. the user's phone hitting
    // http://<mac-lan-ip>:5173 or http://<mac>.local:5173, or
    // https://<mac>.<tailnet>.ts.net via Tailscale's private routing.
    //
    // This is intentional for a local-first personal tool that the
    // owner wants on their own devices. If running on a hostile
    // network (coffee shop wifi, hotel) you'd want to override with
    // `vite --host 127.0.0.1` to limit access back to the loopback.
    host: true,
    // Allow any Host header in dev mode. Vite blocks unknown Hosts by
    // default as a DNS-rebinding defense, which is overcautious for
    // this setup — the dev server's threat model is "I'm the only one
    // running it on my own LAN/tailnet" and the explicit allowlist
    // (localhost, .ts.net, .trycloudflare.com, .cfargotunnel.com,
    // every LAN IP, every .local mDNS name…) gets unmanageable fast.
    // Production sharing goes through the Funnel which is its own
    // explicit choice.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
