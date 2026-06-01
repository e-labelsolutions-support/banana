import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiSparkles, HiTrophy } from "react-icons/hi2";

import { api } from "~/utils/api";

const MAX_WINS_PER_DAY = 5;

export default function WinsSection() {
  const utils = api.useUtils();
  const { data, isLoading } = api.productivity.getTodayWins.useQuery();
  const createWin = api.productivity.createWin.useMutation();

  const wins = data?.wins ?? [];
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const text = input.trim();
    if (!text || wins.length >= MAX_WINS_PER_DAY) return;
    createWin.mutate(
      { text },
      {
        onSuccess: () => {
          setInput("");
          utils.productivity.getTodayWins.invalidate();
        },
      },
    );
  };

  return (
    <section className="rounded-lg border border-light-300 bg-light-50 p-4 dark:border-dark-300 dark:bg-dark-50">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HiTrophy className="h-4 w-4 text-yellow-500" />
          <h2 className="text-sm font-semibold text-light-900 dark:text-dark-900">
            {t`Find the Win`}
          </h2>
        </div>
        {wins.length > 0 && (
          <span className="text-xs text-light-900 dark:text-dark-900">
            {wins.length} {wins.length === 1 ? "win" : "wins"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded-md bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {wins.map((win) => (
            <div
              key={win.id}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-light-200 dark:hover:bg-dark-200"
            >
              <HiSparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-500" />
              <span className="text-xs text-neutral-900 dark:text-dark-1000">
                {win.text}
              </span>
            </div>
          ))}

          {wins.length < MAX_WINS_PER_DAY && (
            <div>
              <label className="mb-1 block text-xs text-light-900 dark:text-dark-900">
                {t`Something worth celebrating today`}
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                  placeholder={t`Add a win...`}
                  maxLength={500}
                  className="min-w-0 flex-1 rounded border border-light-300 bg-transparent px-2 py-1.5 text-xs text-neutral-900 placeholder:text-light-900 focus:border-yellow-400 focus:outline-none dark:border-dark-300 dark:text-dark-1000 dark:placeholder:text-dark-900 dark:focus:border-yellow-500"
                />
              <button
                onClick={handleAdd}
                disabled={!input.trim()}
                className="flex-shrink-0 rounded px-2 py-1.5 text-xs text-yellow-600 hover:bg-yellow-50 disabled:opacity-40 dark:text-yellow-400 dark:hover:bg-yellow-900/20"
              >
                {t`Add`}
              </button>
              </div>
            </div>
          )}

          {wins.length === 0 && (
            <p className="py-2 text-center text-xs text-light-900 dark:text-dark-900">
              {t`No wins yet. Find something to celebrate!`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
