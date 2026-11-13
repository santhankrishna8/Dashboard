import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * `npm run dev` has no serverless runtime, so this serves the routes in /api with the same handlers Vercel runs.
 * Keys come from your local .env. It only exists in the dev server, which listens on localhost.
 */
function localApi(mode: string): Plugin {
  const routes = new Set(["news", "lesson", "ideas", "judge", "status", "plan", "github", "vercel"]);
  return {
    name: "signal-desk-local-api",
    apply: "serve",
    configureServer(server) {
      Object.assign(process.env, loadEnv(mode, process.cwd(), ""), process.env.SD_REQUIRE_AUTH === "1" ? {} : { SD_LOCAL_DEV: "1" });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name = url.pathname.match(/^\/api\/([a-z]+)$/)?.[1];
        if (!name || !routes.has(name)) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<string, (r: Request) => Promise<Response>>;
          const method = (req.method ?? "GET").toUpperCase();
          const handler = mod[method];
          if (!handler) {
            res.statusCode = 405;
            return res.end("Method not allowed");
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const out = await handler(new Request(url, { method, headers, body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks) }));
          res.statusCode = out.status;
          out.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await out.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : "API route failed" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), localApi(mode)],
  server: {
    port: 5173,
    proxy: {
      "/api/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/yahoo/, ""),
      },
    },
  },
}));
