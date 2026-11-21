import { useQuery } from '@tanstack/react-query'
import { getCollection } from '../api/client'

export function useMonitors() {
  return useQuery({
    queryKey: ['monitors'],
    queryFn: ({ signal }) => getCollection('monitors', signal),
  })
}

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: ({ signal }) => getCollection('incidents', signal),
  })
}
