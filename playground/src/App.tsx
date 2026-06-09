import { useState, useCallback, useRef } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { DiagramPreview } from '@/components/DiagramPreview'
import { EditorPanel } from '@/components/EditorPanel'
import { sampleDSL } from '@/lib/sample-dsl'

const DEFAULT_EDITOR_RATIO = 0.45
const MIN_EDITOR_RATIO = 0.12

export default function App() {
  const editorValueRef = useRef<string>(sampleDSL)
  const renderSourceRef = useRef<string>(sampleDSL)
  // Force re-render when DSL changes, but keep DiagramPreview mounted (no key).
  // A plain state update triggers React reconciliation without unmounting child components.
  const [_, setDslTick] = useState(0)

  // Expose a test helper for E2E tests to programmatically change DSL content.
  ;(globalThis as any).__setPlaygroundDSL = (value: string) => {
    editorValueRef.current = value
    renderSourceRef.current = value
    setDslTick((n) => n + 1)
  }

  const handleEditorChange = useCallback((value: string) => {
    editorValueRef.current = value
    // Debounced sync for automatic renders
    clearTimeout((handleEditorChange as any)._timer)
    ;(handleEditorChange as any)._timer = setTimeout(() => {
      renderSourceRef.current = value
      setDslTick((n) => n + 1)
    }, 300)
  }, [])

  const handleManualRender = useCallback(() => {
    // Read Monaco's current value directly to avoid stale state (rubber-duck C2)
    renderSourceRef.current = editorValueRef.current
    setDslTick((n) => n + 1)
  }, [])

  const handleCopyDsl = useCallback(() => {
    navigator.clipboard.writeText(editorValueRef.current)
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2 bg-[#1e1e1e] text-white border-b border-gray-700 shrink-0">
        <h1 className="text-sm font-semibold">Event Storming Playground</h1>
        <span className="ml-auto text-xs text-gray-400">XML → D3 Diagram</span>
        <button
          onClick={handleManualRender}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
        >
          Render Now
        </button>
        <button
          onClick={handleCopyDsl}
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
        >
          Copy DSL
        </button>
      </header>

      {/* Resizable panels: diagram / editor */}
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={1 - DEFAULT_EDITOR_RATIO}>
          <div className="h-full min-h-0 overflow-hidden bg-white">
            <DiagramPreview dslText={renderSourceRef.current} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={MIN_EDITOR_RATIO} defaultSize={DEFAULT_EDITOR_RATIO}>
          <EditorPanel initialValue={sampleDSL} onChange={handleEditorChange} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
