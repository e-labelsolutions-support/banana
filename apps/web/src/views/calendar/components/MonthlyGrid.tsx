import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";

import CalendarCard from "./CalendarCard";

type CalendarItem = {
  publicId: string;
  title: string;
  dueDate: Date | null;
  boardPublicId: string;
  boardName: string;
  labels: { name: string; colourCode: string | null }[];
};

const MonthlyGrid = ({
  month,
  year,
  cards,
  onMonthChange,
  onCardClick,
  weekStartsOn = 1,
}: {
  month: number;
  year: number;
  cards: CalendarItem[];
  onMonthChange: (month: number, year: number) => void;
  onCardClick: (card: CalendarItem) => void;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}) => {
  const currentDate = new Date(year, month, 1);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const cardsByDay = new Map<string, CalendarItem[]>();
  for (const card of cards) {
    if (!card.dueDate) continue;
    const key = format(card.dueDate, "yyyy-MM-dd");
    const existing = cardsByDay.get(key) ?? [];
    existing.push(card);
    cardsByDay.set(key, existing);
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const orderedDayNames = [
    ...dayNames.slice(weekStartsOn - 1),
    ...dayNames.slice(0, weekStartsOn - 1),
  ];

  const handlePrev = () => {
    const prev = subMonths(currentDate, 1);
    onMonthChange(prev.getMonth(), prev.getFullYear());
  };

  const handleNext = () => {
    const next = addMonths(currentDate, 1);
    onMonthChange(next.getMonth(), next.getFullYear());
  };

  return (
    <div>
      <div className="mb-4 flex items-center text-light-1000 dark:text-dark-1000">
        <button
          type="button"
          onClick={handlePrev}
          className="flex flex-none items-center justify-center p-1.5 text-light-700 hover:text-light-900 dark:text-dark-700 dark:hover:text-dark-1000"
        >
          <HiChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 text-center text-sm font-semibold">
          {format(currentDate, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={handleNext}
          className="flex flex-none items-center justify-center p-1.5 text-light-700 hover:text-light-900 dark:text-dark-700 dark:hover:text-dark-1000"
        >
          <HiChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 text-center text-xs/6 text-light-950 dark:text-dark-950">
        {orderedDayNames.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="isolate mt-2 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-light-200 bg-light-200 dark:border-dark-200 dark:bg-dark-200">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayCards = cardsByDay.get(key) ?? [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={key}
              className={`min-h-[110px] bg-light-50 p-1.5 dark:bg-dark-50 ${
                !isCurrentMonth ? "opacity-40" : ""
              }`}
            >
              <span
                className={`mx-auto flex size-7 items-center justify-center rounded-full text-sm ${
                  isToday
                    ? "bg-light-1000 font-semibold text-light-50 dark:bg-dark-1000 dark:text-dark-50"
                    : "text-light-900 dark:text-dark-900"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {dayCards.slice(0, 3).map((card) => (
                  <CalendarCard
                    key={card.publicId}
                    title={card.title}
                    dueDate={card.dueDate}
                    boardName={card.boardName}
                    labels={card.labels}
                    onClick={() => onCardClick(card)}
                  />
                ))}
                {dayCards.length > 3 && (
                  <span className="text-[10px] font-medium text-light-700 dark:text-dark-800">
                    +{dayCards.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthlyGrid;
