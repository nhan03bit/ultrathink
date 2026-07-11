// intent: ut-bridge entrypoint — Express server on port 3201 that exposes
//   UltraThink Neon data (memories, skills, adaptations, design-doc reviews,
//   activity) scoped to a single Paperclip agent. Bridges the cross-DB gap
//   without touching the live Paperclip server.
// status: done
// confidence: high

import "dotenv/config";
import express from "express";
import cors from "cors";
import { memoryRouter } from "./routes/memory.js";
import { skillsRouter } from "./routes/skills.js";
import { tekioRouter } from "./routes/tekio.js";
import { docsRouter } from "./routes/docs.js";
import { activityRouter } from "./routes/activity.js";
import { humansRouter } from "./routes/humans.js";
import { getAgents } from "./agents.js";

const PORT = Number(process.env.UT_BRIDGE_PORT ?? 3201);

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3100", "http://127.0.0.1:3100", "http://localhost:3333", "http://127.0.0.1:3333"],
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", async (_req, res) => {
  let dbOk = false;
  let dbErr: string | null = null;
  try {
    // Cheap DB ping via agents resolver (forces neon to lazy-init too)
    const list = await getAgents().catch(() => []);
    dbOk = Array.isArray(list);
  } catch (e: any) {
    dbErr = e?.message ?? "unknown";
  }
  res.json({
    ok: true,
    service: "ut-bridge",
    port: PORT,
    db: dbOk ? "ok" : `error: ${dbErr ?? "?"}`,
    paperclipBase: process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100",
    time: new Date().toISOString(),
  });
});

app.get("/agents", async (_req, res) => {
  const list = await getAgents();
  res.json(list);
});

app.use("/agents", memoryRouter);
app.use("/agents", skillsRouter);
app.use("/agents", tekioRouter);
app.use("/agents", docsRouter);
app.use("/agents", activityRouter);
app.use("/humans", humansRouter);

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[ut-bridge] listening on http://127.0.0.1:${PORT}`);
});
