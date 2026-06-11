import { describe, expect, it } from "vitest";
import { normalizePublicApiHostname, resolvePublicApiAllowedHosts } from "./public-api-host.js";

describe("normalizePublicApiHostname", () => {
  // Full HTTPS URL → extract hostname only for host-guard comparisons.
  it("strips scheme and path from URLs", () => {
    expect(normalizePublicApiHostname("https://demo-app.senqo.app/")).toBe("demo-app.senqo.app");
  });

  // Hostname with port → compare on hostname without port.
  it("strips port from host:port values", () => {
    expect(normalizePublicApiHostname("demo-app.senqo.app:443")).toBe("demo-app.senqo.app");
  });
});

describe("resolvePublicApiAllowedHosts", () => {
  // API_URL set → use it and ignore FRONTEND_URL fallback.
  it("prefers API_URL over FRONTEND_URL", () => {
    expect(
      resolvePublicApiAllowedHosts("api.example.com", "https://app.example.com"),
    ).toEqual(["api.example.com"]);
  });

  // API_URL unset → fall back to FRONTEND_URL hostname.
  it("falls back to FRONTEND_URL when API_URL is unset", () => {
    expect(resolvePublicApiAllowedHosts(undefined, "https://demo-app.senqo.app")).toEqual([
      "demo-app.senqo.app",
    ]);
  });

  // API_URL supports comma-separated hostnames for multi-host deployments.
  it("parses comma-separated API_URL hostnames", () => {
    expect(resolvePublicApiAllowedHosts("a.example.com,b.example.com", undefined)).toEqual([
      "a.example.com",
      "b.example.com",
    ]);
  });

  // Neither env var yields hosts → production guard blocks all hosts until configured.
  it("returns empty list when API_URL and FRONTEND_URL are unset", () => {
    expect(resolvePublicApiAllowedHosts("", "")).toEqual([]);
  });
});
