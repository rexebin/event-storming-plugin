import { useRef, useCallback, useEffect } from 'react'
import * as d3 from 'd3'
import { renderEventStorming } from '../../../src/render/index.js'
import type { DestroyableReturn } from '../../../src/render/models.js'

export function useRenderer(containerRef: React.RefObject<HTMLDivElement | null>) {
  const instanceRef = useRef<DestroyableReturn | null>(null)
  const abortRef = useRef(0)

  const render = useCallback(
    (dslText: string) => {
      if (!containerRef.current) return

      // Prevent overlapping renders — abort any in-flight work
      abortRef.current += 1
      const thisRenderId = abortRef.current

      // Destroy previous renderer and clear container
      instanceRef.current?.destroy()
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild)
      }

      // D3 will append SVG into the container synchronously, so this is safe.
      const selection = d3.select(containerRef.current)
      instanceRef.current = renderEventStorming(selection, dslText)

      // Guard: if a newer render started while we were here, discard result
      if (thisRenderId !== abortRef.current) return
    },
    [containerRef],
  )

  useEffect(() => {
    return () => {
      instanceRef.current?.destroy()
    }
  }, [])

  return { render }
}
