import { Button } from "@headlessui/react";
import { t } from "@lingui/core/macro";
import { useState } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { useKeyboardShortcut } from "~/providers/keyboard-shortcuts";
import { useWorkspace } from "~/providers/workspace";
import CommandPallette from "./CommandPallette";
import { Tooltip } from "./Tooltip";

export default function WorkspaceMenu({
  isCollapsed = false,
}: {
  isCollapsed?: boolean;
}) {
  const { workspace, isLoading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  const { tooltipContent: commandPaletteShortcutTooltipContent } =
    useKeyboardShortcut({
      type: "PRESS",
      stroke: {
        key: "k",
        modifiers: ["META"],
      },
      action: () => setIsOpen(true),
      description: t`Open command menu`,
      group: "GENERAL",
    });

  return (
    <>
      <CommandPallette isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div className="relative inline-block w-full pb-3 text-left">
        <div>
          {isLoading ? (
            <div className={twMerge("mb-1 flex", isCollapsed && "md:p-1.5")}>
              <div className="h-6 w-6 animate-pulse rounded-md bg-light-200 dark:bg-dark-200" />
              <div
                className={twMerge(
                  "ml-2 h-6 w-[150px] animate-pulse rounded-md bg-light-200 dark:bg-dark-200",
                  isCollapsed && "md:hidden",
                )}
              />
            </div>
          ) : (
            <div
              className={twMerge(
                "flex items-center justify-start gap-1",
                isCollapsed && "md:flex-col-reverse md:items-center",
              )}
            >
              <div
                className={twMerge(
                  "mb-1 flex h-[34px] min-w-0 flex-1 items-center justify-start rounded-md p-1.5",
                  isCollapsed &&
                    "md:mb-1.5 md:h-9 md:w-9 md:flex-none md:justify-center md:p-0",
                )}
                title={isCollapsed ? workspace.name : undefined}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-700">
                  <span className="text-xs font-bold leading-none text-white">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                </span>
                <span
                  className={twMerge(
                    "ml-2 min-w-0 flex-1 truncate text-left text-sm font-bold text-neutral-900 dark:text-dark-1000",
                    isCollapsed && "md:hidden",
                  )}
                >
                  {workspace.name}
                </span>
                {workspace.plan === "pro" && (
                  <span
                    className={twMerge(
                      "ml-2 inline-flex items-center rounded-md bg-indigo-100 px-2 py-1 text-[10px] font-medium text-indigo-700",
                      isCollapsed && "md:hidden",
                    )}
                  >
                    Pro
                  </span>
                )}
              </div>
              <Tooltip content={commandPaletteShortcutTooltipContent}>
                <Button
                  className={twMerge(
                    "mb-1 h-[34px] w-[34px] flex-shrink-0 rounded-lg bg-light-200 p-2 hover:bg-light-300 focus:outline-none dark:bg-dark-200 dark:hover:bg-dark-300",
                    isCollapsed && "md:mb-2 md:h-9 md:w-9",
                  )}
                  onClick={() => setIsOpen(true)}
                >
                  <HiMagnifyingGlass className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
