'use client'

import * as Dialog from '@radix-ui/react-dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, description, children, maxWidth = 'max-w-lg' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" />
        <Dialog.Content
          className={`fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-xl w-full ${maxWidth} shadow-2xl max-h-[90vh] overflow-y-auto`}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border sticky top-0 bg-surface">
            <div>
              <Dialog.Title className="text-base font-bold text-text-primary">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-text-disabled mt-0.5">{description}</Dialog.Description>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-text-disabled hover:text-text-primary transition-colors p-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
