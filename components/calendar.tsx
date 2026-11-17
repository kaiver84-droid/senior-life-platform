"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/storage";
import { shareMessageText, shareText } from "@/lib/share";
import { REGIONS, shortSido, sigunguList } from "@/lib/regions";
import { regionLinks } from "@/lib/region-links";
import { kstDate } from "@/lib/week";
import {
  ALARM_MODES,
  ALARM_TIMES,
  DEFAULT_ALARM,
  DEFAULT_ALARM_TIME,
  EVENT_KINDS,
  alarmLabel,
  alarmModeOf,
  alarmTimeLabel,
  alarmTimeOf,
  dateKey,
  dayTitle,
  daysBetween,
  ddayLabel,
  dueAlarms,
  eventsInMonth,
  eventsOnDate,
  isLunarEvent,
  kindInfo,
  lunarBadgeText,
  lunarSolarDate,
  monthMatrix,
  monthOf,
  monthTitle,
  nextOccurrence,
  normalizeAlarm,
  normalizeAlarmTime,
  shiftMonth,
  upcomingEvents,
  weekdayOf,
  weekdayShort,
  type DueAlarm,
  type FamilyCalendarType,
  type FamilyEvent,
  type FamilyEventAlarm,
  type FamilyEventKind,
  type YearMonth,
} from "@/lib/calendar";
import {
  hasLeapMonth,
  leapMonthOf,
  lunarMonthDays,
  lunarShortOf,
  lunarText,
  lunarToSolar,
  solarToLunar,
} from "@/lib/lunar";
import { eventIcsText, eventsIcsText, icsFileName } from "@/lib/ics";
import {
  localNewsFor,
  newsAreaName,
  newsCategoryInfo,
  newsOnDate,
  newsPeriod,
  newsShareText,
  type LocalNews,
  type NewsCategory,
} from "@/lib/local-news";
import { Badge, BigButton, Divider, Portal, Sheet, useToast } from "./ui";
import { IconBack, IconCalendar, IconChat, IconChevron, IconClock, IconPin, IconPlus } from "./icons";
import { SpeakButton } from "./speak";

type Filter = "all" | "family" | NewsCategory;

const FILTERS: { key: Filter; label: string; emoji: string }[] = [
  { key: "all", label: "전체", emoji: "🗓️" },
  { key: "family", label: "가족일정", emoji: "👨‍👩‍👧" },
  { key: "event", label: "행사", emoji: "🎪" },
  { key: "festival", label: "축제", emoji: "🏮" },
  { key: "class", label: "무료 강좌", emoji: "🎓" },
  { key: "welfare", label: "복지 소식", emoji: "🎁" },
];

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 해 선택 범위 — 어르신 생일·기념일부터 손주 생일까지 */
const YEARS = Array.from({ length: 106 }, (_, i) => 1930 + i);

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 🌙 음력 배지 — 음력 일정이면 ‘음력 10월 15일 (양력 11월 23일)’ */
function LunarBadge({
  event,
  occurrence,
  className = "",
}: {
  event: FamilyEvent;
  occurrence: string;
  className?: string;
}) {
  const text = lunarBadgeText(event, occurrence);
  if (!text) return null;
  return (
    <span
      data-lunar-badge
      className={`inline-flex items-center gap-1 rounded-full bg-plum-light px-2 py-0.5 text-[0.78rem] font-extrabold leading-tight text-plum-dark ${className}`}
    >
      🌙 {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 알람 — 오늘 울릴 일정 · 확인 표시 · 휴대폰 알림                     */
/* ------------------------------------------------------------------ */

const ackKey = (date: string) => `neulbom.alarm.ack.${date}`;
const notifiedKey = (date: string) => `neulbom.alarm.notified.${date}`;
/** 확인했거나 알림을 보낸 일정이 바뀌면 화면들이 함께 새로 고친다 */
const ACK_EVENT = "neulbom:alarm-ack";

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function readAlarmAcks(date: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ackKey(date));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** ‘확인했어요’ — 오늘은 그 일정 알림을 다시 띄우지 않는다 */
export function ackAlarms(date: string, ids: string[]) {
  if (typeof window === "undefined") return;
  const next = Array.from(new Set([...readAlarmAcks(date), ...ids.filter(Boolean)]));
  try {
    window.localStorage.setItem(ackKey(date), JSON.stringify(next));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드)에서도 화면은 그대로 쓸 수 있게 둔다
  }
  window.dispatchEvent(new Event(ACK_EVENT));
}

/** 오늘 알람 시각이 지났고 아직 확인하지 않은 일정 */
export function useDueAlarms(): DueAlarm[] {
  const { state, today } = useApp();
  const [minute, setMinute] = useState(() => nowMinutes());
  const [acks, setAcks] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setAcks(readAlarmAcks(today));
    const tick = () => setMinute(nowMinutes());
    refresh();
    tick();
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener(ACK_EVENT, refresh);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ACK_EVENT, refresh);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [today]);

  return useMemo(
    () => dueAlarms(state.familyEvents, today, minute).filter((d) => !acks.includes(d.event.id)),
    [state.familyEvents, today, minute, acks]
  );
}

function notificationState(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as "granted" | "denied" | "default";
}

/** 화면 어디서든 한 번만 달아 두면, 알람 시간이 되었을 때 휴대폰 알림을 보낸다 */
export function AlarmWatcher() {
  const due = useDueAlarms();

  useEffect(() => {
    if (!due.length) return;
    if (notificationState() !== "granted") return;
    const date = due[0].alarmDate;
    const ids = due.map((d) => d.event.id).join(",");
    try {
      if (window.localStorage.getItem(notifiedKey(date)) === ids) return;
    } catch {
      return;
    }
    try {
      const body = due
        .map((d) => `· ${d.event.title} (${dayTitle(d.occurrence)})`)
        .join("\n");
      new Notification("🔔 늘봄 일정 알림", { body, tag: "neulbom-alarm", lang: "ko" });
      window.localStorage.setItem(notifiedKey(date), ids);
    } catch {
      // 알림을 못 보내도 화면 카드가 같은 내용을 보여 준다
    }
  }, [due]);

  return null;
}

/** 🔔 휴대폰 알림 켜기 — 권한을 물어보고, 이미 허용했으면 그대로 알려 준다 */
export function AlarmPermissionButton({ full = true }: { full?: boolean }) {
  const { show } = useToast();
  const [perm, setPerm] = useState<"granted" | "denied" | "default" | "unsupported">("default");

  useEffect(() => {
    setPerm(notificationState());
  }, []);

  const ask = async () => {
    if (notificationState() === "unsupported") {
      show("이 브라우저는 휴대폰 알림을 지원하지 않아요. 아래 ‘📅 휴대폰 알람에 넣기’를 써 주세요.");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      show(
        p === "granted"
          ? "휴대폰 알림을 켰어요. 알람 시간에 알려 드릴게요."
          : p === "denied"
            ? "알림이 꺼져 있어요. 브라우저 설정에서 알림을 허용해 주세요."
            : "알림을 허용하지 않았어요. 필요할 때 다시 눌러 주세요."
      );
    } catch {
      show("알림을 켜지 못했어요. 아이폰은 ‘홈 화면에 추가’한 앱에서 켤 수 있어요.");
    }
  };

  return (
    <button
      type="button"
      data-alarm-permission
      onClick={() => void ask()}
      className={`flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl border-2 px-3 text-[0.9rem] font-extrabold ${
        perm === "granted"
          ? "border-leaf bg-leaf-light text-leaf-dark"
          : perm === "denied"
            ? "border-ink/10 bg-white text-ink/55"
            : "border-brand/30 bg-white text-brand-dark"
      } ${full ? "w-full" : ""}`}
    >
      🔔 {perm === "granted" ? "휴대폰 알림 켜짐" : perm === "denied" ? "휴대폰 알림이 꺼져 있어요" : "휴대폰 알림 켜기"}
    </button>
  );
}

