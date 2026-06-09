import { cn } from '@/lib/utils'
import { Group as PanelGroup, Panel, Separator as ResizeHandle } from 'react-resizable-panels'

interface ResizablePanelGroupProps extends React.ComponentProps<typeof PanelGroup> {}
function ResizablePanelGroup({ className, ...props }: ResizablePanelGroupProps) {
  return (
    <PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        'h-full w-full data-[panel-group-direction=vertical]:flex',
        className,
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel {...props} />
}

interface ResizableHandleProps extends React.ComponentProps<typeof ResizeHandle> {
  withHandle?: boolean
}
function ResizableHandle({ withHandle, className, ...props }: ResizableHandleProps) {
  return (
    <ResizeHandle
      data-slot="resizable-handle"
      className={cn(
        'relative flex items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-full data-[panel-group-direction=vertical]:w-px data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-0 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-4 items-center justify-center rounded-sm border bg-border">
          <div className="h-[3px] w-2 -translate-y-[3px] rounded-full bg-muted-foreground" />
          <div className="mt-[3px] h-[3px] w-2 rounded-full bg-muted-foreground" />
        </div>
      )}
    </ResizeHandle>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
