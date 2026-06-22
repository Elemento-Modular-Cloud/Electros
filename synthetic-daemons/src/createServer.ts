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
