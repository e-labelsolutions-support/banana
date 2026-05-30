import { t } from "@lingui/core/macro";
import Link from "next/link";
import { HiCalendar } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

interface CardLabel {
  name: string;
  colourCode: string | null;
}

interface Card {
  publicId: string;
  title: string;
  dueDate: Date | null;
  updatedAt: Date | null;
  boardPublicId: string;
  boardName: string;
  listPublicId: string;
  listName: string;
  labels: CardLabel[];
}

interface MyCardsSectionProps {
  cards: Card[];
  isLoading: boolean;
}

export default function MyCardsSection({
  cards,
  isLoading,
}: MyCardsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-light-900 dark:text-dark-900">
        {t`My Cards`}
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`No cards assigned to you yet.`}
        </p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => {
            const isOverdue =
              card.dueDate && new Date(card.dueDate) < new Date();

            return (
              <Link
                key={card.publicId}
                href={`/cards/${card.publicId}`}
                className="group flex items-center gap-3 rounded-lg border border-light-300 bg-light-50 p-3 transition-colors hover:bg-light-200 dark:border-dark-300 dark:bg-dark-50 dark:hover:bg-dark-200"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900 dark:text-dark-1000">
                    {card.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-light-900 dark:text-dark-900">
                    <span className="truncate">{card.boardName}</span>
                    <span>·</span>
                    <span className="truncate">{card.listName}</span>
                  </div>
                </div>

                {card.labels.length > 0 && (
                  <div className="flex flex-shrink-0 gap-1">
                    {card.labels.map((label, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: label.colourCode
                            ? `${label.colourCode}20`
                            : undefined,
                          color: label.colourCode ?? undefined,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}

                {card.dueDate && (
                  <div
                    className={twMerge(
                      "flex flex-shrink-0 items-center gap-1 text-xs",
                      isOverdue
                        ? "text-red-600 dark:text-red-400"
                        : "text-light-900 dark:text-dark-900",
                    )}
                  >
                    <HiCalendar className="h-3 w-3" />
                    {formatDueDate(card.dueDate)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatDueDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
