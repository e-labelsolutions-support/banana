import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiClipboardDocumentCheck } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { api } from "~/utils/api";

const CATEGORIES = [
  {
    key: "health" as const,
    icon: "❤️",
    label: "Health",
    placeholder: "One small action for your health...",
  },
  {
    key: "work" as const,
    icon: "💼",
    label: "Work",
    placeholder: "One small action for your work...",
  },
  {
    key: "relationships" as const,
    icon: "👥",
    label: "Relationships",
    placeholder: "One small action for relationships...",
  },
];

type Category = (typeof CATEGORIES)[number]["key"];

export default function DailyQuestsSection() {
  const utils = api.useUtils();
  const { data, isLoading } = api.productivity.getDailyQuests.useQuery();
  const setQuest = api.productivity.setDailyQuest.useMutation();
  const completeQuest = api.productivity.completeDailyQuest.useMutation();

  const quests = data?.quests ?? [];
  const getQuest = (cat: Category) => quests.find((q) => q.category === cat);
  const completedCount = quests.filter((q) => q.completed).length;

  const [inputs, setInputs] = useState<Record<Category, string>>({
    health: getQuest("health")?.action ?? "",
    work: getQuest("work")?.action ?? "",
    relationships: getQuest("relationships")?.action ?? "",
  });

  const handleSave = (category: Category) => {
    const action = inputs[category]?.trim();
    if (!action) return;
    setQuest.mutate(
      { category, action },
      {
        onSuccess: () => {
          utils.productivity.getDailyQuests.invalidate();
        },
      },
    );
  };

  const handleToggle = (category: Category, completed: boolean) => {
    completeQuest.mutate(
      { category, completed },
      {
        onSuccess: () => {
          utils.productivity.getDailyQuests.invalidate();
        },
      },
    );
  };

  return (
    <section className="rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-50">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiClipboardDocumentCheck className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-light-900 dark:text-dark-900">
            {t`Daily Quests`}
          </h2>
        </div>
        <span className="text-xs text-light-900 dark:text-dark-900">
          {completedCount}/3 {t`completed`}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {CATEGORIES.map(({ key, icon, label, placeholder }) => {
            const quest = getQuest(key);
            const isSaved = !!quest;

            return (
              <div key={key} className="flex items-center gap-2">
                <button
                  onClick={() =>
                    isSaved && handleToggle(key, !quest.completed)
                  }
                  disabled={!isSaved}
                  className={twMerge(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
                    quest?.completed
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-light-400 dark:border-dark-400",
                    !isSaved && "opacity-50",
                  )}
                >
                  {quest?.completed && (
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
                <span className="flex-shrink-0 text-sm" title={label}>
                  {icon}
                </span>
                {isSaved ? (
                  <span
                    className={twMerge(
                      "min-w-0 flex-1 truncate text-xs",
                      quest.completed
                        ? "text-light-900 line-through dark:text-dark-900"
                        : "text-neutral-900 dark:text-dark-1000",
                    )}
                  >
                    {quest.action}
                  </span>
                ) : (
                  <div className="flex min-w-0 flex-1 gap-1">
                    <input
                      type="text"
                      value={inputs[key]}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave(key);
                      }}
                      placeholder={placeholder}
                      maxLength={200}
                      className="min-w-0 flex-1 rounded border border-light-300 bg-transparent px-2 py-1 text-xs text-neutral-900 placeholder:text-light-900 focus:border-indigo-400 focus:outline-none dark:border-dark-300 dark:text-dark-1000 dark:placeholder:text-dark-900 dark:focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleSave(key)}
                      disabled={!inputs[key]?.trim()}
                      className="flex-shrink-0 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                    >
                      {t`Set`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
