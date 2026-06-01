import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiMap, HiXMark } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { api } from "~/utils/api";

export default function SideQuestsSection() {
  const utils = api.useUtils();
  const [showExplored, setShowExplored] = useState(false);
  const { data, isLoading } = api.productivity.getSideQuests.useQuery({
    showExplored,
    limit: 10,
  });
  const createMutation = api.productivity.createSideQuest.useMutation();
  const exploreMutation = api.productivity.markSideQuestExplored.useMutation();
  const deleteMutation = api.productivity.deleteSideQuest.useMutation();

  const quests = data ?? [];
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const text = input.trim();
    if (!text) return;
    createMutation.mutate(
      { text },
      {
        onSuccess: () => {
          setInput("");
          utils.productivity.getSideQuests.invalidate();
        },
      },
    );
  };

  const handleExplore = (id: number) => {
    exploreMutation.mutate(
      { id },
      {
        onSuccess: () => {
          utils.productivity.getSideQuests.invalidate();
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          utils.productivity.getSideQuests.invalidate();
        },
      },
    );
  };

  return (
    <section className="rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-50">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiMap className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-light-900 dark:text-dark-900">
            {t`Side Quests`}
          </h2>
        </div>
        <button
          onClick={() => setShowExplored(!showExplored)}
          className="text-xs text-light-900 hover:text-neutral-900 dark:text-dark-900 dark:hover:text-dark-1000"
        >
          {showExplored ? t`Hide explored` : t`Show explored`}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-md bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {quests.map((quest) => (
            <div
              key={quest.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-light-200 dark:hover:bg-dark-200"
            >
              <button
                onClick={() => handleExplore(quest.id)}
                disabled={quest.explored}
                className={twMerge(
                  "flex-shrink-0 rounded px-1.5 py-0.5 text-xs transition-colors",
                  quest.explored
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20",
                )}
              >
                {quest.explored ? "✓" : "→"}
              </button>
              <span
                className={twMerge(
                  "min-w-0 flex-1 truncate text-xs",
                  quest.explored
                    ? "text-light-900 line-through dark:text-dark-900"
                    : "text-neutral-900 dark:text-dark-1000",
                )}
              >
                {quest.text}
              </span>
              <button
                onClick={() => handleDelete(quest.id)}
                className="flex-shrink-0 rounded p-0.5 text-light-900 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-dark-900 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <HiXMark className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <div className="pt-1">
            <div className="flex gap-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                title={t`Something you're curious about...`}
                placeholder={t`Add a quest...`}
                maxLength={200}
                className="min-w-0 flex-1 rounded border border-light-300 bg-transparent px-2 py-1.5 text-xs text-neutral-900 placeholder:text-light-900 focus:border-emerald-400 focus:outline-none dark:border-dark-300 dark:text-dark-1000 dark:placeholder:text-dark-900 dark:focus:border-emerald-500"
              />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="flex-shrink-0 rounded px-2 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              {t`Add`}
            </button>
            </div>
          </div>

          {quests.length === 0 && !showExplored && (
            <p className="py-2 text-center text-xs text-light-900 dark:text-dark-900">
              {t`No side quests. Follow your curiosity!`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
