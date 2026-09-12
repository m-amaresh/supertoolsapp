"use client";

import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { faAlignLeft } from "@fortawesome/free-solid-svg-icons/faAlignLeft";
import { faAsterisk } from "@fortawesome/free-solid-svg-icons/faAsterisk";
import { faCalculator } from "@fortawesome/free-solid-svg-icons/faCalculator";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons/faCalendarDays";
import { faClock } from "@fortawesome/free-solid-svg-icons/faClock";
import { faCode } from "@fortawesome/free-solid-svg-icons/faCode";
import { faCodeCompare } from "@fortawesome/free-solid-svg-icons/faCodeCompare";
import { faDiagramProject } from "@fortawesome/free-solid-svg-icons/faDiagramProject";
import { faFileCode } from "@fortawesome/free-solid-svg-icons/faFileCode";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons/faFilePdf";
import { faFingerprint } from "@fortawesome/free-solid-svg-icons/faFingerprint";
import { faFont } from "@fortawesome/free-solid-svg-icons/faFont";
import { faHashtag } from "@fortawesome/free-solid-svg-icons/faHashtag";
import { faHeading } from "@fortawesome/free-solid-svg-icons/faHeading";
import { faKey } from "@fortawesome/free-solid-svg-icons/faKey";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons/faLayerGroup";
import { faLink } from "@fortawesome/free-solid-svg-icons/faLink";
import { faLock } from "@fortawesome/free-solid-svg-icons/faLock";
import { faNetworkWired } from "@fortawesome/free-solid-svg-icons/faNetworkWired";
import { faPalette } from "@fortawesome/free-solid-svg-icons/faPalette";
import { faPen } from "@fortawesome/free-solid-svg-icons/faPen";
import { faQrcode } from "@fortawesome/free-solid-svg-icons/faQrcode";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
import { faShield } from "@fortawesome/free-solid-svg-icons/faShield";
import { faTicket } from "@fortawesome/free-solid-svg-icons/faTicket";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  sidebarToolGroups,
  slugForCategory,
  type ToolIconKey,
} from "@/lib/tools";

const iconByKey: Record<ToolIconKey, IconDefinition> = {
  hash: faHashtag,
  key: faKey,
  fingerprint: faFingerprint,
  alignLeft: faAlignLeft,
  code2: faCode,
  calculator: faCalculator,
  heading2: faHeading,
  link2: faLink,
  ticket: faTicket,
  shield: faShield,
  lock: faLock,
  penLine: faPen,
  fileCode: faFileCode,
  arrowLeftRight: faRightLeft,
  palette: faPalette,
  workflow: faDiagramProject,
  gitCompareArrows: faCodeCompare,
  aLargeSmall: faFont,
  asterisk: faAsterisk,
  clock: faClock,
  calendarDays: faCalendarDays,
  networkWired: faNetworkWired,
  qrcode: faQrcode,
  filePdf: faFilePdf,
  layerGroup: faLayerGroup,
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 w-full border-none bg-foreground/44 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      <aside
        id="sidebar-nav"
        aria-label="Tool navigation"
        className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r border-border bg-background/94 backdrop-blur-sm transition-transform duration-200 ease-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav aria-label="Tools" className="h-full overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            {sidebarToolGroups.map((category) => (
              <div key={category.name}>
                {/* Not a heading: these caption a navigation list, and as <h3>
                    they put eight entries ahead of the page's <h1> in every
                    screen reader's heading outline. */}
                <div
                  id={`nav-group-${slugForCategory(category.name)}`}
                  className="mb-1.5 border-b border-border px-2 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {category.name}
                </div>
                {/* Named rather than role="group": that role would replace the
                    native list semantics, losing the item count. */}
                <ul
                  aria-labelledby={`nav-group-${slugForCategory(category.name)}`}
                  className="space-y-0.5"
                >
                  {category.tools.map((tool) => {
                    const isActive = pathname === tool.href;
                    const isAvailable = tool.available;
                    const icon = iconByKey[tool.icon];

                    return (
                      <li key={tool.href}>
                        {isAvailable ? (
                          <Link
                            href={tool.href}
                            onClick={onClose}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/25"
                                : "text-foreground/88 hover:bg-muted/80 hover:text-foreground"
                            }`}
                          >
                            <span
                              className={
                                isActive ? "opacity-100" : "opacity-90"
                              }
                            >
                              <FontAwesomeIcon
                                icon={icon}
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </span>
                            {tool.sidebarLabel}
                          </Link>
                        ) : (
                          <span className="flex min-h-10 cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground">
                            <span className="opacity-65">
                              <FontAwesomeIcon
                                icon={icon}
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </span>
                            {tool.sidebarLabel}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
