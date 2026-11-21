import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { createMonitor, deleteMonitor, setMonitorEnabled, updateMonitor } from '../api/client'
import type { Monitor, MonitorConfiguration } from '../types/operations'

const collectionKey = ['monitors']

async function cacheMonitor(client: QueryClient, monitor: Monitor) {
  await client.cancelQueries({ queryKey: collectionKey })
  client.setQueryData([...collectionKey, monitor.id], monitor)
  client.setQueryData<Monitor[]>(collectionKey, (current) => {
    if (!current) return undefined
    return current.some(({ id }) => id === monitor.id)
      ? current.map((item) => item.id === monitor.id ? monitor : item)
      : [...current, monitor]
  })
  void client.invalidateQueries({ queryKey: collectionKey, exact: true })
}

export function useSaveMonitor(id?: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (configuration: MonitorConfiguration) =>
      id ? updateMonitor(id, configuration) : createMonitor(configuration),
    onSuccess: (monitor) => cacheMonitor(client, monitor),
  })
}

export function useToggleMonitor(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => setMonitorEnabled(id, enabled),
    onSuccess: (monitor) => cacheMonitor(client, monitor),
  })
}

export function useDeleteMonitor(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => deleteMonitor(id),
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: collectionKey })
      client.setQueryData<Monitor[]>(collectionKey, (current) => current?.filter((item) => item.id !== id))
      client.removeQueries({ queryKey: [...collectionKey, id] })
      void client.invalidateQueries({ queryKey: collectionKey, exact: true })
    },
  })
}
