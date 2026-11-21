import { useQuery } from '@tanstack/react-query'
import { getCollection, getMonitor, getMonitorChecks } from '../api/client'

const monitorRefreshInterval = 5_000

export function useMonitors() {
  return useQuery({
    queryKey: ['monitors'],
    queryFn: ({ signal }) => getCollection('monitors', signal),
    staleTime: monitorRefreshInterval,
    refetchInterval: monitorRefreshInterval,
  })
}

export function useMonitor(id: string) {
  return useQuery({
    queryKey: ['monitors', id],
    queryFn: ({ signal }) => getMonitor(id, signal),
    staleTime: monitorRefreshInterval,
    refetchInterval: monitorRefreshInterval,
  })
}

export function useMonitorChecks(id: string) {
  return useQuery({
    queryKey: ['monitors', id, 'checks'],
    queryFn: ({ signal }) => getMonitorChecks(id, signal),
    staleTime: monitorRefreshInterval,
    refetchInterval: monitorRefreshInterval,
  })
}

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: ({ signal }) => getCollection('incidents', signal),
  })
}
