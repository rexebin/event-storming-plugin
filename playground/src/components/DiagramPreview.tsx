import { useRef, useEffect } from 'react'
import { useRenderer } from '@/hooks/useRenderer'

interface DiagramPreviewProps {
  dslText: string
}

export function DiagramPreview({ dslText }: DiagramPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { render } = useRenderer(containerRef)

  useEffect(() => {
    if (dslText.trim()) {
      render(dslText)
    }
  }, [dslText, render])

  return (
    <div className="playground-diagram">
      <div ref={containerRef} />
    </div>
  )
}
