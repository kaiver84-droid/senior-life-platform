import { regionCoords } from "./regions";

export type WeatherInfo = {
  ok: boolean;
  temp: number;
  feels: number;
  min: number;
  max: number;
  label: string;
  emoji: string;
  rainProb: number;
  humidity: number;
  wind: number;
  tips: string[];
  source: "live" | "fallback";
  /** 어느 날씨 서비스에서 받았는지 (live 일 때만) */
  provider?: "open-meteo" | "met-no";
  observedAt: string;
};

const CODE_MAP: Record<number, { label: string; emoji: string }> = {
  0: { label: "맑음", emoji: "☀️" },
  1: { label: "대체로 맑음", emoji: "🌤️" },
  2: { label: "구름 조금", emoji: "⛅" },
  3: { label: "흐림", emoji: "☁️" },
  45: { label: "안개", emoji: "🌫️" },
  48: { label: "서리 안개", emoji: "🌫️" },
  51: { label: "약한 이슬비", emoji: "🌦️" },
  53: { label: "이슬비", emoji: "🌦️" },
  55: { label: "진한 이슬비", emoji: "🌧️" },
  61: { label: "약한 비", emoji: "🌦️" },
  63: { label: "비", emoji: "🌧️" },
  65: { label: "강한 비", emoji: "⛈️" },
  66: { label: "얼어붙는 비", emoji: "🌧️" },
  67: { label: "진한 얼음비", emoji: "🌧️" },
  71: { label: "약한 눈", emoji: "🌨️" },
  73: { label: "눈", emoji: "❄️" },
  75: { label: "많은 눈", emoji: "☃️" },
  77: { label: "싸락눈", emoji: "🌨️" },
  80: { label: "소나기", emoji: "🌦️" },
  81: { label: "소나기", emoji: "🌧️" },
  82: { label: "강한 소나기", emoji: "⛈️" },
  85: { label: "눈 소나기", emoji: "🌨️" },
  86: { label: "강한 눈 소나기", emoji: "❄️" },
  95: { label: "천둥번개", emoji: "⛈️" },
  96: { label: "천둥번개·우박", emoji: "⛈️" },
  99: { label: "강한 천둥번개", emoji: "⛈️" },
};

function tipsFor(
  label: string,
  temp: number,
  min: number,
  max: number,
  rainProb: number,
  wind: number,
  humidity: number
): string[] {
  const tips: string[] = [];
  const rainy = /비|소나기|천둥/.test(label);
  const snowy = /눈/.test(label);

  if (rainy) tips.push("비가 와요. 우산을 꼭 챙기고 미끄러운 길을 조심하세요.");
  if (snowy) tips.push("눈이 와요. 미끄럼 방지 신발을 신고 천천히 걸으세요.");
  if (!rainy && !snowy && rainProb >= 60) tips.push(`비 올 확률이 ${rainProb}%예요. 접이식 우산을 가방에 넣어 두세요.`);

  if (max <= 0) tips.push("매우 추워요. 장갑·목도리를 챙기고 오래 바깥에 있지 마세요.");
  else if (max <= 5) tips.push("쌀쌀해요. 따뜻한 옷을 여러 겹 입으세요.");
  else if (max <= 11) tips.push("쌀쌀한 날이에요. 겉옷을 꼭 챙기세요.");
  else if (max >= 33) tips.push("무더위예요. 오후 2시~5시 외출은 피하고 물을 자주 드세요.");
  else if (max >= 28) tips.push("더워요. 물을 자주 마시고 모자나 양산을 챙기세요.");
  else if (min <= 3) tips.push("아침저녁으로 쌀쌀해요. 얇은 겉옷을 준비하세요.");

  if (wind >= 9) tips.push("바람이 강해요. 문을 열어 둘 때와 야외 활동에 주의하세요.");
  if (humidity >= 85 && !rainy) tips.push("습도가 높아요. 집 안 환기를 짧게 자주 해 주세요.");
  if (temp <= 5) tips.push("길이 얼어 미끄러울 수 있어요. 계단과 경사로는 손잡이를 잡으세요.");
  if (tips.length === 0) tips.push("걷기 좋은 날씨예요. 가까운 공원이나 산책로를 20분 걸어 보세요.");
  tips.push("외출 후에는 손을 씻고 따뜻한 물을 한 잔 드세요.");
  return tips.slice(0, 3);
}

/** 두 날씨 서비스가 모두 막혔을 때 보여 주는 안내 (숫자를 지어내지 않는다) */
export function fallbackWeather(): WeatherInfo {
  return {
    ok: false,
    temp: 0,
    feels: 0,
    min: 0,
    max: 0,
    label: "날씨를 불러오지 못했어요",
    emoji: "🌤️",
    rainProb: 0,
    humidity: 0,
    wind: 0,
    tips: [
      "바깥 날씨는 직접 창밖을 한 번 확인해 보세요.",
      "오늘은 얇은 겉옷 하나를 챙기면 좋아요.",
      "외출 후 손 씻기와 따뜻한 물 한 잔을 잊지 마세요.",
    ],
    source: "fallback",
    observedAt: new Date().toISOString(),
  };
}

