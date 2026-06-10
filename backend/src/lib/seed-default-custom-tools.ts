import { upsertWorkspaceCustomTool, getWorkspaceCustomToolByKey } from "../repositories/workspace-custom-tools.js";

export const GET_WEATHER_TOOL_SOURCE = `function weatherCodeToText(code: number | undefined): string {
  const map: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 95: "Thunderstorm",
  };
  return code === undefined ? "Unknown" : (map[code] ?? \`Weather code \${code}\`);
}

export async function execute(
  input: { location: string },
  _ctx: { env: Record<string, string | undefined>; workspaceId: string; sessionId: string },
) {
  const geocodeUrl =
    \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(input.location)}&count=1&language=en&format=json\`;
  const geoResponse = await fetch(geocodeUrl);
  if (!geoResponse.ok) {
    return { ok: false, error: \`Failed geocoding request: HTTP \${geoResponse.status}\` };
  }
  const geoData = await geoResponse.json();
  const first = geoData.results?.[0];
  if (!first) {
    return { ok: false, error: \`No location found for "\${input.location}".\` };
  }
  const forecastUrl =
    \`https://api.open-meteo.com/v1/forecast?latitude=\${first.latitude}&longitude=\${first.longitude}\` +
    \`&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto\`;
  const forecastResponse = await fetch(forecastUrl);
  if (!forecastResponse.ok) {
    return { ok: false, error: \`Failed weather request: HTTP \${forecastResponse.status}\` };
  }
  const forecastData = await forecastResponse.json();
  const current = forecastData.current;
  if (!current) {
    return { ok: false, error: "Weather data unavailable for this location." };
  }
  return {
    ok: true,
    location: {
      name: first.name,
      country: first.country ?? null,
      region: first.admin1 ?? null,
      timezone: first.timezone ?? null,
    },
    current: {
      temperature: current.temperature_2m ?? null,
      humidity: current.relative_humidity_2m ?? null,
      wind_speed: current.wind_speed_10m ?? null,
      weather_text: weatherCodeToText(current.weather_code),
    },
  };
}
`;

const scope = "SeedDefaultCustomTools";

export async function ensureDefaultCustomTools(workspaceId: string): Promise<void> {
  try {
    const existing = await getWorkspaceCustomToolByKey(workspaceId, "get_weather");
    const result = await upsertWorkspaceCustomTool({
      workspaceId,
      toolId: existing?.id,
      displayName: "Get Weather",
      description:
        "Get current weather for a location using free Open-Meteo geocoding and forecast APIs.",
      sourceCode: GET_WEATHER_TOOL_SOURCE,
      requiredEnv: [],
      isActive: true,
      skipSecretCheck: true,
    });
    if (!result.ok) {
      console.error(`[${scope}/ensureDefaultCustomTools] Failed query: ${result.message}`);
      return;
    }
    console.info(`[${scope}/ensureDefaultCustomTools] Success: workspaceId=${workspaceId}`);
  } catch (error) {
    console.error(`[${scope}/ensureDefaultCustomTools] Unexpected error: ${String(error)}`);
  }
}
