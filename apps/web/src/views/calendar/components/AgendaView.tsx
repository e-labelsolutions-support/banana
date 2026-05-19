import { format, isBefore, startOfDay } from "date-fns";
import { HiOutlineClock } from "react-icons/hi2";

type CalendarItem = {
  publicId: string;
  title: string;
  dueDate: Date | null;
  boardPublicId: string;
  boardName: string;
  labels: { name: string; colourCode: string | null }[];
};

const AgendaView = ({
  cards,
  onCardClick,
}: {
  cards: CalendarItem[];
  onCardClick: (card: CalendarItem) => void;
}) => {
  const groupedByDate = new Map<string, CalendarItem[]>();
  for (const card of cards) {
    if (!card.dueDate) continue;
    const key = format(card.dueDate, "yyyy-MM-dd");
    const existing = groupedByDate.get(key) ?? [];
    existing.push(card);
    groupedByDate.set(key, existing);
  }

  const sortedDates = Array.from(groupedByDate.keys()).sort();

  if (sortedDates.length === 0) {
    return (
      <div className="z-10 flex h-full w-full flex-col items-center justify-center space-y-8 pb-[150px]">
        <HiOutlineClock className="h-10 w-10 text-light-800 dark:text-dark-800" />
        <div>
          <p className="mb-2 mt-4 text-center text-[14px] font-bold text-light-1000 dark:text-dark-950">
            No cards with due dates
          </p>
          <p className="text-center text-[14px] text-light-900 dark:text-dark-900">
            Cards with a deadline will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const date = new Date(dateKey + "T00:00:00");
        const isOverdue = isBefore(date, startOfDay(new Date()));
        const dayCards = groupedByDate.get(dateKey) ?? [];

        return (
          <div key={dateKey}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${
                  isOverdue
                    ? "text-red-600 dark:text-red-400"
                    : "text-light-1000 dark:text-dark-1000"
                }`}
              >
                {format(date, "EEEE, MMM d")}
              </span>
              <span className="text-[10px] font-medium text-light-700 dark:text-dark-800">
                {dayCards.length} {dayCards.length === 1 ? "card" : "cards"}
              </span>
            </div>
            <div className="space-y-2">
              {dayCards.map((card) => {
                const cardOverdue =
                  card.dueDate && isBefore(card.dueDate, startOfDay(new Date()));
                return (
                  <button
                    key={card.publicId}
                    type="button"
                    onClick={() => onCardClick(card)}
                    className="flex w-full items-center gap-3 rounded-md border border-light-200 bg-light-50 px-3 py-2 text-left hover:bg-light-200 dark:border-dark-200 dark:bg-dark-200 dark:hover:bg-dark-300"
                  >
                    <div className="flex flex-col gap-0.5">
                      {card.labels.slice(0, 3).map((label) => (
                        <span
                          key={label.name}
                          className="inline-block h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: label.colourCode ?? "#3730a3",
                          }}
                        />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-900 dark:text-dark-1000">
                        {card.title}
                      </p>
                      <p className="text-[11px] text-light-700 dark:text-dark-800">
                        {card.boardName}
                      </p>
                    </div>
                    {cardOverdue && (
                      <span className="shrink-0 text-[10px] font-semibold text-red-600 dark:text-red-400">
                        Overdue
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgendaView;
