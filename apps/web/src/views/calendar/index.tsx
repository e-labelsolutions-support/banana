import { t } from "@lingui/core/macro";
import { useState } from "react";
import { useRouter } from "next/router";
import {
  HiChevronDown,
  HiOutlineCalendarDays,
  HiOutlineListBullet,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";

import { PageHead } from "~/components/PageHead";
import { useWorkspace } from "~/providers/workspace";
import { api } from "~/utils/api";
import MonthlyGrid from "./components/MonthlyGrid";
import AgendaView from "./components/AgendaView";

type ViewMode = "grid" | "agenda";

export default function CalendarView() {
  const { workspace } = useWorkspace();
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [boardFilter, setBoardFilter] = useState<string>("");

  const { data: cards, isLoading } = api.card.calendar.useQuery(
    {
      workspacePublicId: workspace.publicId,
      boardPublicId: boardFilter || undefined,
      month,
      year,
    },
    { enabled: !!workspace.publicId },
  );

  const { data: boards } = api.board.all.useQuery(
    { workspacePublicId: workspace.publicId },
    { enabled: !!workspace.publicId },
  );

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  };

  const handleCardClick = (card: { publicId: string; boardPublicId: string }) => {
    router.push(`/boards/${card.boardPublicId}?card=${card.publicId}`);
  };

  const selectedBoardName =
    boards?.find((b) => b.publicId === boardFilter)?.name ?? t`All boards`;

  return (
    <>
      <PageHead
        title={t`Calendar | ${workspace.name ?? t`Workspace`}`}
      />
      <div className="m-auto h-full max-w-[1100px] p-8 px-5 md:px-28 md:py-12">
        <div className="relative z-10 mb-8 flex w-full items-center justify-between">
          <h1 className="font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
            {t`Calendar`}
          </h1>
          <div className="flex items-center gap-2">
            {/* Board filter dropdown */}
            <div className="hidden sm:block">
              <Listbox value={boardFilter} onChange={setBoardFilter}>
                <div className="relative">
                  <ListboxButton className="inline-flex items-center gap-1.5 rounded-md border-[1px] border-light-600 bg-light-50 px-3 py-2 text-sm font-semibold text-light-1000 shadow-sm dark:border-dark-600 dark:bg-dark-300 dark:text-dark-1000">
                    <HiOutlineCalendarDays className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{selectedBoardName}</span>
                    <HiChevronDown className="ml-1 h-4 w-4 text-light-700 dark:text-dark-800" />
                  </ListboxButton>
                  <ListboxOptions className="absolute right-0 z-20 mt-1 max-h-60 w-56 overflow-auto rounded-md bg-light-50 py-1 text-sm shadow-lg ring-1 ring-inset ring-light-300 dark:bg-dark-50 dark:ring-dark-300">
                    <ListboxOption
                      value=""
                      className={({ selected }) =>
                        `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                          selected
                            ? "font-bold text-light-1000 dark:text-dark-1000"
                            : "text-light-1000 dark:text-dark-1000"
                        }`
                      }
                    >
                      {t`All boards`}
                    </ListboxOption>
                    {boards?.map((board) => (
                      <ListboxOption
                        key={board.publicId}
                        value={board.publicId}
                        className={({ selected }) =>
                          `relative cursor-pointer select-none py-2 pl-3 pr-9 ${
                            selected
                              ? "font-bold text-light-1000 dark:text-dark-1000"
                              : "text-light-1000 dark:text-dark-1000"
                          }`
                        }
                      >
                        {board.name}
                      </ListboxOption>
                    ))}
                  </ListboxOptions>
                </div>
              </Listbox>
            </div>

            {/* View toggle */}
            <div className="flex rounded-md border-[1px] border-light-600 dark:border-dark-600">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-l-md px-2.5 py-2 ${
                  viewMode === "grid"
                    ? "bg-light-1000 text-light-50 dark:bg-dark-1000 dark:text-dark-50"
                    : "bg-light-50 text-light-700 hover:bg-light-200 dark:bg-dark-300 dark:text-dark-800 dark:hover:bg-dark-200"
                }`}
                aria-label="Grid view"
              >
                <HiOutlineSquares2X2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`rounded-r-md px-2.5 py-2 ${
                  viewMode === "agenda"
                    ? "bg-light-1000 text-light-50 dark:bg-dark-1000 dark:text-dark-50"
                    : "bg-light-50 text-light-700 hover:bg-light-200 dark:bg-dark-300 dark:text-dark-800 dark:hover:bg-dark-200"
                }`}
                aria-label="Agenda view"
              >
                <HiOutlineListBullet className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[300px] w-full animate-pulse rounded-md bg-light-200 dark:bg-dark-100"
              />
            ))}
          </div>
        ) : viewMode === "grid" ? (
          <MonthlyGrid
            month={month}
            year={year}
            cards={cards ?? []}
            onMonthChange={handleMonthChange}
            onCardClick={handleCardClick}
          />
        ) : (
          <AgendaView cards={cards ?? []} onCardClick={handleCardClick} />
        )}
      </div>
    </>
  );
}
