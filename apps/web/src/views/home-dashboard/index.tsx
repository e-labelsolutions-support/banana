import { t } from "@lingui/core/macro";

import { PageHead } from "~/components/PageHead";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import MyBoardsSection from "./MyBoardsSection";
import MyCardsSection from "./MyCardsSection";
import RecentActivitySection from "./RecentActivitySection";

export default function HomeDashboardView() {
  const { workspace } = useWorkspace();

  const { data: boards, isLoading: boardsLoading } =
    api.dashboard.myBoards.useQuery(
      { workspacePublicId: workspace.publicId },
      { enabled: !!workspace.publicId },
    );

  const { data: cards, isLoading: cardsLoading } =
    api.dashboard.myCards.useQuery(
      { workspacePublicId: workspace.publicId },
      { enabled: !!workspace.publicId },
    );

  const { data: activity, isLoading: activityLoading } =
    api.dashboard.recentActivity.useQuery(
      { workspacePublicId: workspace.publicId },
      { enabled: !!workspace.publicId },
    );

  return (
    <>
      <PageHead title={t`Home | banana.bn`} />
      <div className="m-auto h-full max-w-[1100px] overflow-y-auto p-8 px-5 md:px-28 md:py-12">
        <h1 className="mb-8 font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
          {t`Home`}
        </h1>

        <div className="space-y-8">
          <MyBoardsSection
            boards={boards ?? []}
            isLoading={boardsLoading}
          />
          <MyCardsSection
            cards={cards?.cards ?? []}
            isLoading={cardsLoading}
          />
          <RecentActivitySection
            activities={activity?.activities ?? []}
            isLoading={activityLoading}
          />
        </div>
      </div>
    </>
  );
}
