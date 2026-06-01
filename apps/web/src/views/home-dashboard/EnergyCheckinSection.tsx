import { t } from "@lingui/core/macro";
import { useEffect, useMemo, useState } from "react";
import { HiSparkles } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { api } from "~/utils/api";

const ENERGY_LEVELS = [
  { level: 1, emoji: "😫", label: "Drained" },
  { level: 2, emoji: "😔", label: "Low" },
  { level: 3, emoji: "😐", label: "Neutral" },
  { level: 4, emoji: "😊", label: "Good" },
  { level: 5, emoji: "⚡", label: "Energized" },
];

export default function EnergyCheckinSection() {
  const utils = api.useUtils();
  const { data, isLoading } = api.productivity.getEnergyCheckin.useQuery();
  const setCheckin = api.productivity.setEnergyCheckin.useMutation();

  const [note, setNote] = useState(data?.today?.note ?? "");
  const [selectedLevel, setSelectedLevel] = useState<number | null>(
    data?.today?.energyLevel ?? null,
  );

  // Re-sync local state from server data after mutations/refetches
  useEffect(() => {
    if (data?.today) {
      setSelectedLevel(data.today.energyLevel);
      setNote(data.today.note ?? "");
    }
  }, [data?.today]);

  const currentLevel = data?.today?.energyLevel ?? selectedLevel;
  const streak = data?.streak ?? 0;

  // Last 7 days for weekly overview
  const last7Days = useMemo(() => {
    const days: { date: string; label: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  const checkinByDate = useMemo(() => {
    const map = new Map<string, { energyLevel: number }>();
    for (const c of data?.recentCheckins ?? []) {
      map.set(c.date, c);
    }
    return map;
  }, [data?.recentCheckins]);

  const handleSelect = (level: number) => {
    setSelectedLevel(level);
    setCheckin.mutate(
      { energyLevel: level, note: note || undefined },
      {
        onSuccess: () => {
          utils.productivity.getEnergyCheckin.invalidate();
        },
      },
    );
  };

  const handleNoteBlur = () => {
    if (currentLevel && note !== (data?.today?.note ?? "")) {
      setCheckin.mutate(
        { energyLevel: currentLevel, note: note || undefined },
        {
          onSuccess: () => {
            utils.productivity.getEnergyCheckin.invalidate();
          },
        },
      );
    }
  };

  return (
    <section className="rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-50">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiSparkles className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-light-900 dark:text-dark-900">
            {t`Energy Check-In`}
          </h2>
        </div>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            🔥 {streak} {streak === 1 ? "day" : "days"}
          </span>
        )}
      </div>

      {/* Weekly overview row */}
      <div className="mb-3 flex justify-between gap-1">
        {last7Days.map(({ date, label, isToday }) => {
          const checkin = checkinByDate.get(date);
          const emoji = checkin
            ? ENERGY_LEVELS.find((e) => e.level === checkin.energyLevel)?.emoji
            : null;
          return (
            <div
              key={date}
              className={twMerge(
                "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-center",
                isToday && "ring-2 ring-amber-400 dark:ring-amber-500",
                checkin
                  ? "bg-light-100 dark:bg-dark-200"
                  : "bg-light-100/50 dark:bg-dark-200/50",
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-light-900 dark:text-dark-900">
                {label}
              </span>
              <span className="text-sm leading-none">
                {emoji ?? (
                  <span className="text-light-400 dark:text-dark-400">-</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-12 animate-pulse rounded-lg bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-center gap-2">
            {ENERGY_LEVELS.map(({ level, emoji, label }) => (
              <button
                key={level}
                onClick={() => handleSelect(level)}
                title={label}
                className={twMerge(
                  "flex h-12 w-12 items-center justify-center rounded-lg border text-xl transition-all hover:scale-110",
                  currentLevel === level
                    ? "border-amber-400 bg-amber-50 shadow-sm ring-2 ring-amber-400 dark:border-amber-500 dark:bg-amber-900/20 dark:ring-amber-500"
                    : "border-light-300 bg-light-50 hover:border-light-400 dark:border-dark-300 dark:bg-dark-100 dark:hover:border-dark-400",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          {currentLevel && (
            <div>
              <label className="mb-1 block text-xs text-light-900 dark:text-dark-900">
                {t`How are you feeling?`}{" "}
                <span className="text-light-400 dark:text-dark-400">
                  ({t`optional`})
                </span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder={t`Add a note...`}
                maxLength={280}
                className="w-full rounded-md border border-light-300 bg-transparent px-3 py-1.5 text-xs text-neutral-900 placeholder:text-light-900 focus:border-amber-400 focus:outline-none dark:border-dark-300 dark:text-dark-1000 dark:placeholder:text-dark-900 dark:focus:border-amber-500"
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
