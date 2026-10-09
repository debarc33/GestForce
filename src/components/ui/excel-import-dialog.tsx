'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog'

export type ParsedImportRow<T> =
  | { row: number; ok: true; data: T }
  | { row: number; ok: false; message: string }

interface ExcelImportDialogProps<T> {
  open: boolean
  onOpenChange: (v: boolean) => void
  fileName: string
  rows: ParsedImportRow<T>[]
  entityLabel: string
  entityLabelPlural: string
  /**
   * Inserta o actualiza un registro válido. Si lanza, la fila se reporta como
   * error sin detener el resto. Puede devolver { _importAction: 'updated' }
   * (junto con los demás datos que quiera) cuando la fila completó/actualizó
   * un registro existente en vez de crear uno nuevo, para que el resumen
   * final distinga "creados" de "actualizados".
   */
  createFn: (data: T) => Promise<unknown>
  /** Se llama al cerrar el diálogo después de una importación (para invalidar queries, etc). */
  onDone: () => void
}

export function ExcelImportDialog<T>({
  open, onOpenChange, fileName, rows, entityLabel, entityLabelPlural, createFn, onDone,
}: ExcelImportDialogProps<T>) {
  const [phase, setPhase] = useState<'preview' | 'importing' | 'done'>('preview')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ created: number; updated: number; failed: { row: number; message: string }[] }>({ created: 0, updated: 0, failed: [] })
  const [didImport, setDidImport] = useState(false)

  const validRows = rows.filter((r): r is { row: number; ok: true; data: T } => r.ok)
  const invalidRows = rows.filter((r): r is { row: number; ok: false; message: string } => !r.ok)

  async function handleConfirm() {
    setPhase('importing')
    setProgress(0)
    let created = 0
    let updated = 0
    const failed: { row: number; message: string }[] = []
    for (const r of validRows) {
      try {
        const res = await createFn(r.data)
        if (res && typeof res === 'object' && (res as { _importAction?: string })._importAction === 'updated') {
          updated++
        } else {
          created++
        }
      } catch (e) {
        failed.push({ row: r.row, message: e instanceof Error ? e.message : 'Error desconocido.' })
      }
      setProgress(p => p + 1)
    }
    setResult({ created, updated, failed: [...invalidRows.map(r => ({ row: r.row, message: r.message })), ...failed] })
    setDidImport(true)
    setPhase('done')
  }

  function reset() {
    setPhase('preview')
    setProgress(0)
    setResult({ created: 0, updated: 0, failed: [] })
  }

  function handleClose() {
    onOpenChange(false)
    if (didImport) onDone()
    setDidImport(false)
    setTimeout(reset, 200)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg rounded-2xl shadow-xl border-zinc-100">
        {phase === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-zinc-900">
                Importar {entityLabelPlural} desde Excel
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                Archivo: <span className="font-mono">{fileName}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <p className="text-sm text-zinc-600">
                Se encontraron <strong>{rows.length}</strong> fila{rows.length === 1 ? '' : 's'}:{' '}
                <strong className="text-green-700">{validRows.length}</strong> lista{validRows.length === 1 ? '' : 's'} para importar
                {invalidRows.length > 0 && (
                  <> y <strong className="text-red-600">{invalidRows.length}</strong> con error{invalidRows.length === 1 ? '' : 'es'} (no se importar{invalidRows.length === 1 ? 'á' : 'án'})</>
                )}.
              </p>
              {invalidRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-2 space-y-1">
                  {invalidRows.slice(0, 20).map((r, i) => (
                    <p key={i} className="text-xs text-red-700">Fila {r.row}: {r.message}</p>
                  ))}
                  {invalidRows.length > 20 && (
                    <p className="text-xs text-red-500">...y {invalidRows.length - 20} más.</p>
                  )}
                </div>
              )}
              {rows.length === 0 && (
                <p className="text-sm text-zinc-500">El archivo no tiene filas de datos.</p>
              )}
            </div>
            <DialogFooter className="flex gap-2 justify-end mt-2">
              <button
                onClick={handleClose}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={validRows.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Importar {validRows.length} {validRows.length === 1 ? entityLabel : entityLabelPlural}
              </button>
            </DialogFooter>
          </>
        )}

        {phase === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-zinc-600">Importando {progress} de {validRows.length}...</p>
          </div>
        )}

        {phase === 'done' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <DialogTitle className="text-base font-semibold text-zinc-900">Importación completada</DialogTitle>
              </div>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <p className="text-sm text-zinc-600">
                {result.created > 0 && (
                  <>Se cre{result.created === 1 ? 'ó' : 'aron'} <strong className="text-green-700">{result.created}</strong>{' '}
                  {result.created === 1 ? entityLabel : entityLabelPlural} nuev{result.created === 1 ? 'o' : 'os'}.{' '}</>
                )}
                {result.updated > 0 && (
                  <>Se actualiz{result.updated === 1 ? 'ó' : 'aron'} <strong className="text-blue-700">{result.updated}</strong>{' '}
                  {result.updated === 1 ? entityLabel : entityLabelPlural} que ya exist{result.updated === 1 ? 'ía' : 'ían'}.</>
                )}
                {result.created === 0 && result.updated === 0 && 'No se creó ni actualizó ningún registro.'}
              </p>
              {result.failed.length > 0 && (
                <>
                  <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {result.failed.length} fila{result.failed.length === 1 ? '' : 's'} no se p{result.failed.length === 1 ? 'udo' : 'udieron'} importar:
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-2 space-y-1">
                    {result.failed.slice(0, 20).map((r, i) => (
                      <p key={i} className="text-xs text-red-700">Fila {r.row}: {r.message}</p>
                    ))}
                    {result.failed.length > 20 && (
                      <p className="text-xs text-red-500">...y {result.failed.length - 20} más.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <button
                onClick={handleClose}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
              >
                Entendido
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
