'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reverseJournalEntry } from '../actions'

export function ReverseButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const router = useRouter()

  const handleReverse = () => {
    if (!confirm('¿Crear asiento de reverso? Se generará un asiento contrario y este quedará marcado como revertido.')) return
    startTransition(async () => {
      const r = await reverseJournalEntry(entryId)
      if (r.error) { setError(r.error); return }
      router.push('/libro-diario')
    })
  }

  return (
    <div>
      {error && <p className="text-xs text-error mb-2">{error}</p>}
      <button
        onClick={handleReverse}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors text-sm font-medium disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        {isPending ? 'Revirtiendo...' : 'Revertir Asiento'}
      </button>
    </div>
  )
}
