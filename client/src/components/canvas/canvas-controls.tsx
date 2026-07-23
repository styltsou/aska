import { Panel, useReactFlow } from "@xyflow/react";
import {
  LockIcon,
  MinusIcon,
  PlusIcon,
  ScanIcon,
  UnlockIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FLOATING_GLASS_BACKDROP_CLASS,
  GLASS_FRAME_CLASS,
  GLASS_SURFACE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

const FIT_VIEW_MAX_ZOOM = 1.1;
const VIEWPORT_ANIMATION_DURATION = 150;

export function CanvasControls({
  isCanvasLocked,
  onCanvasLockChange,
}: {
  isCanvasLocked: boolean;
  onCanvasLockChange: (locked: boolean) => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-right" className="m-3">
      <div className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}>
        <div className={cn("relative z-10 rounded-lg p-1", GLASS_FRAME_CLASS)}>
          <div className={cn("relative z-10 rounded-md", GLASS_SURFACE_CLASS)}>
            <ButtonGroup orientation="vertical">
              <ControlButton
                ariaLabel="Zoom in"
                tooltip="Zoom in"
                onClick={() => {
                  void zoomIn({ duration: VIEWPORT_ANIMATION_DURATION });
                }}
              >
                <PlusIcon />
              </ControlButton>
              <ButtonGroupSeparator
                orientation="horizontal"
                className="bg-border/70"
              />
              <ControlButton
                ariaLabel="Zoom out"
                tooltip="Zoom out"
                onClick={() => {
                  void zoomOut({ duration: VIEWPORT_ANIMATION_DURATION });
                }}
              >
                <MinusIcon />
              </ControlButton>
              <ButtonGroupSeparator
                orientation="horizontal"
                className="bg-border/70"
              />
              <ControlButton
                ariaLabel="Fit collection"
                tooltip="Fit collection"
                onClick={() => {
                  void fitView({
                    padding: 0.18,
                    maxZoom: FIT_VIEW_MAX_ZOOM,
                    duration: VIEWPORT_ANIMATION_DURATION,
                  });
                }}
              >
                <ScanIcon />
              </ControlButton>
              <ButtonGroupSeparator
                orientation="horizontal"
                className="bg-border/70"
              />
              <ControlButton
                ariaLabel={isCanvasLocked ? "Unlock canvas" : "Lock canvas"}
                tooltip={isCanvasLocked ? "Unlock canvas" : "Lock canvas"}
                onClick={() => onCanvasLockChange(!isCanvasLocked)}
                isActive={isCanvasLocked}
              >
                {isCanvasLocked ? <LockIcon /> : <UnlockIcon />}
              </ControlButton>
            </ButtonGroup>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ControlButton({
  ariaLabel,
  tooltip,
  onClick,
  isActive = false,
  children,
}: {
  ariaLabel: string;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "transition-all duration-100 hover:bg-foreground/5 active:scale-95",
              isActive && "bg-foreground/8",
            )}
            aria-label={ariaLabel}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8} align="center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
