import type { DetectionResult } from './types'

export type DetectionExportRow = DetectionResult & { fileName: string }

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

export function detectionsToJson(rows: DetectionExportRow[]) {
  return JSON.stringify(
    rows.map((row) => ({
      fileName: row.fileName,
      found: row.found,
      payload: row.payload,
      confidence: row.confidence,
      integrity: row.integrity,
      embeddedAt: row.embeddedAt ? new Date(row.embeddedAt).toISOString() : null,
      samples: row.samples,
      message: row.message,
    })),
    null,
    2,
  )
}

export function detectionsToCsv(rows: DetectionExportRow[]) {
  const header = 'fileName,found,payload,confidence,integrity,embeddedAt,samples,message'
  const lines = rows.map((row) =>
    [
      escapeCsv(row.fileName),
      String(row.found),
      escapeCsv(row.payload ?? ''),
      String(row.confidence),
      row.integrity,
      row.embeddedAt ? new Date(row.embeddedAt).toISOString() : '',
      String(row.samples),
      escapeCsv(row.message),
    ].join(','),
  )
  return [header, ...lines].join('\n')
}

export function downloadTextFile(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
