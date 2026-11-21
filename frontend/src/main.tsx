import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { DashboardLayout } from './layouts/DashboardLayout'
import { IncidentDetailPage } from './pages/IncidentDetailPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { MonitorsPage } from './pages/MonitorsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OverviewPage } from './pages/OverviewPage'
import './styles.css'

const MonitorDetailPage = lazy(() => import('./pages/MonitorDetailPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchInterval: 30_000, retry: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="monitors" element={<MonitorsPage />} />
            <Route path="monitors/:monitorId" element={
              <Suspense fallback={<p role="status">Loading monitor…</p>}>
                <MonitorDetailPage />
              </Suspense>
            } />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/:incidentId" element={<IncidentDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
