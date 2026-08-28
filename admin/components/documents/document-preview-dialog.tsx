'use client'

import { useRef, useState } from 'react'
import { Download, FileText, X } from 'lucide-react'

type Props = {
  title: string
  html: string | null
  isGenerating?: boolean
  onClose: () => void
}

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

function toDownloadName(title: string) {
  const stem = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${stem || 'tshelo-statement'}.pdf`
}

function makeSlice(source: HTMLCanvasElement, offset: number, height: number) {
  const slice = document.createElement('canvas')
  slice.width = source.width
  slice.height = height
  const context = slice.getContext('2d')
  if (!context) throw new Error('Could not prepare the PDF page.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, slice.width, slice.height)
  context.drawImage(source, 0, offset, source.width, height, 0, 0, slice.width, slice.height)
  return slice
}

function addFooter(pdf: import('jspdf').jsPDF, title: string, pageNumber: number) {
  pdf.setDrawColor(217, 213, 204)
  pdf.setLineWidth(0.2)
  pdf.line(13, 283, 197, 283)
  pdf.setTextColor(80, 88, 102)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6.5)
  pdf.text(`Tshelo Fund Statement · ${title}`, 13, 288)
  pdf.text(String(pageNumber), 197, 288, { align: 'right' })
}

export function DocumentPreviewDialog({ title, html, isGenerating = false, onClose }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  if (!isGenerating && !html) return null

  async function downloadPdf() {
    const frame = frameRef.current
    const sourceDocument = frame?.contentDocument
    if (!sourceDocument || isDownloading) return

    setIsDownloading(true)
    setDownloadError(null)

    const captureStyle = sourceDocument.createElement('style')
    captureStyle.textContent = `
      html{width:210mm!important;background:#fff!important}
      body{width:210mm!important;min-height:auto!important;padding:0!important;background:#fff!important}
      .cover,.page{width:210mm!important;min-height:297mm!important;margin:0!important;padding:14mm 13mm 18mm!important;break-before:auto!important;page-break-before:auto!important}
      .footer{display:none!important}
    `

    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      sourceDocument.head.appendChild(captureStyle)

      const reportPages = Array.from(sourceDocument.querySelectorAll<HTMLElement>('main.cover, section.page'))
      const sections = reportPages.length ? reportPages : [sourceDocument.body]
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      let writtenPages = 0

      await new Promise<void>(resolve => sourceDocument.defaultView?.requestAnimationFrame(() => resolve()) ?? resolve())

      for (const section of sections) {
        const width = Math.max(section.scrollWidth, section.offsetWidth)
        const height = Math.max(section.scrollHeight, section.offsetHeight)
        if (!width || !height) throw new Error('The statement preview is not ready yet.')

        const canvas = await html2canvas(section, {
          backgroundColor: '#ffffff',
          logging: false,
          scale: 2,
          useCORS: true,
          width,
          height,
          windowWidth: width,
        })
        const sourcePageHeight = Math.round(canvas.width * (A4_HEIGHT_MM / A4_WIDTH_MM))
        if (!sourcePageHeight || !canvas.height) throw new Error('Could not size the PDF page.')

        for (let offset = 0; offset < canvas.height; offset += sourcePageHeight) {
          const sliceHeight = Math.min(sourcePageHeight, canvas.height - offset)
          if (writtenPages > 0) pdf.addPage('a4', 'portrait')
          const slice = makeSlice(canvas, offset, sliceHeight)
          pdf.addImage(slice, 'PNG', 0, 0, A4_WIDTH_MM, sliceHeight / canvas.width * A4_WIDTH_MM, undefined, 'FAST')
          writtenPages += 1
          addFooter(pdf, title, writtenPages)
        }
      }

      pdf.save(toDownloadName(title))
    } catch (error) {
      console.error('Failed to create PDF download', error)
      setDownloadError('Could not prepare the PDF download. Please try again.')
    } finally {
      captureStyle.remove()
      setIsDownloading(false)
    }
  }

  return <div className="member-document-preview-backdrop" role="presentation">
    <section className="member-document-preview" role="dialog" aria-modal="true" aria-label={isGenerating ? 'Generating PDF' : `${title} PDF preview`}>
      {isGenerating ? <div className="member-document-generating">
        <span className="member-document-spinner" aria-hidden="true" />
        <FileText size={23} aria-hidden="true" />
        <h2>Generating your PDF</h2>
        <p>Preparing the complete statement and audit history for preview.</p>
      </div> : <>
        <header>
          <div><span>PDF preview</span><h2>{title}</h2>{downloadError ? <p className="member-document-download-error" role="alert">{downloadError}</p> : null}</div>
          <div className="member-document-preview-actions">
            <button type="button" className="primary" onClick={() => void downloadPdf()} disabled={isDownloading}><Download size={15} /> {isDownloading ? 'Preparing…' : 'Download PDF'}</button>
            <button type="button" onClick={onClose} aria-label="Close PDF preview"><X size={17} /></button>
          </div>
        </header>
        <iframe ref={frameRef} className="member-document-preview-frame" srcDoc={html ?? undefined} title={`${title} document preview`} />
      </>}
    </section>
  </div>
}
