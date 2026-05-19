import { format, isBefore, startOfDay } from "date-fns";
import { HiOutlineClock } from "react-icons/hi2";

const CalendarCard = ({
  title,
  dueDate,
  boardName,
  labels,
  onClick,
}: {
  title: string;
  dueDate: Date | null;
  boardName: string;
  labels: { name: string; colourCode: string | null }[];
  onClick?: () => void;
}) => {
  const isOverdue = dueDate && isBefore(dueDate, startOfDay(new Date()));

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-light-200 bg-light-50 px-2 py-1.5 text-left hover:bg-light-200 dark:border-dark-200 dark:bg-dark-200 dark:hover:bg-dark-300"
    >
      {labels.length > 0 && (
        <div className="mb-1 flex gap-0.5">
          {labels.slice(0, 3).map((label) => (
            <span
              key={label.name}
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: label.colourCode ?? "#3730a3" }}
            />
          ))}
        </div>
      )}
      <p className="truncate text-sm text-neutral-900 dark:text-dark-1000">
        {title}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-light-700 dark:text-dark-800">
        {dueDate && (
          <span
            className={`flex items-center gap-0.5 text-[11px] ${
              isOverdue
                ? "text-red-600 dark:text-red-400"
                : ""
            }`}
          >
            <HiOutlineClock className="h-3.5 w-3.5" />
            {format(dueDate, "MMM d")}
          </span>
        )}
        <span className="truncate text-[10px]">{boardName}</span>
      </div>
    </button>
  );
};

export default CalendarCard;
