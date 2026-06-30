import { Router, type Request, type Response } from "express";

export function mcpRouter(): Router {
  const router = Router();
  router.get("/ping", (_req: Request, res: Response) => {
    res.status(200).send("pong");
  });
  return router;
}
