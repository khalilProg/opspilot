import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acknowledgeIncident, getCollection, getIncident, getIncidentTransitions, getMonitor, getMonitorChecks } from '../api/client'

const monitorRefreshInterval = 5_000
const incidentRefresh = { staleTime: 5_000, refetchInterval: 5_000 }

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
    ...incidentRefresh,
  })
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: ['incidents', id],
    queryFn: ({ signal }) => getIncident(id, signal),
    ...incidentRefresh,
  })
}

export function useIncidentTransitions(id: string) {
  return useQuery({
    queryKey: ['incidents', id, 'transitions'],
    queryFn: ({ signal }) => getIncidentTransitions(id, signal),
    ...incidentRefresh,
  })
}

export function useAcknowledgeIncident(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => acknowledgeIncident(id),
    onSettled: () => client.invalidateQueries({ queryKey: ['incidents'] }),
  })
}