/** .ics 파일을 만들어 내려받는다 — 받은 파일을 누르면 휴대폰 캘린더에 일정·알람이 들어간다 */
function downloadIcs(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 📅 휴대폰 알람(.ics)에 넣기 */
export function IcsButton({
  item,
  items,
  label = "📅 휴대폰 알람(.ics)에 넣기",
  className = "",
}: {
  item?: { event: FamilyEvent; occurrence: string };
  items?: { event: FamilyEvent; occurrence: string; alarmDate?: string }[];
  label?: string;
  className?: string;
}) {
  const { show } = useToast();
  const save = () => {
    const list = items ?? (item ? [item] : []);
    const withAlarm = list.filter((it) => alarmModeOf(it.event) !== "none");
    if (!withAlarm.length) {
      show("알람을 ‘당일·1일 전·3일 전’ 중에 골라 두면 휴대폰 알람으로 넣을 수 있어요.");
      return;
    }
    if (withAlarm.length === 1) {
      const one = withAlarm[0];
      downloadIcs(eventIcsText(one.event, { occurrence: one.occurrence }), icsFileName(one.event, one.occurrence));
    } else {
      downloadIcs(eventsIcsText(withAlarm), "늘봄_가족일정_알람.ics");
    }
    show("내려받은 파일을 눌러 휴대폰 캘린더에서 ‘추가’를 눌러 주세요.");
  };

  return (
    <button
      type="button"
      data-ics-button
      onClick={save}
      className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-brand/25 bg-white px-3 text-[0.86rem] font-extrabold text-brand-dark shadow-soft active:bg-paper ${className}`}
    >
      {label}
    </button>
  );
}

/** 🔔 오늘의 일정 알림 카드 — 홈 화면과 달력 맨 위에 보인다 */
export function TodayAlarmCard({ where = "calendar" }: { where?: "home" | "calendar" }) {
  const due = useDueAlarms();
  const { show } = useToast();

  if (!due.length) return null;

  const speech = [
    "오늘 일정 알림입니다.",
    ...due.map(
      (d) =>
        `${d.event.title}, ${dayTitle(d.occurrence)}${d.daysLeft > 0 ? `, ${d.daysLeft}일 뒤` : " 오늘"}입니다.`
    ),
    "준비하실 것이 있으면 미리 챙겨 두세요.",
  ].join(" ");

  return (
    <section
      data-today-alarm={where}
      className="fade-up rounded-[1.6rem] border-2 border-gold bg-gradient-to-br from-gold-light via-[#FFF3CE] to-white p-4 shadow-card"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-[1.5rem] leading-none">
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.08rem] font-black leading-tight text-ink">오늘의 일정 알림</p>
          <p className="mt-0.5 text-[0.82rem] font-bold text-[#7A5600]">
            알람 시간이 되었어요 · {due.length}건
          </p>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {due.map((d) => (
          <div key={`${d.event.id}-${d.occurrence}`} className="rounded-2xl bg-white px-3 py-2 shadow-soft">
            <p className="text-[0.98rem] font-black leading-snug text-ink">
              {kindInfo(d.event.kind).emoji} {d.event.title}
            </p>
            <p className="mt-0.5 text-[0.8rem] font-bold text-ink/55">
              {dayTitle(d.occurrence)}
              {d.daysLeft > 0 ? ` · ${d.daysLeft}일 뒤` : " · 오늘"}
            </p>
            <LunarBadge event={d.event} occurrence={d.occurrence} className="mt-1" />
            <p className="mt-0.5 text-[0.78rem] font-extrabold text-gold-dark">
              🔔 {alarmLabel(d.event)}에 알려 드려요
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-2">
        <SpeakButton text={speech} label="소리로 듣기" tone="sun" full dataName="alarm" />
        <IcsButton
          items={due.map((d) => ({ event: d.event, occurrence: d.occurrence, alarmDate: d.alarmDate }))}
          label="📅 휴대폰 알람에 넣기"
          className="!min-h-[52px] !rounded-2xl !text-[0.94rem]"
        />
        <AlarmPermissionButton />
        <BigButton
          variant="white"
          full
          height={52}
          onClick={() => {
            ackAlarms(due[0].alarmDate, due.map((d) => d.event.id));
            show("알림을 확인했어요. 오늘은 다시 띄우지 않을게요.");
          }}
        >
          ✅ 확인했어요
        </BigButton>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 가족안부달력 전체 화면                                              */
/* ------------------------------------------------------------------ */

export function CalendarScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, state, today, removeFamilyEvent } = useApp();
  const { show } = useToast();
  const events = state.familyEvents;

  const [ym, setYm] = useState<YearMonth>(() => monthOf(today));
  const [selected, setSelected] = useState<string>(today);
  const [filter, setFilter] = useState<Filter>("all");
  /** 달력 안에서 잠깐 다른 지역을 볼 때 (프로필 지역은 그대로 둔다) */
  const [region, setRegion] = useState<{ sido: string; sigungu: string } | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [form, setForm] = useState<{ open: boolean; editing: FamilyEvent | null; date: string }>({
    open: false,
    editing: null,
    date: today,
  });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** 방금 저장한 일정 — 저장 직후 휴대폰 알람(.ics)에 바로 넣을 수 있게 */
  const [justSaved, setJustSaved] = useState<{ event: FamilyEvent; date: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setYm(monthOf(today));
    setSelected(today);
    setFilter("all");
    setConfirmId(null);
    setRegion(null);
    setRegionOpen(false);
  }, [open, today]);

  const mySido = profile?.sido || "";
  const mySigungu = profile?.sigungu || "";
  const viewSido = region?.sido ?? mySido;
  const viewSigungu = region?.sigungu ?? mySigungu;
  const area = newsAreaName(viewSido, viewSigungu);
  const isMyRegion = viewSido === mySido && viewSigungu === mySigungu;

  const news = useMemo(
    () => localNewsFor(viewSido, viewSigungu, today, 4),
    [viewSido, viewSigungu, today]
  );
  const links = useMemo(() => regionLinks(viewSido, viewSigungu), [viewSido, viewSigungu]);

  const grid = useMemo(() => monthMatrix(ym), [ym]);
  const monthEvents = useMemo(() => eventsInMonth(events, ym), [events, ym]);

  const familyDotByDate = useMemo(() => {
    const set = new Set<string>();
    monthEvents.forEach((e) => set.add(e.date));
    return set;
  }, [monthEvents]);

  const newsDotByDate = useMemo(() => {
    const prefix = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
    const set = new Set<string>();
    news.forEach((n) => {
      if (n.startDate.startsWith(prefix)) set.add(n.startDate);
    });
    return set;
  }, [news, ym]);

  const dayEvents = eventsOnDate(events, selected);
  const dayNews = newsOnDate(news, selected);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const up = upcomingEvents(events, today, 400, 40).map((u) => ({
      type: "family" as const,
      date: u.date,
      days: u.days,
      event: u.event,
      key: `f-${u.event.id}-${u.date}`,
    }));
    const newsRows = news
      .filter((n) => {
        // 매달 되풀이되는 소식은 가장 가까운 한 번만 목록에 보여 준다(달력 점은 그 달마다 찍힌다)
        if (n.category === "welfare" || n.category === "class") {
          const key = `${n.category}|${n.title}`;
          if (seen.has(key)) return false;
          seen.add(key);
        }
        return true;
      })
      .map((n) => ({
        type: "news" as const,
        date: n.startDate < today ? today : n.startDate,
        days: daysBetween(today, n.startDate),
        news: n,
        key: `n-${n.id}`,
      }));
    const all = [...up, ...newsRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return all.filter((r) => {
      if (filter === "all") return true;
      if (filter === "family") return r.type === "family";
      return r.type === "news" && r.news.category === filter;
    });
  }, [events, news, today, filter]);

  const shareEvent = async (ev: FamilyEvent, date: string) => {
    const next = nextOccurrence(ev, today);
    const days = next ? daysBetween(today, next) : null;
    const result = await shareText({
      title: `${ev.title} 안내`,
      text: `[늘봄 가족안부달력] ${kindInfo(ev.kind).emoji} ${ev.title}\n· 날짜: ${dayTitle(date)}${
        days !== null ? ` (${ddayLabel(days)})` : ""
      }${lunarBadgeText(ev, date) ? `\n· 🌙 ${lunarBadgeText(ev, date)}` : ""}${
        ev.repeatYearly ? "\n· 매년 반복하는 날이에요" : ""
      }${ev.memo ? `\n· ${ev.memo}` : ""}`,
    });
    show(shareMessageText(result));
  };

  const shareNews = async (n: LocalNews) => {
    const result = await shareText({ title: n.title, text: newsShareText(n) });
    show(shareMessageText(result));
  };

  if (!open) return null;

  const goToday = () => {
    setYm(monthOf(today));
    setSelected(today);
  };

  // 달을 넘길 때 고른 날짜도 그 달로 옮긴다 (같은 날짜 → 그 달 말일)
  const goMonth = (delta: number) => {
    const next = shiftMonth(ym, delta);
    const cur = monthOf(selected);
    setYm(next);
    if (cur.year !== next.year || cur.month !== next.month) {
      const day = Number(selected.slice(8, 10));
      const last = new Date(Date.UTC(next.year, next.month, 0)).getUTCDate();
      setSelected(dateKey(next.year, next.month, Math.min(day, last)));
    }
  };

  const pickDay = (date: string, inMonth: boolean) => {
    if (!inMonth) setYm(monthOf(date));
    setSelected(date);
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper">
        <div className="mx-auto min-h-full w-full max-w-[460px] pb-[calc(env(safe-area-inset-bottom,0px)+28px)]">
          {/* 머리말 */}
          <header className="sticky top-0 z-10 border-b border-ink/8 bg-paper">
            <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
              <button
                onClick={onClose}
                aria-label="달력 닫기"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink/70 shadow-soft"
              >
                <IconBack size={22} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-[1.16rem] font-black leading-tight text-ink">📅 가족안부달력</h1>
                <p className="text-[0.76rem] font-bold leading-snug text-ink/50">가족 일정과 우리 동네 소식</p>
              </div>
              <button
                onClick={() => setForm({ open: true, editing: null, date: selected })}
                className="flex min-h-[46px] shrink-0 items-center gap-1 rounded-full bg-coral px-3.5 text-[0.88rem] font-extrabold text-white shadow-soft active:bg-coral-dark"
              >
                <IconPlus size={18} /> 일정
              </button>
            </div>

            {/* 우리동네 소식 지역 — 누르면 다른 시·군·구로 바꿔 볼 수 있다 */}
            <div className="px-4 pb-2.5">
              <button
                onClick={() => setRegionOpen(true)}
                aria-label="우리동네 소식 지역 바꾸기"
                className="flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-white px-3 text-left shadow-soft active:bg-paper"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light">
                  <IconPin size={17} className="text-brand-dark" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.72rem] font-extrabold leading-none text-ink/45">
                    우리동네 소식 지역
                  </span>
                  <span className="mt-0.5 block truncate text-[0.98rem] font-black leading-tight text-ink">
                    {area}
                    {!isMyRegion ? <span className="ml-1 text-[0.78rem] font-bold text-brand-dark">(내 지역 아님)</span> : null}
                  </span>
                </span>
                <IconChevron size={18} className="shrink-0 rotate-90 text-ink/35" />
              </button>
            </div>
          </header>

          <div className="space-y-3 px-4 pt-3">
            {/* 🔔 오늘 일정 알림 — 알람 시간이 되면 달력 맨 위에 먼저 보인다 */}
            <TodayAlarmCard where="calendar" />

            {/* 방금 저장한 일정 — 바로 휴대폰 알람에 넣기 */}
            {justSaved ? (
              <div data-calendar-saved className="fade-up rounded-[1.4rem] border-2 border-leaf/30 bg-leaf-light/60 p-3.5">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="text-[1.2rem] leading-none">✅</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.98rem] font-black leading-snug text-ink">
                      {justSaved.event.title} 저장했어요
                    </p>
                    <p className="mt-0.5 text-[0.8rem] font-bold text-leaf-dark">
                      🔔 {alarmLabel(justSaved.event) || "알람 없음"} · {dayTitle(justSaved.date)}
                    </p>
                    <LunarBadge event={justSaved.event} occurrence={justSaved.date} className="mt-1" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setJustSaved(null)}
                    aria-label="저장 안내 닫기"
                    className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[0.76rem] font-extrabold text-ink/55 shadow-soft"
                  >
                    닫기
                  </button>
                </div>
                {alarmModeOf(justSaved.event) !== "none" ? (
                  <div className="mt-2">
                    <IcsButton
                      item={{ event: justSaved.event, occurrence: justSaved.date }}
                      className="w-full !bg-white"
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 text-[0.78rem] font-semibold leading-snug text-ink/55">
                    알람을 켜 두면 휴대폰 알람(.ics)으로도 넣을 수 있어요.
                  </p>
                )}
              </div>
            ) : null}

            {/* 다음 생일·기념일 — 옆으로 잘리지 않도록 세로로 차곡차곡 */}
            {upcomingEvents(events, today, 120, 3).length > 0 ? (
              <div className="space-y-2" data-calendar-upcoming>
                {upcomingEvents(events, today, 120, 3).map((u) => (
                  <button
                    key={`${u.event.id}-${u.date}`}
                    onClick={() => {
                      setYm(monthOf(u.date));
                      setSelected(u.date);
                    }}
                    className="flex min-h-[58px] w-full items-center gap-2.5 rounded-2xl bg-white px-3 py-2 text-left shadow-soft active:bg-paper"
                  >
                    <span className="text-[1.3rem]">{kindInfo(u.event.kind).emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.98rem] font-black text-ink">{u.event.title}</span>
                      <span className="block text-[0.78rem] font-bold text-ink/50">
                        {dayTitle(u.date)} · {ddayLabel(u.days)}
                      </span>
                      {isLunarEvent(u.event) ? (
                        <span className="block truncate text-[0.76rem] font-extrabold text-plum-dark">
                          🌙 {lunarBadgeText(u.event, u.date)}
                        </span>
                      ) : null}
                    </span>
                    <IconChevron size={18} className="shrink-0 text-ink/30" />
                  </button>
                ))}
              </div>
            ) : null}

            {/* 월간 달력 */}
            <section className="rounded-[1.6rem] bg-white p-3 shadow-card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => goMonth(-1)}
                  aria-label="이전 달"
                  className="grid h-11 w-11 place-items-center rounded-full bg-paper text-ink/70 active:bg-ink/10"
                >
                  <span className="text-[1.2rem]">‹</span>
                </button>
                <button onClick={goToday} className="px-2 text-center" aria-label="이번 달로">
                  <span className="block text-[1.12rem] font-black leading-tight text-ink">{monthTitle(ym)}</span>
                  <span className="block text-[0.7rem] font-bold text-brand-dark">오늘로 가기</span>
                </button>
                <button
                  onClick={() => goMonth(1)}
                  aria-label="다음 달"
                  className="grid h-11 w-11 place-items-center rounded-full bg-paper text-ink/70 active:bg-ink/10"
                >
                  <span className="text-[1.2rem]">›</span>
                </button>
              </div>

              <div className="mb-2 flex items-center justify-center">
                <span
                  data-today-lunar
                  className="inline-flex items-center gap-1 rounded-full bg-plum-light px-3 py-1 text-[0.88rem] font-extrabold text-plum-dark"
                >
                  🌙 오늘 {dayTitle(today)} · {lunarShortOf(today) || "음력 정보 없음"}
                </span>
              </div>

              <div className="mb-1 grid grid-cols-7">
                {DOW.map((d, i) => (
                  <div
                    key={d}
                    className={`text-center text-[0.72rem] font-extrabold ${
                      i === 0 ? "text-coral-dark" : i === 6 ? "text-brand-dark" : "text-ink/45"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {grid.flat().map((cell) => {
                  const day = Number(cell.date.slice(8, 10));
                  const dow = weekdayOf(cell.date);
                  const isToday = cell.date === today;
                  const isSelected = cell.date === selected;
                  const hasFamily = familyDotByDate.has(cell.date);
                  const hasNews = newsDotByDate.has(cell.date);
                  return (
                    <button
                      key={cell.date}
                      onClick={() => pickDay(cell.date, cell.inMonth)}
                      aria-pressed={isSelected}
                      aria-label={`${cell.date}${hasFamily ? " 가족일정" : ""}${hasNews ? " 동네소식" : ""}`}
                      className={`relative flex h-[52px] flex-col items-center justify-center rounded-[0.95rem] transition ${
                        isSelected
                          ? "bg-ink text-white shadow-cta"
                          : cell.inMonth
                            ? "text-ink active:bg-ink/6"
                            : "text-ink/25"
                      } ${isToday && !isSelected ? "ring-2 ring-gold" : ""}`}
                    >
                      <span
                        className={`text-[1.02rem] font-black leading-none ${
                          !cell.inMonth ? "" : dow === 0 && !isSelected ? "text-coral-dark" : dow === 6 && !isSelected ? "text-brand-dark" : ""
                        }`}
                      >
                        {day}
                      </span>
                      <span className="mt-1 flex h-1.5 items-center gap-[3px]">
                        {hasFamily ? (
                          <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-coral-light" : "bg-coral"}`} />
                        ) : null}
                        {hasNews ? (
                          <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand"}`} />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-center gap-4 text-[0.74rem] font-bold text-ink/55">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-coral" /> 가족 일정
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-brand" /> 우리동네 소식
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full ring-2 ring-gold" /> 오늘
                </span>
              </div>
            </section>

            <BigButton
              variant="coral"
              full
              onClick={() => setForm({ open: true, editing: null, date: selected })}
            >
              <IconPlus size={22} /> {dayTitle(selected)}에 일정 추가
            </BigButton>

            {/* 고른 날짜 */}
            <section className="rounded-[1.6rem] bg-white p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-[1.08rem] font-black text-ink">{dayTitle(selected)}</h2>
                  {lunarShortOf(selected) && selected !== today ? (
                    <p className="text-[0.8rem] font-extrabold text-plum-dark">🌙 {lunarShortOf(selected)}</p>
                  ) : null}
                </div>
                {selected === today ? <Badge tone="gold">오늘 · {lunarShortOf(today)}</Badge> : null}
              </div>

              {dayEvents.length === 0 && dayNews.length === 0 ? (
                <p className="py-3 text-center text-[0.92rem] font-semibold text-ink/45">
                  이 날은 일정이 없어요. 아래 <b className="text-ink/70">일정 추가</b>를 눌러 보세요.
                </p>
              ) : null}

              <div className="space-y-2">
                {dayEvents.map((ev) => {
                  const info = kindInfo(ev.kind);
                  const nextDate = nextOccurrence(ev, today);
                  const days = daysBetween(today, nextDate ?? ev.date);
                  return (
                    <div key={ev.id} className="rounded-2xl border-2 border-coral/25 bg-coral-light/40 p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[1.3rem] leading-none">{info.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[1rem] font-black leading-snug text-ink">{ev.title}</p>
                          <p className="mt-0.5 text-[0.8rem] font-bold text-ink/55">
                            <span className={`rounded-full px-2 py-0.5 ${info.chip}`}>{info.label}</span>
                            {ev.repeatYearly ? <span className="ml-1.5">매년 반복</span> : null}
                          </p>
                          {isLunarEvent(ev) ? (
                            <p className="mt-1">
                              <LunarBadge event={ev} occurrence={selected} />
                            </p>
                          ) : null}
                          {ev.memo ? (
                            <p className="mt-1 text-[0.86rem] font-semibold leading-snug text-ink/70">{ev.memo}</p>
                          ) : null}
                          <p
                            data-event-alarm={alarmModeOf(ev)}
                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.76rem] font-extrabold ${
                              alarmModeOf(ev) === "none"
                                ? "bg-ink/6 text-ink/45"
                                : "bg-gold-light text-[#7A5600]"
                            }`}
                          >
                            {alarmModeOf(ev) === "none" ? "🔕 알람 없음" : `🔔 ${alarmLabel(ev)}`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[0.74rem] font-black text-coral-dark shadow-soft">
                          {ddayLabel(days)}
                        </span>
                      </div>

                      {confirmId === ev.id ? (
                        <div className="mt-2 rounded-xl bg-white p-2">
                          <p className="text-center text-[0.88rem] font-black text-ink">이 일정을 지울까요?</p>
                          <div className="mt-1.5 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                removeFamilyEvent(ev.id);
                                setConfirmId(null);
                                show("일정을 지웠어요.");
                              }}
                              className="min-h-[46px] rounded-xl bg-coral text-[0.9rem] font-extrabold text-white"
                            >
                              지우기
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="min-h-[46px] rounded-xl border-2 border-ink/10 bg-white text-[0.9rem] font-extrabold text-ink"
                            >
                              그대로 두기
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => setForm({ open: true, editing: ev, date: ev.date })}
                              className="min-h-[44px] flex-1 rounded-xl border-2 border-ink/10 bg-white text-[0.86rem] font-extrabold text-ink"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => setConfirmId(ev.id)}
                              className="min-h-[44px] flex-1 rounded-xl border-2 border-ink/10 bg-white text-[0.86rem] font-extrabold text-ink/60"
                            >
                              삭제
                            </button>
                            <button
                              onClick={() => void shareEvent(ev, ev.date)}
                              className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-gold text-[0.86rem] font-extrabold text-ink"
                            >
                              <IconChat size={16} /> 카톡
                            </button>
                          </div>
                          {/* 앱을 닫아 두어도 울리게 — 휴대폰 기본 캘린더에 알람까지 넣는다 */}
                          {alarmModeOf(ev) !== "none" ? (
                            <div className="mt-2">
                              <IcsButton item={{ event: ev, occurrence: selected }} className="w-full !bg-white" />
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}

                {dayNews.map((n) => {
                  const info = newsCategoryInfo(n.category);
                  return (
                    <div key={n.id} className="rounded-2xl border-2 border-brand/20 bg-brand-light/40 p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-[1.3rem] leading-none">{info.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[1rem] font-black leading-snug text-ink">{n.title}</p>
                          <p className="mt-0.5 text-[0.8rem] font-bold text-ink/55">
                            <span className={`rounded-full px-2 py-0.5 ${info.chip}`}>{info.label}</span>
                            <span className="ml-1.5">{newsPeriod(n)}</span>
                          </p>
                          <p className="mt-1 flex items-start gap-1 text-[0.84rem] font-semibold leading-snug text-ink/70">
                            <IconPin size={14} className="mt-0.5 shrink-0 text-brand-dark" />
                            {n.place}
                          </p>
                          <p className="mt-1 text-[0.86rem] font-semibold leading-snug text-ink/75">{n.summary}</p>
                          <p className="mt-1 text-[0.8rem] font-semibold leading-snug text-ink/55">
                            신청·문의: {n.how}
                            {n.contact ? ` (${n.contact})` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <button
                          onClick={() => void shareNews(n)}
                          className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl bg-gold text-[0.88rem] font-extrabold text-ink"
                        >
                          <IconChat size={16} /> 카톡으로 알리기
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 다가오는 일정 · 소식 */}
            <section>
              <div className="mb-2 flex items-end justify-between gap-2">
                <h2 className="text-[1.12rem] font-black text-ink">다가오는 일정과 소식</h2>
                <span className="truncate text-[0.74rem] font-bold text-ink/40">
                  {area} · {rows.length}건
                </span>
              </div>

              {/* 갈래는 옆으로 잘리지 않고 한눈에 다 보이도록 3열 큰 버튼으로 */}
              <div
                className="mb-2.5 grid grid-cols-3 gap-2"
                role="tablist"
                aria-label="소식 갈래"
                data-calendar-filters
              >
                {FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(f.key)}
                      className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 text-[0.94rem] font-extrabold transition ${
                        active
                          ? "border-ink bg-ink text-white shadow-soft"
                          : "border-ink/8 bg-white text-ink/65 shadow-soft active:bg-paper"
                      }`}
                    >
                      <span aria-hidden className="text-[1.15rem] leading-none">
                        {f.emoji}
                      </span>
                      <span className="leading-tight">{f.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                {rows.length === 0 ? (
                  <p className="rounded-2xl bg-white p-4 text-center text-[0.9rem] font-semibold text-ink/45">
                    {filter === "all" ? (
                      <>
                        아직 일정이 없어요. <b className="text-ink/70">+ 일정 추가</b>로 생일을 넣어 두세요.
                      </>
                    ) : filter === "family" ? (
                      <>
                        넣어 둔 가족 일정이 없어요. <b className="text-ink/70">+ 일정 추가</b>로 생일을 넣어 보세요.
                      </>
                    ) : (
                      <>{area}에서 앞으로 넉 달 안에 잡힌 {FILTERS.find((f) => f.key === filter)?.label} 소식은 아직 없어요. 다른 갈래를 눌러 보세요.</>
                    )}
                  </p>
                ) : null}

                {rows.slice(0, 40).map((r) => {
                  if (r.type === "family") {
                    const info = kindInfo(r.event.kind);
                    return (
                      <button
                        key={r.key}
                        onClick={() => {
                          setYm(monthOf(r.date));
                          setSelected(r.date);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-soft active:bg-paper"
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-coral-light text-[1.2rem]">
                          {info.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.98rem] font-black text-ink">{r.event.title}</span>
                          <span className="block truncate text-[0.78rem] font-bold text-ink/50">
                            {dayTitle(r.date)} · {info.label}
                            {r.event.repeatYearly ? " · 매년" : ""}
                          </span>
                          {isLunarEvent(r.event) ? (
                            <span className="mt-0.5 block truncate text-[0.78rem] font-extrabold text-plum-dark">
                              🌙 {lunarBadgeText(r.event, r.date)}
                            </span>
                          ) : null}
                          {alarmModeOf(r.event) !== "none" ? (
                            <span className="mt-0.5 block truncate text-[0.74rem] font-extrabold text-gold-dark">
                              🔔 {alarmLabel(r.event)}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 rounded-full bg-coral-light px-2.5 py-1 text-[0.74rem] font-black text-coral-dark">
                          {ddayLabel(r.days)}
                        </span>
                      </button>
                    );
                  }
                  const info = newsCategoryInfo(r.news.category);
                  return (
                    <button
                      key={r.key}
                      onClick={() => {
                        setYm(monthOf(r.date));
                        setSelected(r.date);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-soft active:bg-paper"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-brand-light text-[1.2rem]">
                        {info.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.98rem] font-black text-ink">{r.news.title}</span>
                        <span className="block truncate text-[0.78rem] font-bold text-ink/50">
                          {newsPeriod(r.news)} · {info.label}
                        </span>
                        <span className="block truncate text-[0.74rem] font-semibold text-ink/45">{r.news.place}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-center text-[0.78rem] font-semibold leading-relaxed text-ink/45">
                {area} 소식은 지역 공고를 요약해 정리한 안내예요. 축제·행사 날짜와 접수 기간은 해마다 달라질 수
                있으니 방문·신청 전에 꼭 전화로 확인해 주세요.
              </p>
            </section>

            {/* 우리 지역 바로가기 — 전국 어느 지역이든 늘 열리는 주소만 모았다 */}
            <section className="rounded-[1.6rem] bg-white p-4 shadow-card">
              <div className="mb-1 flex items-center gap-1.5">
                <IconPin size={17} className="text-brand" />
                <h2 className="text-[1.06rem] font-black text-ink">{area} 바로가기</h2>
              </div>
              <p className="mb-2.5 text-[0.8rem] font-semibold leading-snug text-ink/50">
                공고·축제 일정은 지역마다 달라요. 아래에서 최신 소식을 바로 확인하실 수 있어요.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {links.map((l) => (
                  <a
                    key={l.key}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[58px] items-center gap-2 rounded-2xl bg-paper px-3 py-2 active:bg-ink/10"
                  >
                    <span aria-hidden className="text-[1.15rem]">
                      {l.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.88rem] font-black text-ink">{l.label}</span>
                      <span className="block truncate text-[0.72rem] font-semibold text-ink/50">{l.note}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <EventFormSheet
        open={form.open}
        editing={form.editing}
        presetDate={form.date}
        onClose={() => setForm({ open: false, editing: null, date: selected })}
        onSaved={(date, msg, event) => {
          setYm(monthOf(date));
          setSelected(date);
          setJustSaved({ event, date });
          show(msg);
        }}
      />

      <RegionSheet
        open={regionOpen}
        onClose={() => setRegionOpen(false)}
        mySido={mySido}
        mySigungu={mySigungu}
        current={{ sido: viewSido, sigungu: viewSigungu }}
        onPick={(next) => {
          setRegion(next);
          setRegionOpen(false);
          show(next ? `${newsAreaName(next.sido, next.sigungu)} 소식을 볼게요.` : "내 지역 소식으로 돌아왔어요.");
        }}
      />
    </Portal>
  );
}

/* ------------------------------------------------------------------ */
/* 우리동네 소식 — 지역 고르기                                          */
/* ------------------------------------------------------------------ */

function RegionSheet({
  open,
  onClose,
  mySido,
  mySigungu,
  current,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  mySido: string;
  mySigungu: string;
  current: { sido: string; sigungu: string };
  onPick: (next: { sido: string; sigungu: string } | null) => void;
}) {
  const { today } = useApp();
  const [sido, setSido] = useState(current.sido || REGIONS[0].name);
  const [sigungu, setSigungu] = useState(
    current.sigungu || sigunguList(current.sido || REGIONS[0].name)[0] || ""
  );

  useEffect(() => {
    if (!open) return;
    setSido(current.sido || REGIONS[0].name);
    setSigungu(current.sigungu || sigunguList(current.sido || REGIONS[0].name)[0] || "");
  }, [open, current.sido, current.sigungu]);

  const options = sigunguList(sido);
  const pickedArea = newsAreaName(sido, sigungu);
  const count = localNewsFor(sido, sigungu, today, 4).length;
  const isMine = sido === mySido && sigungu === mySigungu;

  return (
    <Sheet open={open} onClose={onClose} title="우리동네 소식 지역" subtitle="보고 싶은 시·도와 시·군·구를 골라 주세요">
      <div className="space-y-3">
        <div>
          <label htmlFor="news-sido" className="mb-1 block text-[0.95rem] font-extrabold">
            시·도
          </label>
          <select
            id="news-sido"
            className="field"
            value={sido}
            onChange={(e) => {
              setSido(e.target.value);
              setSigungu(sigunguList(e.target.value)[0] || "");
            }}
          >
            {REGIONS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="news-sigungu" className="mb-1 block text-[0.95rem] font-extrabold">
            시·군·구
          </label>
          <select
            id="news-sigungu"
            className="field"
            value={sigungu}
            onChange={(e) => setSigungu(e.target.value)}
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <p className="rounded-2xl bg-brand-light/60 px-3.5 py-2.5 text-[0.84rem] font-semibold leading-snug text-brand-dark">
          {pickedArea}에서 앞으로 넉 달 동안 {count}건의 소식을 보여 드릴게요.
        </p>

        <BigButton variant="ink" full onClick={() => onPick({ sido, sigungu })}>
          {pickedArea} 소식 보기
        </BigButton>

        {isMine ? null : (
          <BigButton variant="white" full onClick={() => onPick(null)}>
            내 지역({newsAreaName(mySido, mySigungu)})으로 돌아가기
          </BigButton>
        )}

        <p className="text-center text-[0.76rem] font-semibold leading-relaxed text-ink/45">
          다른 지역을 봐도 내 설정 지역은 바뀌지 않아요. 내 지역을 바꾸려면 혜택 화면의 지역 버튼을 눌러 주세요.
        </p>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* 가족 탭 카드                                                        */
/* ------------------------------------------------------------------ */

export function FamilyCalendarCard({ onOpen }: { onOpen: () => void }) {
  const { profile, state, today } = useApp();
  const up = upcomingEvents(state.familyEvents, today, 120, 3);
  const news = localNewsFor(profile?.sido || "", profile?.sigungu || "", today, 2);

  return (
    <div className="fade-up rounded-[1.6rem] bg-white p-4 shadow-card">
      <div className="flex items-start gap-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-gold-light text-[1.25rem]">
          📅
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.06rem] font-black leading-tight text-ink">가족안부달력</p>
          <p className="mt-0.5 text-[0.82rem] font-semibold leading-snug text-ink/55">
            자녀 생일·기념일과 우리 동네 소식을 한 달 달력으로 봐요
          </p>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {up.length === 0 ? (
          <p className="rounded-xl bg-paper px-3 py-2 text-[0.86rem] font-semibold text-ink/55">
            아직 넣어 둔 가족 일정이 없어요. 큰딸 생일부터 넣어 보세요.
          </p>
        ) : (
          up.map((u) => (
            <div key={`${u.event.id}-${u.date}`} className="rounded-xl bg-paper px-3 py-2">
              <div className="flex items-center gap-2">
                <span aria-hidden>{kindInfo(u.event.kind).emoji}</span>
                <span className="min-w-0 flex-1 truncate text-[0.92rem] font-black text-ink">{u.event.title}</span>
                <span className="shrink-0 text-[0.78rem] font-bold text-ink/50">{dayTitle(u.date)}</span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.72rem] font-black text-coral-dark">
                  {ddayLabel(u.days)}
                </span>
              </div>
              {isLunarEvent(u.event) ? (
                <p className="mt-0.5 pl-6 text-[0.76rem] font-extrabold text-plum-dark">
                  🌙 {lunarBadgeText(u.event, u.date)}
                </p>
              ) : null}
            </div>
          ))
        )}
        <p className="flex items-center gap-1.5 px-1 text-[0.8rem] font-bold text-ink/50">
          <span className="text-[0.95rem]">🏮</span> 우리 동네 소식 {news.length}건 · 행사·축제·무료강좌·복지
        </p>
      </div>

      <button
        onClick={onOpen}
        className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl bg-ink text-[1rem] font-extrabold text-white shadow-cta active:bg-brand-deep"
      >
        달력 열기
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 홈 바로가기 배너                                                    */
/* ------------------------------------------------------------------ */

export function HomeCalendarBanner({ onOpen }: { onOpen: () => void }) {
  const { profile, state, today } = useApp();
  const up = upcomingEvents(state.familyEvents, today, 120, 1);
  const next = up[0];
  const news = localNewsFor(profile?.sido || "", profile?.sigungu || "", today, 1);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fade-up flex w-full items-center gap-3 rounded-[1.5rem] bg-gradient-to-r from-gold-light via-[#FFF4D6] to-white px-4 py-3.5 text-left shadow-soft active:bg-paper"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[1.25rem] shadow-soft">
        📅
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-black leading-tight text-ink">
          {next ? `${next.event.title} ${ddayLabel(next.days)}` : "가족안부달력"}
        </span>
        <span className="block text-[0.82rem] font-bold text-ink/55">
          {next
            ? `${dayTitle(next.date)} · ${isLunarEvent(next.event) ? `🌙 ${lunarBadgeText(next.event, next.date)} · ` : ""}우리 동네 소식 ${news.length}건`
            : "생일·기념일과 우리 동네 소식을 한눈에"}
        </span>
      </span>
      <span className="shrink-0 text-[0.78rem] font-extrabold text-brand-dark">열기 ›</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 일정 추가·수정 시트                                                 */
/* ------------------------------------------------------------------ */

function EventFormSheet({
  open,
  editing,
  presetDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: FamilyEvent | null;
  presetDate: string;
  onClose: () => void;
  onSaved: (date: string, msg: string, event: FamilyEvent) => void;
}) {
  const { addFamilyEvent, updateFamilyEvent } = useApp();
  const { show } = useToast();
  const [kind, setKind] = useState<FamilyEventKind>("birthday");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(presetDate);
  const [calendarType, setCalendarType] = useState<FamilyCalendarType>("solar");
  const [leap, setLeap] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const [memo, setMemo] = useState("");
  const [alarm, setAlarm] = useState<FamilyEventAlarm>(DEFAULT_ALARM);
  const [alarmTime, setAlarmTime] = useState(DEFAULT_ALARM_TIME);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (editing) {
      setKind(editing.kind);
      setTitle(editing.title);
      setDate(editing.date);
      setCalendarType(editing.calendarType === "lunar" ? "lunar" : "solar");
      setLeap(Boolean(editing.isLeapMonth));
      setRepeat(editing.repeatYearly);
      setMemo(editing.memo ?? "");
      setAlarm(alarmModeOf(editing));
      setAlarmTime(alarmTimeOf(editing));
    } else {
      setKind("birthday");
      setTitle("");
      setDate(presetDate);
      setCalendarType("solar");
      setLeap(false);
      setRepeat(true);
      setMemo("");
      setAlarm(DEFAULT_ALARM);
      setAlarmTime(DEFAULT_ALARM_TIME);
    }
  }, [open, editing, presetDate]);

  const save = () => {
    setTouched(true);
    if (!title.trim() || !date) {
      show("이름과 날짜를 넣어 주세요.");
      return;
    }
    const lunar = calendarType === "lunar";
    // 화면에 보여 줄 실제 양력 날짜 (음력이면 그 해의 양력 날짜로 바꾼다)
    const occurrence = lunar ? lunarSolarDate(dateParts.year, dateParts.month, dateParts.day, leapOn) : date;
    if (!occurrence) {
      show("이 음력 날짜를 양력으로 바꾸지 못했어요. 날짜를 다시 골라 주세요.");
      return;
    }
    const alarmFields = { alarm: normalizeAlarm(alarm), alarmTime: normalizeAlarmTime(alarmTime) };
    const typeFields = { calendarType, isLeapMonth: lunar ? leapOn : undefined };
    const base = editing ? "일정을 고쳤어요." : "일정을 저장했어요.";
    const msg =
      (lunar ? `${base} 음력 날짜라 달력에는 양력 ${dayTitle(occurrence)}으로 보여 드려요.` : base) +
      (alarmFields.alarm === "none" ? "" : " 알람도 함께 맞춰 두었어요.");
    if (editing) {
      updateFamilyEvent(editing.id, { title, date, repeatYearly: repeat, kind, memo, ...alarmFields, ...typeFields });
      onSaved(occurrence, msg, {
        ...editing,
        title: title.trim(),
        date,
        repeatYearly: repeat,
        kind,
        memo,
        ...alarmFields,
        ...typeFields,
      });
    } else {
      const ev = addFamilyEvent({ title, date, repeatYearly: repeat, kind, memo, ...alarmFields, ...typeFields });
      if (!ev) {
        show("일정을 저장하지 못했어요. 날짜를 확인해 주세요.");
        return;
      }
      onSaved(occurrence, msg, ev);
    }
    onClose();
  };

  const today = kstDate();
  const dateParts = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return { year: y || 2026, month: m || 1, day: d || 1 };
  }, [date]);

  /** 이 해 이 달에 윤달이 있는지 — 없으면 평달로 안전하게 넣는다 */
  const leapAvailable = calendarType === "lunar" && hasLeapMonth(dateParts.year, dateParts.month);
  const leapOn = calendarType === "lunar" && leap && leapAvailable;
  const lastDayOfSelection =
    calendarType === "lunar"
      ? lunarMonthDays(dateParts.year, dateParts.month, leapOn)
      : daysInMonth(dateParts.year, dateParts.month);

  /** 고른 음력 날짜가 실제로 어떤 양력 날짜인지 (이번 해·다음 해) */
  const lunarPreview = useMemo(() => {
    if (calendarType !== "lunar") return null;
    return {
      solar: lunarToSolar(dateParts.year, dateParts.month, dateParts.day, leapOn),
      nextSolar: lunarToSolar(dateParts.year + 1, dateParts.month, dateParts.day, leapOn),
    };
  }, [calendarType, dateParts.year, dateParts.month, dateParts.day, leapOn]);

  const setDateParts = (year: number, month: number, day: number) => {
    if (calendarType === "lunar") {
      const last = lunarMonthDays(year, month, leap && hasLeapMonth(year, month));
      setDate(dateKey(year, month, Math.min(day, last)));
      return;
    }
    setDate(dateKey(year, month, Math.min(day, daysInMonth(year, month))));
  };

  /** 화면에 날짜로보여 줄 실제 양력 날짜 — 음력이면 바꾼 날짜 */
  const occurrenceDate = calendarType === "lunar" ? lunarPreview?.solar ?? date : date;

  /** ☀️ 양력 ↔ 🌙 음력 — 고른 날짜를 그대로 상대 달력 날짜로 바꿔 준다 */
  const switchType = (next: FamilyCalendarType) => {
    if (next === calendarType) return;
    if (next === "lunar") {
      const l = solarToLunar(date);
      if (l) {
        setDate(dateKey(l.year, l.month, l.day));
        setLeap(l.leap);
      }
    } else {
      const solar = lunarToSolar(dateParts.year, dateParts.month, dateParts.day, leapOn);
      if (solar) setDate(solar);
      setLeap(false);
    }
    setCalendarType(next);
  };

  /** ‘오늘·내일’ 같은 양력 날짜를 지금 고른 달력에 맞춰 넣는다 */
  const applySolarDate = (solar: string) => {
    if (calendarType === "lunar") {
      const l = solarToLunar(solar);
      if (l) {
        setDate(dateKey(l.year, l.month, l.day));
        setLeap(l.leap);
        return;
      }
    }
    setDate(solar);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "일정 고치기" : "가족 일정 추가"}
      subtitle="생일·기념일은 매년 반복으로 두면 해마다 자동으로 나와요 · 음력 생일은 🌙 음력으로"
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[0.95rem] font-extrabold text-ink">① 어떤 날인가요?</p>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_KINDS.map((k) => {
              const active = kind === k.key;
              return (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  aria-pressed={active}
                  data-event-kind={k.key}
                  className={`flex min-h-[58px] items-center justify-center gap-1.5 rounded-2xl border-2 text-[0.95rem] font-extrabold transition ${
                    active ? "border-coral bg-coral-light text-ink" : "border-ink/10 bg-white text-ink/65"
                  }`}
                >
                  <span className="text-[1.15rem]" aria-hidden>
                    {k.emoji}
                  </span>
                  {k.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="ev-title" className="mb-1.5 block text-[0.95rem] font-extrabold text-ink">
            ② 누구·무슨 일인가요?
          </label>
          <input
            id="ev-title"
            className="field"
            placeholder="예: 큰딸 생일, 손주 돌잔치"
            maxLength={30}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {touched && !title.trim() ? (
            <p className="mt-1 text-[0.8rem] font-bold text-coral-dark">이름을 넣어 주세요.</p>
          ) : null}
        </div>

        <div data-date-box>
          <p className="mb-1.5 text-[0.95rem] font-extrabold text-ink">③ 언제인가요?</p>

          {/* ☀️ 양력 / 🌙 음력 — 큰 버튼 두 개 */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="달력 종류">
            <button
              type="button"
              data-calendar-type="solar"
              aria-pressed={calendarType === "solar"}
              onClick={() => switchType("solar")}
              className={`flex min-h-[62px] flex-col items-center justify-center rounded-2xl border-2 text-[1.02rem] font-black transition ${
                calendarType === "solar"
                  ? "border-gold bg-gold-light text-[#7A5600] shadow-soft"
                  : "border-ink/10 bg-white text-ink/60"
              }`}
            >
              <span className="text-[1.2rem] leading-none" aria-hidden>
                ☀️
              </span>
              <span className="mt-0.5 leading-tight">양력</span>
            </button>
            <button
              type="button"
              data-calendar-type="lunar"
              aria-pressed={calendarType === "lunar"}
              onClick={() => switchType("lunar")}
              className={`flex min-h-[62px] flex-col items-center justify-center rounded-2xl border-2 text-[1.02rem] font-black transition ${
                calendarType === "lunar"
                  ? "border-plum bg-plum-light text-plum-dark shadow-soft"
                  : "border-ink/10 bg-white text-ink/60"
              }`}
            >
              <span className="text-[1.2rem] leading-none" aria-hidden>
                🌙
              </span>
              <span className="mt-0.5 leading-tight">음력</span>
            </button>
          </div>

          {/* 음력일 때만 — 윤달 고르기 */}
          {calendarType === "lunar" ? (
            <button
              type="button"
              data-lunar-leap={leapAvailable ? "available" : "none"}
              aria-pressed={leapOn}
              onClick={() => setLeap((v) => !v)}
              className={`mt-2 flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border-2 px-3 text-left ${
                leapOn ? "border-plum bg-plum-light" : "border-ink/10 bg-white"
              }`}
            >
              <span
                className={`grid h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${
                  leapOn ? "bg-plum" : "bg-ink/20"
                }`}
                aria-hidden
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white transition ${leapOn ? "translate-x-4" : "translate-x-0"}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.92rem] font-black text-ink">{dateParts.month}월 윤달</span>
                <span className="block text-[0.76rem] font-semibold leading-snug text-ink/50">
                  {leapAvailable
                    ? `${dateParts.year}년에는 윤${dateParts.month}월이 있어요`
                    : `${dateParts.year}년에는 윤${dateParts.month}월이 없어요 (평달로 넣어요)`}
                </span>
              </span>
            </button>
          ) : null}

          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-center text-[0.74rem] font-bold text-ink/50">
                {calendarType === "lunar" ? "음력 해" : "해"}
              </span>
              <select
                aria-label="연도"
                className="field !min-h-[54px] px-2 text-center text-[1rem] font-extrabold"
                value={dateParts.year}
                onChange={(e) => setDateParts(Number(e.target.value), dateParts.month, dateParts.day)}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-center text-[0.74rem] font-bold text-ink/50">달</span>
              <select
                aria-label="월"
                className="field !min-h-[54px] px-2 text-center text-[1rem] font-extrabold"
                value={dateParts.month}
                onChange={(e) => setDateParts(dateParts.year, Number(e.target.value), dateParts.day)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-center text-[0.74rem] font-bold text-ink/50">날</span>
              <select
                aria-label="일"
                className="field !min-h-[54px] px-2 text-center text-[1rem] font-extrabold"
                value={dateParts.day}
                onChange={(e) => setDateParts(dateParts.year, dateParts.month, Number(e.target.value))}
              >
                {Array.from({ length: lastDayOfSelection }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}일
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 🌙 고른 음력 날짜가 실제 양력 언제인지 바로 보여 준다 */}
          {calendarType === "lunar" ? (
            <div data-lunar-preview className="mt-2 rounded-2xl border-2 border-plum/25 bg-plum-light/50 px-3.5 py-2.5">
              {lunarPreview?.solar ? (
                <>
                  <p className="text-[1rem] font-black leading-snug text-plum-dark" data-lunar-preview-main>
                    🌙 {lunarText({ month: dateParts.month, day: dateParts.day, leap: leapOn })} →{" "}
                    {Number(lunarPreview.solar.slice(0, 4)) === Number(today.slice(0, 4))
                      ? "올해는"
                      : `${Number(lunarPreview.solar.slice(0, 4))}년에는`}{" "}
                    양력 {Number(lunarPreview.solar.slice(5, 7))}월 {Number(lunarPreview.solar.slice(8, 10))}일 (
                    {weekdayShort(lunarPreview.solar)})이에요
                  </p>
                  {repeat && lunarPreview.nextSolar ? (
                    <p className="mt-1 text-[0.86rem] font-extrabold leading-snug text-plum-dark/85" data-lunar-preview-next>
                      다음 해(음력 {dateParts.year + 1}년)는 양력 {Number(lunarPreview.nextSolar.slice(5, 7))}월{" "}
                      {Number(lunarPreview.nextSolar.slice(8, 10))}일 ({weekdayShort(lunarPreview.nextSolar)})이에요
                    </p>
                  ) : null}
                  {repeat && lunarPreview.solar < today ? (
                    <p className="mt-1 text-[0.82rem] font-bold leading-snug text-plum-dark/80">
                      올해 음력 날짜는 이미 지났어요. 다음 해 날짜로 알려 드릴게요.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-[0.92rem] font-bold leading-snug text-plum-dark">
                  이 해의 음력 날짜를 찾지 못했어요. 해를 1900~2049년 사이로 골라 주세요.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1.5 flex items-center justify-center gap-1 text-[0.88rem] font-extrabold text-brand-dark">
              <IconCalendar size={15} /> {dayTitle(date)}
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              onClick={() => applySolarDate(today)}
              className="min-h-[42px] flex-1 rounded-xl border-2 border-ink/10 bg-white text-[0.84rem] font-extrabold text-ink/70"
            >
              오늘
            </button>
            <button
              onClick={() => {
                const d = new Date(today + "T00:00:00Z");
                d.setUTCDate(d.getUTCDate() + 1);
                applySolarDate(d.toISOString().slice(0, 10));
              }}
              className="min-h-[42px] flex-1 rounded-xl border-2 border-ink/10 bg-white text-[0.84rem] font-extrabold text-ink/70"
            >
              내일
            </button>
          </div>
        </div>

        <button
          onClick={() => setRepeat((v) => !v)}
          aria-pressed={repeat}
          className={`flex min-h-[62px] w-full items-center gap-3 rounded-2xl border-2 px-3.5 text-left ${
            repeat ? "border-leaf bg-leaf-light" : "border-ink/10 bg-white"
          }`}
        >
          <span
            className={`grid h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
              repeat ? "bg-leaf" : "bg-ink/20"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-white transition ${repeat ? "translate-x-5" : "translate-x-0"}`}
            />
          </span>
          <span className="flex-1">
            <span className="block text-[0.98rem] font-black text-ink">매년 반복</span>
            <span className="block text-[0.78rem] font-semibold text-ink/50">
              생일·기념일은 켜 두세요 (해마다 같은 날 보여요)
            </span>
            {calendarType === "lunar" && repeat ? (
              <span className="block text-[0.78rem] font-extrabold text-plum-dark">
                🌙 음력 {dateParts.month}월 {dateParts.day}일로 해마다 반복해요
              </span>
            ) : null}
          </span>
        </button>

        <div>
          <label htmlFor="ev-memo" className="mb-1.5 block text-[0.95rem] font-extrabold text-ink">
            메모 · 대상 (안 써도 돼요)
          </label>
          <input
            id="ev-memo"
            className="field"
            placeholder="예: 큰딸, 손주, 성당 근처 병원"
            maxLength={40}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {/* ④ 알람 — 언제 미리 알려 줄지 */}
        <div data-alarm-box>
          <p className="mb-1.5 text-[0.95rem] font-extrabold text-ink">④ 미리 알람 받을까요?</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="알람 시점">
            {ALARM_MODES.map((m) => {
              const active = alarm === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  data-alarm-mode={m.key}
                  aria-pressed={active}
                  onClick={() => setAlarm(m.key)}
                  className={`flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl border-2 text-[0.95rem] font-extrabold transition ${
                    active ? "border-gold bg-gold-light text-[#7A5600]" : "border-ink/10 bg-white text-ink/65"
                  }`}
                >
                  {m.key === "none" ? "🔕" : "🔔"} {m.label}
                </button>
              );
            })}
          </div>

          {alarm === "none" ? (
            <p className="mt-1.5 text-[0.82rem] font-semibold leading-snug text-ink/50">
              이 일정은 알람 없이 달력에만 남겨 둘게요.
            </p>
          ) : (
            <>
              <p className="mb-1.5 mt-2.5 text-[0.9rem] font-extrabold text-ink/75">몇 시에 알려 드릴까요?</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="알람 시각" data-alarm-time-group>
                {ALARM_TIMES.map((t) => {
                  const active = alarmTime === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      data-alarm-time={t.value}
                      aria-pressed={active}
                      onClick={() => setAlarmTime(t.value)}
                      className={`flex min-h-[54px] items-center justify-center gap-1 rounded-2xl border-2 text-[0.92rem] font-extrabold transition ${
                        active ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-ink/65"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-2xl bg-gold-light/70 px-3.5 py-2.5">
                <p className="text-[0.86rem] font-extrabold leading-snug text-[#7A5600]" data-alarm-summary>
                  🔔 {alarm === "0"
                    ? `${dayTitle(occurrenceDate)} ${alarmTimeLabel(alarmTime)}에 알려 드려요`
                    : `${ALARM_MODES.find((m) => m.key === alarm)?.label ?? ""} ${alarmTimeLabel(alarmTime)}에 미리 알려 드려요`}
                </p>
                <p className="mt-1 text-[0.8rem] font-semibold leading-snug text-[#7A5600]/85">
                  앱을 열었을 때 화면으로 알려 드려요. 앱을 닫아 둬도 울리게 하려면 저장 뒤 ‘📅 휴대폰 알람(.ics)에 넣기’를 눌러 주세요.
                </p>
              </div>
              <div className="mt-2">
                <AlarmPermissionButton full />
              </div>
            </>
          )}
        </div>

        <Divider />

        <div className="grid grid-cols-1 gap-2">
          <BigButton variant="coral" size="lg" onClick={save}>
            {editing ? "고친 내용 저장" : "일정 저장하기"}
          </BigButton>
          <BigButton variant="white" onClick={onClose}>
            그만두기
          </BigButton>
        </div>
        <p className="flex items-center justify-center gap-1.5 pb-1 text-center text-[0.76rem] font-medium text-ink/40">
          <IconClock size={14} /> 저장한 일정은 이 기기와 가족 확인 화면에 함께 보여요
        </p>
      </div>
    </Sheet>
  );
}
