import { t } from "@lingui/core/macro";
import Link from "next/link";
import { HiLockClosed, HiLockOpen } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

interface Board {
  publicId: string;
  name: string;
  slug: string;
  updatedAt: Date | null;
  createdAt: Date;
  visibility: "private" | "public";
  isArchived: boolean;
}

interface MyBoardsSectionProps {
  boards: Board[];
  isLoading: boolean;
}

export default function MyBoardsSection({
  boards,
  isLoading,
}: MyBoardsSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-light-900 dark:text-dark-900">
        {t`Boards`}
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`No boards found.`}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.publicId}
              href={`/boards/${board.publicId}`}
              className={twMerge(
                "group flex items-center gap-3 rounded-lg border border-light-300 bg-light-50 p-4 transition-colors hover:bg-light-200 dark:border-dark-300 dark:bg-dark-50 dark:hover:bg-dark-200",
                board.isArchived && "opacity-60",
              )}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/30">
                {board.visibility === "private" ? (
                  <HiLockClosed className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <HiLockOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-dark-1000">
                  {board.name}
                </p>
                <p className="text-xs text-light-900 dark:text-dark-900">
                  {board.updatedAt
                    ? `Updated ${formatRelativeDate(board.updatedAt)}`
                    : `Created ${formatRelativeDate(board.createdAt)}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
