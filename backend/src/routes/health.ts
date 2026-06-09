import { Hono } from "hono";
import { getAppVersion } from "../lib/app-version.js";

const app = new Hono();

app.get("/", (c) =>
  c.json({
    ok: true,
    version: getAppVersion(),
    timestamp: new Date().toISOString(),
  }),
);

export default app;
