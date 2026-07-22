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
import {
  FileTextIcon,
  FolderPlusIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import { CreateCollectionDialog } from "@/components/app-shell/create-collection-dialog";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";
import { useWorkspace } from "@/api/workspace";
import { useCollectionContents } from "@/api/collection";
import { useBoardInsertionPlacement } from "@/components/canvas";
import { titleFromSlug } from "@/lib/slug";

function AppBreadcrumbs() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [, workspaceSlug, collectionsSegment, ...pathSegments] =
    pathname.split("/");
  const isInboxPath = collectionsSegment === "inbox";
  const isNestedCollectionPath =
    collectionsSegment === "collections" && pathSegments.length > 0;
  const [collectionSlug = "", ...folderSegments] = pathSegments;
  const folderPath = folderSegments.join("/");
  const { data: workspaceData } = useWorkspace(workspaceSlug ?? "");
  const { data: collectionContents } = useCollectionContents(
    workspaceSlug ?? "",
    collectionSlug,
    folderPath || undefined,
    { enabled: folderSegments.length > 0 },
  );

  const breadcrumbSegments = pathSegments.map((segment, index) => ({
    slug: segment,
    label:
      index === 0
        ? (workspaceData?.collections.find((c) => c.slug === segment)?.name ??
          titleFromSlug(segment))
        : (collectionContents?.breadcrumbs[index - 1]?.name ??
          titleFromSlug(segment)),
    path: pathSegments.slice(0, index + 1).join("/"),
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isInboxPath ? (
            <BreadcrumbPage>Inbox</BreadcrumbPage>
          ) : isNestedCollectionPath && workspaceSlug ? (
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
              <BreadcrumbSeparator>
                <span className="relative flex size-3.5 items-center justify-center before:absolute before:h-3 before:w-px before:[transform:rotate(20deg)] before:bg-current" />
              </BreadcrumbSeparator>
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
                        search={{ note: undefined, image: undefined }}
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
  const [, workspaceSlug, collectionsSegment, ...pathSegments] =
    pathname.split("/");
  const isCollectionsView = pathname === `/${workspaceSlug}`;
  const isBoardView =
    collectionsSegment === "collections" && pathSegments.length > 0;
  const collectionPath = pathSegments.join("/");
  const placement = useBoardInsertionPlacement(workspaceSlug, collectionPath);

  return (
    <header className="sticky top-0 z-20 flex h-14 min-w-0 shrink-0 items-center gap-2 bg-sidebar transition-[height] duration-120 ease-linear group-has-data-[state=collapsed]/sidebar-wrapper:h-12">
      <SidebarTrigger />
      <AppBreadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        {isCollectionsView ? (
          <CreateCollectionDialog workspaceSlug={workspaceSlug}>
            <Button type="button" size="sm">
              <PlusIcon />
              <span>New collection</span>
            </Button>
          </CreateCollectionDialog>
        ) : null}
        {isBoardView ? (
          <>
            <CreateNoteDialog
              workspaceSlug={workspaceSlug}
              collectionPath={collectionPath}
              restoreOpen
              placement={placement}
            >
              <Button type="button" size="sm" variant="outline">
                <FileTextIcon />
                <span>New note</span>
              </Button>
            </CreateNoteDialog>
            <UploadImagesDialog
              workspaceSlug={workspaceSlug}
              collectionPath={collectionPath}
              restoreOpen
              placement={placement}
            >
              <Button type="button" size="sm">
                <UploadIcon />
                <span>Upload</span>
              </Button>
            </UploadImagesDialog>
          </>
        ) : null}
      </div>
    </header>
  );
}
