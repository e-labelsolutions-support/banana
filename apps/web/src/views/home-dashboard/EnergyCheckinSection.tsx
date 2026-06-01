import { t } from "@lingui/core/macro";
import { useState } from "react";
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

  const currentLevel = data?.today?.energyLevel ?? selectedLevel;
  const streak = data?.streak ?? 0;

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
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder={t`How are you feeling? (optional)`}
              maxLength={280}
              className="w-full rounded-md border border-light-300 bg-transparent px-3 py-1.5 text-xs text-neutral-900 placeholder:text-light-900 focus:border-amber-400 focus:outline-none dark:border-dark-300 dark:text-dark-1000 dark:placeholder:text-dark-900 dark:focus:border-amber-500"
            />
          )}
        </>
      )}
    </section>
  );
}
