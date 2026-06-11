import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCreateTaskCurlExample,
  buildCreateTaskRequestBody,
  getPublicTasksApiUrl,
} from "./public-tasks-api";

describe("getPublicTasksApiUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // In production (app.senqo.app), the public tasks API URL must point to the dedicated api.senqo.app host.
  it("returns production API host when app runs on senqo.app", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "app.senqo.app",
        protocol: "https:",
        origin: "https://app.senqo.app",
      },
    });

    expect(getPublicTasksApiUrl()).toBe("https://api.senqo.app/api/tasks");
  });

  // In local dev (localhost), the URL must be same-origin so it works without CORS issues.
  it("returns same-origin API path for local development", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        protocol: "http:",
        origin: "http://localhost:5173",
      },
    });

    expect(getPublicTasksApiUrl()).toBe("http://localhost:5173/api/tasks");
  });
});

describe("buildCreateTaskRequestBody", () => {
  // The request body must include all fields required by the API: message, sender, recipient, schedule type, timestamp, and timezone.
  it("includes one_time schedule fields required by the API", () => {
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
  // The generated curl example must contain the resolved API URL, the API key header, and the scheduleType payload.
  it("embeds the resolved URL and API key in a copy-ready curl command", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "localhost",
        protocol: "http:",
        origin: "http://localhost:5173",
      },
    });

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
