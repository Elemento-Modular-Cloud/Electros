import express, { type Express, type Request, type Response, type Router } from "express";
import cors from "cors";
import type { Server } from "node:http";

export interface DaemonServerOptions {
  name: string;
  port: number;
  mountRouters: (app: Express) => void;
}

export function createDaemonServer(options: DaemonServerOptions): Server {
  const app = express();

  // Electron/Chromium caches GETs with ETag and revalidates with If-None-Match.
  // Express then answers 304 with an empty body; the GUI still treats that as OK
  // and crashes on response.json() (org-targets, listVMs, etc.).
  app.set("etag", false);
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - started;
      console.log(`[${options.name}:${options.port}] ${req.method} ${req.url} → ${res.statusCode} (${ms}ms)`);
    });
    next();
  });

  app.get("/", (_req, res) => {
    res.status(200).send("ok");
  });

  app.get("/version", (_req, res) => {
    json(res, { version: "synthetic-1.0.0", msg: "ok" });
  });

  options.mountRouters(app);

  return app.listen(options.port, "127.0.0.1", () => {
    console.log(`[${options.name}] listening on http://127.0.0.1:${options.port}`);
  });
}

export function json(res: Response, body: unknown, status = 200): void {
  res.status(status).json(body);
}

export function ok(res: Response): void {
  res.status(200).send("");
}

export function mountRouter(app: Express, basePath: string, router: Router): void {
  app.use(basePath, router);
}
