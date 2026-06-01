import { t } from "@lingui/core/macro";

import { PageHead } from "~/components/PageHead";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import DailyQuestsSection from "./DailyQuestsSection";
import EnergyCheckinSection from "./EnergyCheckinSection";
import MyBoardsSection from "./MyBoardsSection";
import MyCardsSection from "./MyCardsSection";
import RecentActivitySection from "./RecentActivitySection";
import SideQuestsSection from "./SideQuestsSection";
import WeeklyOverviewBar from "./WeeklyOverviewBar";
import WinsSection from "./WinsSection";

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
      <div className="h-full overflow-y-auto p-8 px-5 md:px-8 md:py-12">
        <h1 className="mb-8 font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
          {t`Home`}
        </h1>

        <WeeklyOverviewBar cards={cards?.cards ?? []} />

        <h2 className="mb-3 text-sm font-semibold text-light-900 dark:text-dark-900">
          {t`Feel Good Productivity`}
        </h2>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <EnergyCheckinSection />
          <DailyQuestsSection />
          <WinsSection />
          <SideQuestsSection />
        </div>

        <div className="mb-6 border-t border-light-300 dark:border-dark-300" />

        <div className="space-y-8">
          <MyCardsSection
            cards={cards?.cards ?? []}
            isLoading={cardsLoading}
          />
          <MyBoardsSection
            boards={boards ?? []}
            isLoading={boardsLoading}
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
