import { t } from "@lingui/core/macro";
import { HiArrowPath } from "react-icons/hi2";

import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";

interface Activity {
  publicId: string;
  type: string;
  createdAt: Date;
  fromTitle?: string | null;
  toTitle?: string | null;
  card?: {
    publicId: string;
    title: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
  member?: {
    publicId: string;
    user?: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
  } | null;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  "card.created": "created",
  "card.updated.title": "renamed",
  "card.updated.description": "updated description of",
  "card.updated.duedate": "changed due date of",
  "card.updated.label.added": "added label to",
  "card.updated.label.removed": "removed label from",
  "card.updated.member.added": "was added to",
  "card.updated.member.removed": "was removed from",
  "card.moved.list": "moved",
  "card.moved.board": "moved",
  "card.updated.checklist.added": "added checklist to",
  "card.updated.checklist.item.added": "added checklist item to",
  "card.comment.created": "commented on",
  "card.comment.updated": "edited comment on",
  "card.attachment.added": "added attachment to",
};

export default function RecentActivitySection() {
  const { workspace } = useWorkspace();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.dashboard.recentActivity.useInfiniteQuery(
      { workspacePublicId: workspace.publicId, limit: 5 },
      {
        enabled: !!workspace.publicId,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-light-900 dark:text-dark-900">
        {t`Recent Activity`}
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-light-200 dark:bg-dark-200"
            />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-sm text-light-900 dark:text-dark-900">
          {t`No recent activity on your cards.`}
        </p>
      ) : (
        <div className="space-y-1">
          {activities.map((activity) => {
            const actor = activity.member?.user ?? activity.user;
            const actorName = actor?.name ?? "Someone";
            const action =
              ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type;
            const cardTitle = activity.card?.title ?? activity.toTitle ?? "a card";

            return (
              <div
                key={activity.publicId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-light-900 hover:bg-light-200 dark:text-dark-900 dark:hover:bg-dark-200"
              >
                <HiArrowPath className="h-3.5 w-3.5 flex-shrink-0 text-light-900 dark:text-dark-900" />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-neutral-900 dark:text-dark-1000">
                    {actorName}
                  </span>{" "}
                  {action}{" "}
                  <span className="font-medium text-neutral-900 dark:text-dark-1000">
                    {cardTitle}
                  </span>
                </span>
                <span className="ml-auto flex-shrink-0 text-xs text-light-900 dark:text-dark-900">
                  {formatRelativeDate(activity.createdAt)}
                </span>
              </div>
            );
          })}

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-2 w-full rounded-md px-3 py-1.5 text-xs text-light-900 hover:bg-light-200 disabled:opacity-50 dark:text-dark-900 dark:hover:bg-dark-200"
            >
              {isFetchingNextPage ? t`Loading...` : t`Load more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}
