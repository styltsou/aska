import { Fragment } from "react";
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
import { FolderPlusIcon, PlusIcon } from "lucide-react";
import { collections } from "@/data/collections";
import { titleFromSlug } from "@/lib/slug";

function AppBreadcrumbs() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [, workspaceSlug, collectionsSegment, ...pathSegments] = pathname.split("/");
  const isNestedCollectionPath = collectionsSegment === "collections" &&
    pathSegments.length > 0;

  const breadcrumbSegments = pathSegments.map((segment, index) => ({
    slug: segment,
    label: index === 0
      ? collections.find((collection) => collection.slug === segment)?.name ??
        titleFromSlug(segment)
      : titleFromSlug(segment),
    path: pathSegments.slice(0, index + 1).join("/"),
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isNestedCollectionPath && workspaceSlug ? (
            <BreadcrumbLink
              render={
                <Link
                  to="/$workspaceSlug"
                  params={{ workspaceSlug }}
                  activeOptions={{ exact: true }}
                />
              }
            >
              Collections
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>Collections</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {breadcrumbSegments.map((segment, index) => {
          const isLast = index === breadcrumbSegments.length - 1;

          return (
            <Fragment key={segment.path}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={
                      <Link
                        to="/$workspaceSlug/collections/$"
                        params={{
                          workspaceSlug,
                          _splat: segment.path,
                        }}
                        activeOptions={{ exact: true }}
                      />
                    }
                  >
                    {segment.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AppHeader() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [, , collectionsSegment, ...pathSegments] = pathname.split("/");
  const isCollectionsView = collectionsSegment !== "collections";
  const isBoardView = collectionsSegment === "collections" && pathSegments.length > 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-sidebar transition-[height] duration-150 ease-linear group-has-data-[state=collapsed]/sidebar-wrapper:h-12">
      <SidebarTrigger />
      <AppBreadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        {isCollectionsView ? (
          <Button type="button" size="sm">
            <PlusIcon />
            <span>New collection</span>
          </Button>
        ) : null}
        {isBoardView ? (
          <Button type="button" size="sm">
            <FolderPlusIcon />
            <span>New folder</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
