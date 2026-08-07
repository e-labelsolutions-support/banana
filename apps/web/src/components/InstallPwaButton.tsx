import { t } from "@lingui/core/macro";
import { HiArrowDownTray } from "react-icons/hi2";

import { usePwaInstall } from "~/hooks/usePwaInstall";

interface Props {
  variant?: "floating" | "sidebar";
  isCollapsed?: boolean;
}

export const InstallPwaButton = ({ variant = "floating", isCollapsed = false }: Props) => {
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();

  if (!canInstall || isInstalled) return null;

  if (variant === "sidebar") {
    return (
      <button
        onClick={triggerInstall}
        title={t`Install app`}
        aria-label={t`Install app`}
        className={
          isCollapsed
            ? "flex h-9 w-9 items-center justify-center rounded-md text-light-1000 hover:bg-light-300 dark:text-dark-1000 dark:hover:bg-dark-200"
            : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-light-1000 hover:bg-light-300 dark:text-dark-1000 dark:hover:bg-dark-200"
        }
      >
        <HiArrowDownTray className="h-4 w-4 flex-shrink-0" />
        {!isCollapsed && <span>{t`Install app`}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={triggerInstall}
      className="fixed top-4 right-4 z-[99999] rounded-full border-0 py-2.5 px-[22px] text-sm font-medium cursor-pointer transition-all duration-200 bg-black text-white hover:bg-[#333] shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:bg-white dark:text-black dark:hover:bg-[#f0f0f0] dark:shadow-[0_4px_14px_rgba(255,255,255,0.18)]"
    >
      Install App
    </button>
  );
};
