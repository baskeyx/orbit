// Open-Meteo: free hourly forecasts, no API key. Covers the next 16 days.
const CLISSOLD_PARK = { latitude: 51.563757, longitude: -0.083665 };

type HourlyForecast = {
  time: Date;
  temperatureC: number;
  rainChance: number; // %
  rainMm: number; // total over the preceding hour
  windMph: number;
  weatherCode: number; // WMO code, e.g. 0 = clear, 61 = light rain
};

const FORECAST_DAYS = 16;

// Open-Meteo wants "YYYY-MM-DDTHH:MM" with no zone; it's read as UTC (the default
// timezone). Minutes are ignored: the hour is rounded down.
function toOpenMeteoHour(date: Date) {
  return date.toISOString().slice(0, 16);
}

// Hourly forecast for [start, end], both hours included.
export async function getForecast(start: Date, end: Date): Promise<HourlyForecast[]> {
  // The forecast runs to 23:00 UTC on the 16th day (today included). Asking past
  // that fails the whole request, so the window is cut to fit.
  const lastHour = new Date();
  lastHour.setUTCHours(23, 0, 0, 0);
  lastHour.setUTCDate(lastHour.getUTCDate() + FORECAST_DAYS - 1);
  if (start > lastHour) return [];
  const until = end < lastHour ? end : lastHour;

  const params = new URLSearchParams({
    latitude: String(CLISSOLD_PARK.latitude),
    longitude: String(CLISSOLD_PARK.longitude),
    hourly:
      'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code',
    wind_speed_unit: 'mph',
    timeformat: 'unixtime',
    start_hour: toOpenMeteoHour(start),
    end_hour: toOpenMeteoHour(until),
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather forecast failed: ${res.status}`);

  const { hourly } = await res.json();
  const forecast: HourlyForecast[] = hourly.time.map((time: number, i: number) => ({
    time: new Date(time * 1000),
    temperatureC: hourly.temperature_2m[i],
    rainChance: hourly.precipitation_probability[i],
    rainMm: hourly.precipitation[i],
    windMph: hourly.wind_speed_10m[i],
    weatherCode: hourly.weather_code[i],
  }));

  // The last hours of the range come back as null; drop them rather than read them as 0.
  return forecast.filter((h) =>
    [h.temperatureC, h.rainChance, h.rainMm, h.windMph, h.weatherCode].every(
      (value) => value !== null,
    ),
  );
}

// Summarises the hours a session covers. Includes the end hour, because
// precipitation is reported for the hour before each timestamp.
// Returns null when the session is beyond the forecast range.
export function weatherForSession(
  forecast: HourlyForecast[],
  start: Date,
  end: Date,
) {
  const hours = forecast.filter((h) => h.time >= start && h.time <= end);
  if (hours.length === 0) return null;

  return {
    maxRainChance: Math.max(...hours.map((h) => h.rainChance)),
    totalRainMm: Math.round(hours.reduce((sum, h) => sum + h.rainMm, 0) * 10) / 10,
    maxWindMph: Math.round(Math.max(...hours.map((h) => h.windMph))),
    minTemperatureC: Math.round(Math.min(...hours.map((h) => h.temperatureC))),
    maxTemperatureC: Math.round(Math.max(...hours.map((h) => h.temperatureC))),
  };
}
