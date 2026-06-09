import { useRef, useEffect, useState } from 'react'
import { useRenderer } from '@/hooks/useRenderer'

interface DiagramPreviewProps {
  dslText: string
}

export function DiagramPreview({ dslText }: DiagramPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { render } = useRenderer(containerRef)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!dslText.trim()) return

    try {
      render(dslText)
      setError(null)
    } catch (e) {
      const msg = String((e as Error).message ?? e)
      setError(msg.length > 200 ? msg.slice(0, 200) + '...' : msg)
    }
  }, [dslText, render])

  return (
    <div className="playground-diagram">
      {error && (
        <div className="es-diagram-error" data-testid="diagram-error">
          <span>{error}</span>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}
