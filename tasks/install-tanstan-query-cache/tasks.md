🚀 Plan to Implement TanStack Query v5 for TherapistOverview Caching                   │ │
│ │                                                                                        │ │
│ │ Problem Solved                                                                         │ │
│ │                                                                                        │ │
│ │ - No loading spinners on refresh - Cached data displayed instantly                     │ │
│ │ - Background data updates - Fresh data fetched while showing cached                    │ │
│ │ - Optimized network usage - Smart refetch control                                      │ │
│ │ - Better UX - Instant navigation and data persistence                                  │ │
│ │                                                                                        │ │
│ │ Implementation Plan                                                                    │ │
│ │                                                                                        │ │
│ │ Phase 1: Install & Setup TanStack Query                                                │ │
│ │                                                                                        │ │
│ │ 1. Install packages:                                                                   │ │
│ │ npm install @tanstack/react-query                                                      │ │
│ │ npm install -D @tanstack/react-query-devtools                                          │ │
│ │ 2. Create QueryClient with optimal settings:                                           │ │
│ │ // frontend/src/lib/queryClient.ts                                                     │ │
│ │ const queryClient = new QueryClient({                                                  │ │
│ │   defaultOptions: {                                                                    │ │
│ │     queries: {                                                                         │ │
│ │       staleTime: 5 * 60 * 1000,     // 5 minutes - data stays fresh                    │ │
│ │       gcTime: 10 * 60 * 1000,        // 10 minutes - cache retention                   │ │
│ │       retry: 1,                       // Retry failed requests once                    │ │
│ │       refetchOnWindowFocus: false,   // Don't refetch on tab focus                     │ │
│ │       refetchOnMount: true,           // Refetch if stale on mount                     │ │
│ │     }                                                                                  │ │
│ │   }                                                                                    │ │
│ │ })                                                                                     │ │
│ │ 3. Wrap App with QueryClientProvider:                                                  │ │
│ │ // frontend/src/App.tsx                                                                │ │
│ │ import { QueryClientProvider } from '@tanstack/react-query'                            │ │
│ │ import { queryClient } from './lib/queryClient'                                        │ │
│ │                                                                                        │ │
│ │ <QueryClientProvider client={queryClient}>                                             │ │
│ │   <App />                                                                              │ │
│ │ </QueryClientProvider>                                                                 │ │
│ │                                                                                        │ │
│ │ Phase 2: Convert useTherapistDashboardData Hook                                        │ │
│ │                                                                                        │ │
│ │ 1. Split into separate query functions:                                                │ │
│ │   - fetchTherapistPatients → query key: ['therapist', 'patients', therapistId]         │ │
│ │   - fetchRecentC3DFiles → query key: ['c3d', 'recent']                                 │ │
│ │   - fetchAdherence → query key: ['adherence', patientIds]                              │ │
│ │ 2. Use useQuery for each data fetch:                                                   │ │
│ │ // frontend/src/hooks/useTherapistDashboardData.ts                                     │ │
│ │ import { useQuery, useQueries } from '@tanstack/react-query'                           │ │
│ │                                                                                        │ │
│ │ const patientsQuery = useQuery({                                                       │ │
│ │   queryKey: ['therapist', 'patients', therapistId],                                    │ │
│ │   queryFn: () => fetchTherapistPatients(therapistId),                                  │ │
│ │   enabled: !!therapistId,                                                              │ │
│ │ })                                                                                     │ │
│ │                                                                                        │ │
│ │ const recentFilesQuery = useQuery({                                                    │ │
│ │   queryKey: ['c3d', 'recent'],                                                         │ │
│ │   queryFn: fetchRecentC3DFiles,                                                        │ │
│ │ })                                                                                     │ │
│ │                                                                                        │ │
│ │ // Use useQueries for parallel adherence fetching                                      │ │
│ │ const adherenceQueries = useQueries({                                                  │ │
│ │   queries: patientIds.map(id => ({                                                     │ │
│ │     queryKey: ['adherence', id],                                                       │ │
│ │     queryFn: () => fetchPatientAdherence(id),                                          │ │
│ │     enabled: patientIds.length > 0,                                                    │ │
│ │   }))                                                                                  │ │
│ │ })                                                                                     │ │
│ │                                                                                        │ │
│ │ Phase 3: Update TherapistOverview Component                                            │ │
│ │                                                                                        │ │
│ │ 1. Handle loading states gracefully:                                                   │ │
│ │ // Show cached data immediately, with subtle refresh indicator                         │ │
│ │ if (patientsQuery.isFetching && !patientsQuery.isLoading) {                            │ │
│ │   // Show small refresh indicator while keeping cached data visible                    │ │
│ │ }                                                                                      │ │
│ │ 2. Implement smart invalidation:                                                       │ │
│ │ // After C3D file upload or patient update                                             │ │
│ │ queryClient.invalidateQueries({ queryKey: ['therapist', 'patients'] })                 │ │
│ │ queryClient.invalidateQueries({ queryKey: ['c3d', 'recent'] })                         │ │
│ │                                                                                        │ │
│ │ Phase 4: Add DevTools (Development Only)                                               │ │
│ │                                                                                        │ │
│ │ // frontend/src/App.tsx                                                                │ │
│ │ import { ReactQueryDevtools } from '@tanstack/react-query-devtools'                    │ │
│ │                                                                                        │ │
│ │ {process.env.NODE_ENV === 'development' && (                                           │ │
│ │   <ReactQueryDevtools initialIsOpen={false} />                                         │ │
│ │ )}                                                                                     │ │
│ │                                                                                        │ │
│ │ Key Benefits of TanStack Query                                                         │ │
│ │                                                                                        │ │
│ │ 1. Automatic Caching: Data persists across component remounts                          │ │
│ │ 2. Stale-While-Revalidate: Show cached data instantly, update in background            │ │
│ │ 3. Smart Refetching: Control when to refetch (window focus, network reconnect)         │ │
│ │ 4. Deduplication: Multiple components requesting same data = 1 network call            │ │
│ │ 5. Optimistic Updates: Update UI immediately, sync with server later                   │ │
│ │ 6. Built-in Loading/Error States: Consistent state management                          │ │
│ │                                                                                        │ │
│ │ Files to Modify/Create                                                                 │ │
│ │                                                                                        │ │
│ │ 1. package.json - Add dependencies                                                     │ │
│ │ 2. frontend/src/lib/queryClient.ts - NEW: QueryClient configuration                    │ │
│ │ 3. frontend/src/App.tsx - Add QueryClientProvider wrapper                              │ │
│ │ 4. frontend/src/hooks/useTherapistDashboardData.ts - Convert to useQuery               │ │
│ │ 5. frontend/src/components/dashboards/therapist/TherapistOverview.tsx - Handle new     │ │
│ │ loading states                                                                         │ │
│ │                                                                                        │ │
│ │ Migration Strategy                                                                     │ │
│ │                                                                                        │ │
│ │ - Non-breaking: Keep existing hook interface initially                                 │ │
│ │ - Incremental: Convert one query at a time                                             │ │
│ │ - Backward compatible: Components using the hook won't need changes initially          │ │
│ │                                                                                        │ │
│ │ Expected Results                                                                       │ │
│ │                                                                                        │ │
│ │ - No loading spinners on refresh ✅                                                     │ │
│ │ - Instant data display with cached values ✅                                            │ │
│ │ - Background updates keep data fresh ✅                                                 │ │
│ │ - 5-minute cache reduces API calls by ~80% ✅                                           │ │
│ │ - Better perceived performance ✅                                                       │ │
│ ╰────────────────────────────────────────────────────────────────────────────────────────╯ │
│                                       
