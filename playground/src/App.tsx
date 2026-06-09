import { useState, useCallback, useRef } from 'react'
import { DiagramPreview } from '@/components/DiagramPreview'
import { EditorPanel } from '@/components/EditorPanel'
import { sampleDSL } from '@/lib/sample-dsl'

export default function App() {
  const editorValueRef = useRef<string>(sampleDSL)
  const renderSourceRef = useRef<string>(sampleDSL)
  const [renderTick, setRenderTick] = useState(0)

  const handleEditorChange = useCallback((value: string) => {
    editorValueRef.current = value
    // Debounced sync for automatic renders
    clearTimeout((handleEditorChange as any)._timer)
    ;(handleEditorChange as any)._timer = setTimeout(() => {
      renderSourceRef.current = value
      setRenderTick((n) => n + 1)
    }, 300)
  }, [])

  const handleManualRender = useCallback(() => {
    // Read Monaco's current value directly to avoid stale state (rubber-duck C2)
    renderSourceRef.current = editorValueRef.current
    setRenderTick((n) => n + 1)
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

      {/* Top half: diagram */}
      <div key={renderTick} className="flex-1 min-h-0 overflow-hidden border-b border-gray-200 bg-white">
        <DiagramPreview dslText={renderSourceRef.current} />
      </div>

      {/* Bottom half: editor */}
      <div className="h-[45vh] shrink-0">
        <EditorPanel initialValue={sampleDSL} onChange={handleEditorChange} />
      </div>
    </div>
  )
}
