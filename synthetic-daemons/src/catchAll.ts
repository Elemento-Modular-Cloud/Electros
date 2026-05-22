import { Router, type Request, type Response } from "express";

/**
 * Fallback for ECD paths not yet implemented explicitly.
 * Returns empty collections/objects so the UI does not hard-fail.
 */
export function createCatchAllRouter(apiPrefix: string): Router {
  const router = Router();

  router.all("*", (req: Request, res: Response) => {
    const path = req.path;
    console.warn(`[catch-all] ${req.method} ${apiPrefix}${path} — returning safe default`);

    if (req.method === "GET" || req.method === "HEAD") {
      if (path.includes("list") || path.includes("accessible") || path.includes("status")
        || path.includes("running") || path.includes("backups") || path.includes("portforwards")
        || path.includes("porttunnel")) {
        res.status(200).json([]);
        return;
      }
      if (path.includes("canallocate") || path.includes("cancreate")) {
        res.status(200).json({ canallocate: true, cancreate: true });
        return;
      }
      if (path.includes("info")) {
        res.status(200).json({});
        return;
      }
      res.status(200).json({});
      return;
    }

    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
      res.status(200).json({ success: true });
      return;
    }

    res.status(200).send("");
  });

  return router;
}
