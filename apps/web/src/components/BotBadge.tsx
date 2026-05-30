import { t } from "@lingui/core/macro";
import { HiCpuChip } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

interface BotBadgeProps {
  className?: string;
  size?: "sm" | "xs";
}

export default function BotBadge({ className, size = "xs" }: BotBadgeProps) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-0.5 rounded-full bg-purple-100 font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        size === "xs" && "px-1.5 py-0.5 text-[10px]",
        size === "sm" && "px-2 py-0.5 text-xs",
        className,
      )}
      title={t`Bot account`}
    >
      <HiCpuChip
        className={twMerge(
          size === "xs" && "h-2.5 w-2.5",
          size === "sm" && "h-3 w-3",
        )}
      />
      Bot
    </span>
  );
}
