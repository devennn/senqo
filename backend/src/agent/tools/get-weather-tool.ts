import { tool } from "ai";
import { z } from "zod";
import type { ForecastResult, GeocodingResult } from "../../types/agent.js";

function weatherCodeToText(code: number | undefined): string {
  if (code === undefined) return "Unknown";
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
  };
  return map[code] ?? `Weather code ${code}`;
}

export const getWeatherTool = tool({
  description:
    "Get current weather for a location using free Open-Meteo geocoding + forecast APIs.",
  inputSchema: z.object({
    location: z.string().min(1),
  }),
  execute: async ({ location }) => {
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const geoResponse = await fetch(geocodeUrl);
    if (!geoResponse.ok) {
      return { ok: false, error: `Failed geocoding request: HTTP ${geoResponse.status}` };
    }

    const geoData = (await geoResponse.json()) as GeocodingResult;
    const first = geoData.results?.[0];
    if (!first) {
      return { ok: false, error: `No location found for "${location}".` };
    }

    const forecastUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${first.latitude}&longitude=${first.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&timezone=auto`;

    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) {
      return { ok: false, error: `Failed weather request: HTTP ${forecastResponse.status}` };
    }

    const forecastData = (await forecastResponse.json()) as ForecastResult;
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
        latitude: first.latitude,
        longitude: first.longitude,
      },
      current: {
        time: current.time ?? null,
        temperature: current.temperature_2m ?? null,
        temperature_unit: forecastData.current_units?.temperature_2m ?? "C",
        humidity: current.relative_humidity_2m ?? null,
        wind_speed: current.wind_speed_10m ?? null,
        wind_speed_unit: forecastData.current_units?.wind_speed_10m ?? "km/h",
        weather_code: current.weather_code ?? null,
        weather_text: weatherCodeToText(current.weather_code),
      },
    };
  },
});
