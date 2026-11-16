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

export async function fetchWeather(sido: string, sigungu: string): Promise<WeatherInfo> {
  const { lat, lon } = regionCoords(sido, sigungu);
  const now = new Date();
  const fallback: WeatherInfo = {
    ok: false,
    temp: 18,
    feels: 18,
    min: 12,
    max: 22,
    label: "날씨 정보를 불러오지 못했어요",
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
    observedAt: now.toISOString(),
  };

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
    "&timezone=Asia%2FSeoul&forecast_days=1";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
      };
      daily?: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
        weather_code: number[];
      };
    };
    if (!json.current || !json.daily) return fallback;
    const c = json.current;
    const code = CODE_MAP[c.weather_code] ?? { label: "날씨", emoji: "🌤️" };
    const min = Math.round(json.daily.temperature_2m_min[0]);
    const max = Math.round(json.daily.temperature_2m_max[0]);
    const rainProb = json.daily.precipitation_probability_max?.[0] ?? 0;
    const temp = Math.round(c.temperature_2m);
    return {
      ok: true,
      temp,
      feels: Math.round(c.apparent_temperature),
      min,
      max,
      label: code.label,
      emoji: code.emoji,
      rainProb,
      humidity: Math.round(c.relative_humidity_2m),
      wind: Math.round(c.wind_speed_10m),
      tips: tipsFor(code.label, temp, min, max, rainProb, c.wind_speed_10m, c.relative_humidity_2m),
      source: "live",
      observedAt: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}
