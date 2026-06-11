import { afterEach, describe, expect, it, vi } from "vitest";

async function loadPublicTasksApi() {
  vi.resetModules();
  return import("./public-tasks-api.js");
}

describe("getPublicTasksApiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // VITE_API_URL set → docs and curl examples use the configured public API host.
  it("returns VITE_API_URL host when configured", async () => {
    vi.stubEnv("VITE_API_URL", "https://demo-app.senqo.app");
    vi.stubGlobal("window", {
      location: {
        hostname: "demo-app.senqo.app",
        protocol: "https:",
        origin: "https://demo-app.senqo.app",
      },
    });
    const { getPublicTasksApiUrl } = await loadPublicTasksApi();
    expect(getPublicTasksApiUrl()).toBe("https://demo-app.senqo.app/api/tasks");
  });

  // VITE_API_URL unset → same-origin URL works for single-domain VPS deployments.
  it("returns same-origin API path when VITE_API_URL is unset", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubGlobal("window", {
      location: {
        hostname: "demo-app.senqo.app",
        protocol: "https:",
        origin: "https://demo-app.senqo.app",
      },
    });
    const { getPublicTasksApiUrl } = await loadPublicTasksApi();
    expect(getPublicTasksApiUrl()).toBe("https://demo-app.senqo.app/api/tasks");
  });

  // Local dev uses same-origin so examples work behind the Vite proxy without CORS.
  it("returns same-origin API path for local development", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        protocol: "http:",
        origin: "http://localhost:5173",
      },
    });
    const { getPublicTasksApiUrl } = await loadPublicTasksApi();
    expect(getPublicTasksApiUrl()).toBe("http://localhost:5173/api/tasks");
  });
});

describe("buildCreateTaskRequestBody", () => {
  // The request body must include all fields required by the API: message, sender, recipient, schedule type, timestamp, and timezone.
  it("includes one_time schedule fields required by the API", async () => {
    const { buildCreateTaskRequestBody } = await loadPublicTasksApi();
    expect(
      buildCreateTaskRequestBody({
        message: "Ping",
        senderPhone: "+60111111111",
        phoneNumber: "60122222222",
        scheduleAt: "2026-12-31T23:00:00",
        timezone: "Asia/Kuala_Lumpur",
      }),
    ).toEqual({
      message: "Ping",
      senderPhone: "+60111111111",
      phoneNumber: "60122222222",
      scheduleType: "one_time",
      scheduleAt: "2026-12-31T23:00:00",
      timezone: "Asia/Kuala_Lumpur",
    });
  });
});

describe("buildCreateTaskCurlExample", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // The generated curl example must contain the resolved API URL, the API key header, and the scheduleType payload.
  it("embeds the resolved URL and API key in a copy-ready curl command", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        protocol: "http:",
        origin: "http://localhost:5173",
      },
    });
    const { buildCreateTaskCurlExample } = await loadPublicTasksApi();
    const curl = buildCreateTaskCurlExample({
      apiKey: "sk_test_key",
      scheduleAt: "2026-12-31T23:00:00",
      timezone: "Asia/Kuala_Lumpur",
    });

    expect(curl).toContain("--url http://localhost:5173/api/tasks");
    expect(curl).toContain("x-api-key: sk_test_key");
    expect(curl).toContain('"scheduleType": "one_time"');
  });
});
