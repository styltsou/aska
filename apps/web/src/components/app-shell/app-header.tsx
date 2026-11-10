import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateCollectionDialog } from "@/components/app-shell/create-collection-dialog";
import { useWorkspace } from "@/api/workspace";
import { useCollectionContents } from "@/api/collection";
import { titleFromSlug } from "@/lib/slug";
import { getCollectionViewScope, usePersistedStore } from "@/store";
import { makeBoardKey } from "@/components/canvas/canvas-key";
import { CollectionViewMenu } from "@/components/collections/collection-view-menu";
import { GridDensityControl } from "@/components/asset-grid/grid-density-control";
import { useCommittedPathname } from "./use-committed-pathname";
import { mergeWorkspaceOverlaySearch } from "@/lib/workspace-overlay-search";
import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";
import { getBreadcrumbLayout } from "./breadcrumb-layout";

type HeaderCrumb = { label: string; path?: string };
const LABEL_CLASS = "block max-w-40 truncate";

function CrumbLabel({
  label,
  current,
  link,
}: {
  label: string;
  current: boolean;
  link?: React.ReactElement;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      setTruncated(element.scrollWidth > element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [label]);
  return (
    <Tooltip disabled={!truncated}>
      <TooltipTrigger
        render={
          current ? (
            <BreadcrumbPage
              className="min-w-0"
              tabIndex={truncated ? 0 : undefined}
            />
          ) : (
            <BreadcrumbLink className="min-w-0" render={link} />
          )
        }
      >
        <span ref={ref} className={LABEL_CLASS}>
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="break-all">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function AppBreadcrumbs() {
  const pathname = useCommittedPathname();
  const workspaceSearch = useRouterState({
    select: (state) => state.location.search as WorkspaceRouteSearch,
  });
  const boardSearch = useMemo(
    () =>
      mergeWorkspaceOverlaySearch(workspaceSearch, {
        asset: undefined,
        view: undefined,
      }),
    [workspaceSearch],
  );
  const [, workspaceSlug, collectionsSegment, ...pathSegments] =
    pathname.split("/");
  const [collectionSlug = "", ...folderSegments] = pathSegments;
  const { data: workspaceData } = useWorkspace(workspaceSlug ?? "");
  const { data: collectionContents } = useCollectionContents(
    workspaceSlug ?? "",
    collectionSlug,
    folderSegments.join("/") || undefined,
    { enabled: folderSegments.length > 0 },
  );
  const crumbs: HeaderCrumb[] = [
    { label: collectionsSegment === "inbox" ? "Inbox" : "Collections" },
    ...pathSegments.map((segment, index) => ({
      label:
        index === 0
          ? (workspaceData?.collections.find((c) => c.slug === segment)?.name ??
            titleFromSlug(segment))
          : (collectionContents?.breadcrumbs[index - 1]?.name ??
            titleFromSlug(segment)),
      path: pathSegments.slice(0, index + 1).join("/"),
    })),
  ];
  const containerRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ showRoot: true, tailCount: 4 });
  const [keyboardMenu, setKeyboardMenu] = useState(false);
  const labelsKey = JSON.stringify(crumbs.map((crumb) => crumb.label));
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const update = () => {
      const widths = Array.from(
        measure.children,
        (child) => child.getBoundingClientRect().width,
      );
      const { showRoot, tailCount } = getBreadcrumbLayout(
        widths,
        container.clientWidth,
      );
      setLayout((previous) =>
        previous.showRoot === showRoot && previous.tailCount === tailCount
          ? previous
          : { showRoot, tailCount },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [labelsKey]);
  const tailStart = Math.max(1, crumbs.length - layout.tailCount);
  const hidden =
    crumbs.length > 1 ? crumbs.slice(layout.showRoot ? 1 : 0, tailStart) : [];
  const visible =
    crumbs.length === 1
      ? crumbs
      : [...(layout.showRoot ? [crumbs[0]] : []), ...crumbs.slice(tailStart)];
  const linkFor = (crumb: HeaderCrumb) =>
    crumb.path === undefined ? (
      <Link
        to="/$workspaceSlug"
        params={{ workspaceSlug }}
        search={boardSearch}
        activeOptions={{ exact: true }}
      />
    ) : (
      <Link
        to="/$workspaceSlug/collections/$"
        params={{ workspaceSlug, _splat: crumb.path }}
        search={boardSearch}
        activeOptions={{ exact: true }}
      />
    );
  const separator = (
    <BreadcrumbSeparator className="shrink-0">
      <span className="relative flex size-3.5 items-center justify-center before:absolute before:h-3 before:w-px before:[transform:rotate(20deg)] before:bg-current" />
    </BreadcrumbSeparator>
  );
  return (
    <Breadcrumb ref={containerRef} className="relative min-w-0 flex-1">
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute flex w-max items-center text-sm"
      >
        {crumbs.map((crumb, index) => (
          <span key={index} className={LABEL_CLASS}>
            {crumb.label}
          </span>
        ))}
      </div>
      <BreadcrumbList className="flex-nowrap gap-1.5 whitespace-nowrap">
        {visible.map((crumb, index) => {
          const current = crumb === crumbs.at(-1);
          const insertMenu =
            hidden.length > 0 && (layout.showRoot ? index === 1 : index === 0);
          return (
            <Fragment key={crumb.path ?? "root"}>
              {insertMenu && (
                <>
                  {index > 0 && separator}
                  <BreadcrumbItem className="shrink-0">
                    <DropdownMenu
                      modal={false}
                      onOpenChange={(_, details) =>
                        setKeyboardMenu(details.event instanceof KeyboardEvent)
                      }
                    >
                      <DropdownMenuTrigger
                        openOnHover
                        delay={180}
                        closeDelay={250}
                        aria-label="Show hidden breadcrumb locations"
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={
                          keyboardMenu
                            ? "w-auto max-w-72 bg-sidebar text-sidebar-foreground !transition-none"
                            : "w-auto max-w-72 bg-sidebar text-sidebar-foreground duration-100 data-ending-style:duration-75"
                        }
                      >
                        {hidden.map((item) => (
                          <DropdownMenuItem
                            key={item.path ?? "root"}
                            render={linkFor(item)}
                            className="cursor-pointer"
                          >
                            <span className="break-all">{item.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </BreadcrumbItem>
                </>
              )}
              {(index > 0 || insertMenu) && separator}
              <BreadcrumbItem className={current ? "min-w-0" : "shrink-0"}>
                <CrumbLabel
                  label={crumb.label}
                  current={current}
                  link={current ? undefined : linkFor(crumb)}
                />
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppHeader() {
  const pathname = useCommittedPathname();
  const [, workspaceSlug, collectionsSegment, ...pathSegments] =
    pathname.split("/");
  const isCollectionsView = pathname === `/${workspaceSlug}`;
  const isBoardView =
    collectionsSegment === "collections" && pathSegments.length > 0;
  const collectionSlug = pathSegments[0] ?? "";
  const folderPath = pathSegments.slice(1).join("/");
  const collectionViewScope = getCollectionViewScope(
    workspaceSlug,
    collectionSlug,
  );
  const boardView = usePersistedStore(
    (state) => state.collectionViews[collectionViewScope] ?? "canvas",
  );
  const setCollectionView = usePersistedStore(
    (state) => state.setCollectionView,
  );

  return (
    <header className="sticky top-0 z-20 flex h-12 min-w-0 shrink-0 items-center bg-sidebar transition-[height] duration-(--sidebar-duration) ease-(--sidebar-ease) group-has-[[data-slot=sidebar][data-state=collapsed]]/sidebar-wrapper:h-12 motion-reduce:transition-none md:h-14">
      <div className="flex h-12 w-full min-w-0 items-center gap-2 px-2 md:px-0">
        <SidebarTrigger />
        <AppBreadcrumbs />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {collectionsSegment === "inbox" ? <GridDensityControl /> : null}
          {isCollectionsView ? (
            <CreateCollectionDialog workspaceSlug={workspaceSlug}>
              <Button type="button" size="sm">
                <PlusIcon />
                <span>New collection</span>
              </Button>
            </CreateCollectionDialog>
          ) : null}
          {isBoardView ? (
            <CollectionViewMenu
              boardKey={makeBoardKey(
                workspaceSlug,
                collectionSlug,
                folderPath || undefined,
              )}
              value={boardView}
              workspaceSlug={workspaceSlug}
              onChange={(view) => setCollectionView(collectionViewScope, view)}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
