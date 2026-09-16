import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { json } from "../createServer.js";

interface AgentThreadMessage {
  role: string;
  content: unknown;
}

interface AgentThread {
  thread_id: string;
  conversation_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: AgentThreadMessage[];
  busy: boolean;
  active_job_id: string | null;
}

interface AgentJob {
  id: string;
  thread_id: string;
  status: "queued" | "running" | "completed" | "failed";
  created_at: number;
  assistant?: string;
  result?: Record<string, unknown>;
  events: Array<{ message?: string }>;
}

const threads = new Map<string, AgentThread>();
const jobs = new Map<string, AgentJob>();
let confirmMode = "auto";

function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

function threadPreview(thread: AgentThread): string {
  for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
    const message = thread.messages[i];
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    const text = typeof message.content === "string" ? message.content.trim() : "";
    if (text.length > 0) {
      return text.slice(0, 160);
    }
  }
  return "";
}

function toThreadSummary(thread: AgentThread) {
  return {
    thread_id: thread.thread_id,
    conversation_id: thread.conversation_id,
    title: thread.title,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    message_count: thread.messages.length,
    preview: threadPreview(thread),
    busy: thread.busy,
    active_job_id: thread.active_job_id,
  };
}

function toThreadDetail(thread: AgentThread, includeMessages: boolean) {
  return {
    ...toThreadSummary(thread),
    messages: includeMessages ? thread.messages : undefined,
  };
}

function createThread(title: string): AgentThread {
  const now = unixNow();
  const threadId = randomUUID();
  const thread: AgentThread = {
    thread_id: threadId,
    conversation_id: threadId,
    title,
    created_at: now,
    updated_at: now,
    messages: [],
    busy: false,
    active_job_id: null,
  };
  threads.set(threadId, thread);
  return thread;
}

function cannedCompletion(content: string): Record<string, unknown> {
  return {
    id: `chatcmpl-${randomUUID().slice(0, 8)}`,
    object: "chat.completion",
    created: unixNow(),
    model: "synthetic-llm",
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 8, completion_tokens: 16, total_tokens: 24 },
  };
}

export function mcpRouter(): Router {
  const router = Router();

  router.options("*", (_req: Request, res: Response) => {
    res.status(204).send();
  });

  router.get("/ping", (_req: Request, res: Response) => {
    json(res, { ok: true, service: "electros-mcp", status: "up" });
  });

  router.get("/electros/confirm-mode", (_req: Request, res: Response) => {
    json(res, { mode: confirmMode, overridden: confirmMode !== "auto" });
  });
  router.post("/electros/confirm-mode", (req: Request, res: Response) => {
    confirmMode = String(req.body?.mode ?? "auto");
    json(res, { mode: confirmMode, overridden: confirmMode !== "auto" });
  });

  router.get("/electros/mitl-test", (_req: Request, res: Response) => {
    json(res, { endpoint: "/electros/mitl-test", usage: "POST to issue a test confirmation payload" });
  });
  router.post("/electros/mitl-test", (_req: Request, res: Response) => {
    json(res, {
      confirmation_required: true,
      tool: "synthetic_test",
      confirmation_token: randomUUID(),
    });
  });

  router.post("/proxy/llm/chat/completions", (_req: Request, res: Response) => {
    json(res, cannedCompletion("Synthetic LLM reply. No upstream model is called."));
  });

  router.get("/proxy/llm/agent/threads", (req: Request, res: Response) => {
    const limit = Number(req.query.limit ?? 100);
    const offset = Number(req.query.offset ?? 0);
    const items = [...threads.values()]
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(offset, offset + limit)
      .map((thread) => toThreadSummary(thread));
    json(res, { threads: items, count: threads.size });
  });

  router.post("/proxy/llm/agent/threads", (req: Request, res: Response) => {
    const title = String(req.body?.title ?? "New conversation");
    json(res, { thread: toThreadDetail(createThread(title), true) });
  });

  router.get("/proxy/llm/agent/threads/:threadId", (req: Request, res: Response) => {
    const thread = threads.get(req.params.threadId);
    if (!thread) {
      json(res, { detail: "Thread not found" }, 404);
      return;
    }
    const includeMessages = String(req.query.include_messages ?? "true") !== "false";
    json(res, { thread: toThreadDetail(thread, includeMessages) });
  });

  router.delete("/proxy/llm/agent/threads/:threadId", (req: Request, res: Response) => {
    threads.delete(req.params.threadId);
    json(res, { deleted: true, ok: true });
  });

  router.post("/proxy/llm/agent", (req: Request, res: Response) => {
    const poll = Boolean(req.body?.poll ?? req.query.poll);
    const requestedId = typeof req.body?.thread_id === "string" && req.body.thread_id
      ? String(req.body.thread_id)
      : typeof req.body?.conversation_id === "string" && req.body.conversation_id
        ? String(req.body.conversation_id)
        : "";
    let thread = requestedId ? threads.get(requestedId) : undefined;
    if (!thread) {
      const titleSource = String(req.body?.user_message ?? req.body?.title ?? "New conversation");
      thread = createThread(titleSource.slice(0, 48) || "New conversation");
    }
    if (thread.busy && thread.active_job_id) {
      json(res, {
        error: "thread_busy",
        active_job_id: thread.active_job_id,
        thread_id: thread.thread_id,
        conversation_id: thread.conversation_id,
      }, 409);
      return;
    }

    const userMessage = String(req.body?.user_message ?? "");
    const assistant = "Synthetic agent completed without calling a real LLM.";
    if (userMessage.length > 0) {
      thread.messages.push({ role: "user", content: userMessage });
    }
    thread.messages.push({ role: "assistant", content: assistant });
    thread.updated_at = unixNow();
    if (thread.title === "New conversation" && userMessage.length > 0) {
      thread.title = userMessage.slice(0, 48);
    }

    const result = {
      ...cannedCompletion(assistant),
      assistant,
      thread_id: thread.thread_id,
      conversation_id: thread.conversation_id,
    };

    if (poll) {
      const job: AgentJob = {
        id: randomUUID(),
        thread_id: thread.thread_id,
        status: "completed",
        created_at: unixNow(),
        assistant,
        result,
        events: [{ message: assistant }],
      };
      jobs.set(job.id, job);
      thread.busy = false;
      thread.active_job_id = null;
      json(res, {
        ok: true,
        poll: true,
        job_id: job.id,
        status: job.status,
        poll_url: `/proxy/llm/agent/jobs/${job.id}`,
        thread_id: thread.thread_id,
        conversation_id: thread.conversation_id,
      });
      return;
    }

    json(res, result);
  });

  router.get("/proxy/llm/agent/jobs/:jobId", (req: Request, res: Response) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      json(res, { error: "unknown_job_id", detail: "Job not found" }, 404);
      return;
    }
    json(res, {
      ok: true,
      status: job.status,
      next_since: job.events.length,
      events: job.events,
      result: job.result,
      assistant: job.assistant,
      thread_id: job.thread_id,
      conversation_id: job.thread_id,
      mitl_pending: false,
      active_job_id: null,
    });
  });

  return router;
}
