import type { UseQueryResult } from '@tanstack/react-query'
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '../api/client'

interface QueryStateProps<T> {
  query: UseQueryResult<T[]>
  subject: string
  emptyMessage: string
  children: (data: T[]) => ReactNode
}

export function QueryState<T>({ query, subject, emptyMessage, children }: QueryStateProps<T>) {
  if (query.isPending) {
    return (
      <div role="status" className="flex min-h-44 items-center justify-center gap-2 px-5 py-8 text-muted">
        <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
        Loading {subject}…
      </div>
    )
  }

  if (query.isError) {
    const error = query.error instanceof ApiError ? query.error : null
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
        <div role="alert">
          <CircleAlert aria-hidden="true" className="mx-auto mb-3 size-6 text-rose-700" />
          <p className="font-semibold">Couldn’t load {subject}</p>
          <p className="mt-1 text-sm text-muted">{error?.message ?? 'Couldn’t reach the gateway.'}</p>
          {error?.requestId && <p className="mt-1 text-xs text-muted break-all">Request ID {error.requestId}</p>}
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-accent hover:bg-blue-50 disabled:opacity-60"
        >
          {query.isFetching ? 'Retrying…' : 'Try again'}
        </button>
      </div>
    )
  }

  if (query.data.length === 0) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-5 py-8 text-center text-muted">
        <span className="grid size-10 place-items-center rounded-full bg-canvas">
          <Inbox aria-hidden="true" className="size-5" />
        </span>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return children(query.data)
}
