import { useEffect, useRef, useState } from 'react'

// Renders a PDF to canvases with PDF.js so the preview matches the app's design on every device,
// instead of the browser's own PDF viewer.
// onFill gets how far down the last page the text reaches, from 0 to 1.
export function PdfPages({
  url,
  onFill,
}: {
  url: string
  onFill?: (fill: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = container.current
    if (!element || width === 0) return
    const run = { cancelled: false }

    ;(async () => {
      const pdfjs = await import('pdfjs-dist')
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const task = pdfjs.getDocument({ url })
      const doc = await task.promise
      const canvases: HTMLCanvasElement[] = []
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number)
        const base = page.getViewport({ scale: 1 })
        const scale = width / base.width
        const ratio = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: scale * ratio })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${width}px`
        canvas.style.height = `${(viewport.height / ratio).toFixed(0)}px`
        canvas.className = 'rounded-sm bg-white shadow-sm ring-1 ring-black/5'
        canvas.setAttribute('aria-label', `Page ${number} of ${doc.numPages}`)
        canvas.setAttribute('role', 'img')
        // The print intent renders in one pass instead of pacing with animation frames,
        // which browsers pause in background tabs.
        await page.render({ canvas, viewport, intent: 'print' }).promise
        canvases.push(canvas)
      }
      if (!run.cancelled) element.replaceChildren(...canvases)
      const last = await doc.getPage(doc.numPages)
      const { height } = last.getViewport({ scale: 1 })
      const baselines = (await last.getTextContent()).items.flatMap((item) =>
        'str' in item && item.str.trim() ? [item.transform[5] as number] : [],
      )
      if (!run.cancelled && baselines.length)
        onFill?.(1 - Math.min(...baselines) / height)
      await task.destroy()
    })().catch(() => {
      // A newer render replaced this one, or the PDF failed to load; the previous pages stay visible.
    })

    return () => {
      run.cancelled = true
    }
  }, [url, width, onFill])

  return <div ref={container} className="flex w-full flex-col gap-4" />
}
