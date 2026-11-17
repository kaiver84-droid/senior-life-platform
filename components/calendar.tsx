"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/storage";
import { shareMessageText, shareText } from "@/lib/share";
import { REGIONS, shortSido, sigunguList } from "@/lib/regions";
import { regionLinks } from "@/lib/region-links";
import { kstDate } from "@/lib/week";
import {
  EVENT_KINDS,
  dateKey,
  dayTitle,
  daysBetween,
  ddayLabel,
  eventsInMonth,
  eventsOnDate,
  kindInfo,
  monthMatrix,
  monthOf,
  monthTitle,
  nextOccurrence,
  shiftMonth,
  upcomingEvents,
  weekdayOf,
  type FamilyEvent,
  type FamilyEventKind,
  type YearMonth,
} from "@/lib/calendar";
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
      }${ev.repeatYearly ? "\n· 매년 반복하는 날이에요" : ""}${ev.memo ? `\n· ${ev.memo}` : ""}`,
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
                <h2 className="text-[1.08rem] font-black text-ink">{dayTitle(selected)}</h2>
                {selected === today ? <Badge tone="gold">오늘</Badge> : null}
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
                          {ev.memo ? (
                            <p className="mt-1 text-[0.86rem] font-semibold leading-snug text-ink/70">{ev.memo}</p>
                          ) : null}
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
                          <span className="block text-[0.78rem] font-bold text-ink/50">
                            {dayTitle(r.date)} · {info.label}
                            {r.event.repeatYearly ? " · 매년" : ""}
                          </span>
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
        onSaved={(date, msg) => {
          setYm(monthOf(date));
          setSelected(date);
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
            <div key={`${u.event.id}-${u.date}`} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
              <span aria-hidden>{kindInfo(u.event.kind).emoji}</span>
              <span className="min-w-0 flex-1 truncate text-[0.92rem] font-black text-ink">{u.event.title}</span>
              <span className="shrink-0 text-[0.78rem] font-bold text-ink/50">{dayTitle(u.date)}</span>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.72rem] font-black text-coral-dark">
                {ddayLabel(u.days)}
              </span>
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
        <span className="block truncate text-[0.82rem] font-bold text-ink/55">
          {next ? `${dayTitle(next.date)} · 우리 동네 소식 ${news.length}건` : "생일·기념일과 우리 동네 소식을 한눈에"}
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
  onSaved: (date: string, msg: string) => void;
}) {
  const { addFamilyEvent, updateFamilyEvent } = useApp();
  const { show } = useToast();
  const [kind, setKind] = useState<FamilyEventKind>("birthday");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(presetDate);
  const [repeat, setRepeat] = useState(true);
  const [memo, setMemo] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (editing) {
      setKind(editing.kind);
      setTitle(editing.title);
      setDate(editing.date);
      setRepeat(editing.repeatYearly);
      setMemo(editing.memo ?? "");
    } else {
      setKind("birthday");
      setTitle("");
      setDate(presetDate);
      setRepeat(true);
      setMemo("");
    }
  }, [open, editing, presetDate]);

  const save = () => {
    setTouched(true);
    if (!title.trim() || !date) {
      show("이름과 날짜를 넣어 주세요.");
      return;
    }
    if (editing) {
      updateFamilyEvent(editing.id, { title, date, repeatYearly: repeat, kind, memo });
      onSaved(date, "일정을 고쳤어요.");
    } else {
      const ev = addFamilyEvent({ title, date, repeatYearly: repeat, kind, memo });
      if (!ev) {
        show("일정을 저장하지 못했어요. 날짜를 확인해 주세요.");
        return;
      }
      onSaved(date, "일정을 저장했어요.");
    }
    onClose();
  };

  const today = kstDate();
  const dateParts = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return { year: y || 2026, month: m || 1, day: d || 1 };
  }, [date]);

  const setDateParts = (year: number, month: number, day: number) => {
    setDate(dateKey(year, month, Math.min(day, daysInMonth(year, month))));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "일정 고치기" : "가족 일정 추가"}
      subtitle="생일·기념일은 매년 반복으로 두면 해마다 자동으로 나와요"
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

        <div>
          <p className="mb-1.5 text-[0.95rem] font-extrabold text-ink">③ 언제인가요?</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-center text-[0.74rem] font-bold text-ink/50">해</span>
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
                {Array.from({ length: daysInMonth(dateParts.year, dateParts.month) }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}일
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[0.88rem] font-extrabold text-brand-dark">
            <IconCalendar size={15} /> {dayTitle(date)}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setDate(today)}
              className="min-h-[42px] flex-1 rounded-xl border-2 border-ink/10 bg-white text-[0.84rem] font-extrabold text-ink/70"
            >
              오늘
            </button>
            <button
              onClick={() => {
                const d = new Date(today + "T00:00:00Z");
                d.setUTCDate(d.getUTCDate() + 1);
                setDate(d.toISOString().slice(0, 10));
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
