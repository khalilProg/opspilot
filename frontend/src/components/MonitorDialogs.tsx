import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiError } from '../api/client'
import { useDeleteMonitor, useSaveMonitor } from '../hooks/useMonitorManagement'
import type { Monitor } from '../types/operations'

interface DialogProps {
  title: string
  busy: boolean
  onDismiss: () => void
  children: ReactNode
}

function MonitorDialog({ title, busy, onDismiss, children }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-line dialog-surface"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) {
          event.currentTarget.close()
          onDismiss()
        }
      }}
    >
      <div className="panel-heading">
        <h2 id={heading} className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </dialog>
  )
}

function DialogCancel({ disabled, onDismiss }: { disabled: boolean; onDismiss: () => void }) {
  return (
    <button type="button" className="button-secondary" disabled={disabled} onClick={(event) => {
      event.currentTarget.closest('dialog')?.close()
      onDismiss()
    }}>
      Cancel
    </button>
  )
}

export function MonitorActionError({ error }: { error: Error | null }) {
  if (!error) return null
  const apiError = error instanceof ApiError ? error : null
  return (
    <div role="alert" className="rounded-lg border border-line bg-bad-soft px-3 py-2 text-sm text-bad">
      <p>{apiError?.message ?? 'Couldn’t reach the gateway. Check the connection and try again.'}</p>
      {apiError?.requestId && <p className="mt-1 text-xs break-all">Request ID {apiError.requestId}</p>}
    </div>
  )
}

export function MonitorForm({
  monitor, onDismiss, onSaved,
}: {
  monitor?: Monitor
  onDismiss: () => void
  onSaved: (monitor: Monitor) => void
}) {
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)
  const [dirty, setDirty] = useState(false)
  const save = useSaveMonitor(monitor?.id)
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {}

  useEffect(() => {
    if (save.error) form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
  }, [save.error])

  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending) return
    const data = new FormData(event.currentTarget)
    save.mutate({
      name: String(data.get('name')).trim(),
      url: String(data.get('url')).trim(),
      intervalSeconds: Number(data.get('intervalSeconds')),
      timeoutSeconds: Number(data.get('timeoutSeconds')),
      enabled: data.has('enabled'),
    }, { onSuccess: onSaved })
  }

  const fields = [
    { name: 'name', label: 'Name', type: 'text', value: monitor?.name, maxLength: 100 },
    { name: 'url', label: 'URL', type: 'url', value: monitor?.url, maxLength: 2048 },
    { name: 'intervalSeconds', label: 'Check interval (seconds)', type: 'number', value: monitor?.intervalSeconds ?? 30 },
    { name: 'timeoutSeconds', label: 'Timeout (seconds)', type: 'number', value: monitor?.timeoutSeconds ?? 5 },
  ]

  return (
    <MonitorDialog title={monitor ? 'Edit monitor' : 'New monitor'} busy={save.isPending} onDismiss={onDismiss}>
      <form ref={form} autoComplete="off" onChange={() => setDirty(true)} onSubmit={submit} aria-busy={save.isPending}>
        <fieldset disabled={save.isPending} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {fields.map(({ name, label, type, value, maxLength }) => (
            <div key={name} className={type === 'number' ? '' : 'sm:col-span-2'}>
              <label htmlFor={`${formId}-${name}`} className="mb-1.5 block text-sm font-medium">{label}</label>
              <input
                id={`${formId}-${name}`}
                name={name}
                type={type}
                defaultValue={value}
                required
                min={type === 'number' ? 1 : undefined}
                max={type === 'number' ? 2_147_483_647 : undefined}
                maxLength={maxLength}
                spellCheck={type === 'url' ? false : undefined}
                inputMode={type === 'number' ? 'numeric' : undefined}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `${formId}-${name}-error` : undefined}
                className="field"
              />
              {errors[name] && <p id={`${formId}-${name}-error`} className="mt-1 text-sm text-bad">{errors[name]}</p>}
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
              <input type="checkbox" name="enabled" aria-invalid={Boolean(errors.enabled)} aria-describedby={errors.enabled ? `${formId}-enabled-error` : undefined} defaultChecked={monitor?.enabled ?? true} className="size-4 accent-accent" />
              <span className="text-sm font-medium">Enable checks</span>
            </label>
            {errors.enabled && <p id={`${formId}-enabled-error`} className="mt-1 text-sm text-bad">{errors.enabled}</p>}
          </div>
        </fieldset>
        {save.error && <div className="px-5 pb-4"><MonitorActionError error={save.error} /></div>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
          <DialogCancel disabled={save.isPending} onDismiss={onDismiss} />
          <button type="submit" className="button-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : monitor ? 'Save changes' : 'Create monitor'}
          </button>
        </div>
      </form>
    </MonitorDialog>
  )
}

export function DeleteMonitorDialog({
  monitor, onDismiss, onDeleted,
}: {
  monitor: Monitor
  onDismiss: () => void
  onDeleted: () => void
}) {
  const removal = useDeleteMonitor(monitor.id)
  return (
    <MonitorDialog title="Delete monitor" busy={removal.isPending} onDismiss={onDismiss}>
      <div className="space-y-3 px-5 py-4">
        <p className="wrap-anywhere">
          Delete <strong>{monitor.name}</strong> and its check history? This action is permanent.
        </p>
        <MonitorActionError error={removal.error} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
        <DialogCancel disabled={removal.isPending} onDismiss={onDismiss} />
        <button
          type="button"
          className="button-danger"
          disabled={removal.isPending}
          onClick={() => removal.mutate(undefined, { onSuccess: onDeleted })}
        >
          {removal.isPending ? 'Deleting…' : 'Delete monitor'}
        </button>
      </div>
    </MonitorDialog>
  )
}
