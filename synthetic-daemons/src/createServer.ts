import express, { type Express, type Request, type Response, type Router } from "express";
import cors from "cors";
import type { Server } from "node:http";
import type { MemoryStore } from "./MemoryStore.js";

export interface DaemonServerOptions {
  name: string;
  port: number;
  rootMessage?: string;
  versionMessage?: string;
  mountRouters: (app: Express) => void;
}

export function createDaemonServer(options: DaemonServerOptions): Server {
  const app = express();

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
    res.status(200).type("text/plain").send(options.rootMessage ?? "ok");
  });

  app.get("/version", (_req, res) => {
    json(res, {
      version: "synthetic-1.0.0",
      msg: options.versionMessage ?? options.rootMessage ?? "ok",
    });
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

export function noContent(res: Response): void {
  res.status(204).send();
}

export function notFound(res: Response, detail = "Not found"): void {
  json(res, { detail }, 404);
}

export function message(res: Response, text: string, details?: string, status = 200): void {
  json(res, { message: text, details: details ?? "" }, status);
}

export function requireAuth(store: MemoryStore) {
  return (_req: Request, res: Response, next: () => void): void => {
    if (!store.authStatus.authenticated) {
      json(res, { detail: "Not authenticated" }, 401);
      return;
    }
    next();
  };
}

export function mountRouter(app: Express, basePath: string, router: Router): void {
  app.use(basePath, router);
}