async function getJson(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ① Open-Meteo (키 없이 쓸 수 있는 세계 날씨) */
export async function fetchFromOpenMeteo(lat: number, lon: number): Promise<WeatherInfo | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
    "&timezone=Asia%2FSeoul&forecast_days=1";

  const json = await getJson(url, 7000);
  if (!json?.current || !json?.daily) return null;
  const c = json.current;
  const code = CODE_MAP[c.weather_code] ?? { label: "날씨", emoji: "🌤️" };
  const min = Math.round(json.daily.temperature_2m_min?.[0] ?? c.temperature_2m);
  const max = Math.round(json.daily.temperature_2m_max?.[0] ?? c.temperature_2m);
  const rainProb = Math.round(json.daily.precipitation_probability_max?.[0] ?? 0);
  const temp = Math.round(c.temperature_2m);
  const humidity = Math.round(c.relative_humidity_2m ?? 0);
  const wind = Math.round(c.wind_speed_10m ?? 0);
  return {
    ok: true,
    temp,
    feels: Math.round(c.apparent_temperature ?? c.temperature_2m),
    min,
    max,
    label: code.label,
    emoji: code.emoji,
    rainProb,
    humidity,
    wind,
    tips: tipsFor(code.label, temp, min, max, rainProb, wind, humidity),
    source: "live",
    provider: "open-meteo",
    observedAt: new Date().toISOString(),
  };
}

/** MET Norway 의 날씨 기호(symbol_code)를 한국어로 */
function metLabel(symbol: string): { label: string; emoji: string } {
  const s = symbol.toLowerCase();
  if (s.includes("thunder")) return { label: "천둥번개", emoji: "⛈️" };
  if (s.includes("sleet")) return { label: "진눈깨비", emoji: "🌧️" };
  if (s.includes("snow")) return { label: "눈", emoji: "❄️" };
  if (s.includes("heavyrain")) return { label: "강한 비", emoji: "⛈️" };
  if (s.includes("lightrain")) return { label: "약한 비", emoji: "🌦️" };
  if (s.includes("rain")) return { label: "비", emoji: "🌧️" };
  if (s.includes("fog")) return { label: "안개", emoji: "🌫️" };
  if (s.includes("partlycloudy")) return { label: "구름 조금", emoji: "⛅" };
  if (s.includes("cloudy")) return { label: "흐림", emoji: "☁️" };
  if (s.includes("fair")) return { label: "대체로 맑음", emoji: "🌤️" };
  if (s.includes("clear")) return { label: "맑음", emoji: "☀️" };
  return { label: "날씨", emoji: "🌤️" };
}

/** ② MET Norway (백업 — Open-Meteo 가 막힌 망에서도 살아 있는 날씨) */
export async function fetchFromMetNo(lat: number, lon: number): Promise<WeatherInfo | null> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const json = await getJson(url, 7000, {
    // MET Norway 는 연락처가 담긴 User-Agent 를 요구한다(브라우저에서는 헤더를 못 넣어 서버에서만 쓴다).
    "User-Agent": "neulbom-senior-platform/1.0 (https://senior-life-platform.pages.dev)",
    Accept: "application/json",
  });
  const series = json?.properties?.timeseries;
  if (!Array.isArray(series) || series.length === 0) return null;

  const now = series[0];
  const details = now?.data?.instant?.details;
  if (!details || typeof details.air_temperature !== "number") return null;

  const temp = Math.round(details.air_temperature);
  const humidity = Math.round(details.relative_humidity ?? 0);
  const wind = Math.round(details.wind_speed ?? 0);
  const summary = now?.data?.next_1_hours?.summary ?? now?.data?.next_6_hours?.summary;
  const code = metLabel(summary?.symbol_code ?? "");
  const rainProb = Math.round(
    now?.data?.next_1_hours?.details?.probability_of_precipitation ??
      now?.data?.next_6_hours?.details?.probability_of_precipitation ??
      0
  );

  // 앞으로 24시간의 최저·최고
  const temps: number[] = series
    .slice(0, 24)
    .map((t: any) => t?.data?.instant?.details?.air_temperature)
    .filter((v: any) => typeof v === "number");
  const min = Math.round(Math.min(...temps, details.air_temperature));
  const max = Math.round(Math.max(...temps, details.air_temperature));

  return {
    ok: true,
    temp,
    feels: temp,
    min,
    max,
    label: code.label,
    emoji: code.emoji,
    rainProb,
    humidity,
    wind,
    tips: tipsFor(code.label, temp, min, max, rainProb, wind, humidity),
    source: "live",
    provider: "met-no",
    observedAt: new Date().toISOString(),
  };
}

/**
 * 실제 날씨 조회 (서버·브라우저 공용).
 * Open-Meteo → MET Norway 순서로 시도하고, 둘 다 안 되면 안내용 기본값을 준다.
 */
export async function fetchWeatherLive(sido: string, sigungu: string): Promise<WeatherInfo> {
  const { lat, lon } = regionCoords(sido, sigungu);
  const open = await fetchFromOpenMeteo(lat, lon);
  if (open) return open;
  const met = await fetchFromMetNo(lat, lon);
  if (met) return met;
  return fallbackWeather();
}

/**
 * 화면에서 쓰는 날씨 조회.
 * 먼저 우리 서버(/api/weather)에 물어본다 — 서버가 대신 조회하므로
 * 아이폰 Safari·카카오톡 안 화면처럼 바깥 주소가 막힌 곳에서도 날씨가 뜬다.
 * 서버도 안 되면 브라우저에서 직접 한 번 더 시도한다.
 */
export async function fetchWeather(sido: string, sigungu: string): Promise<WeatherInfo> {
  const qs = `sido=${encodeURIComponent(sido || "")}&sigungu=${encodeURIComponent(sigungu || "")}`;
  const json = await getJson(`/api/weather?${qs}`, 9000);
  if (json && json.source === "live" && typeof json.temp === "number") return json as WeatherInfo;

  const live = await fetchWeatherLive(sido, sigungu);
  if (live.ok) return live;
  return json && typeof json.temp === "number" ? ({ ...(json as WeatherInfo), ok: false } as WeatherInfo) : live;
}

export { tipsFor };
