import React from 'react';
import { 
  createBrowserRouter, 
  RouterProvider, 
  Outlet,
  useLoaderData,
  useOutletContext,
  Navigate,
  useNavigate,
  useLocation,
  useNavigation
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { rootLoader, protectedLoader, publicLoader } from './routes/loaders';
import { loginAction } from './routes/actions';
import LoginPage from './components/auth/LoginPage';
import Header from './components/layout/Header';
import Spinner from './components/ui/Spinner';
import { GitHubLogoIcon } from '@radix-ui/react-icons';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load dashboard components for better performance
const AdminDashboard = React.lazy(() => import('./components/dashboards/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const TherapistDashboard = React.lazy(() => import('./components/dashboards/therapist/TherapistDashboard').then(module => ({ default: module.TherapistDashboard })));
const ResearcherDashboard = React.lazy(() => import('./components/dashboards/researcher/ResearcherDashboard').then(module => ({ default: module.ResearcherDashboard })));

// Import analysis content and layout
import { AppContent as AnalysisView } from './AppContent';
import { SidebarLayout } from './components/layout/SidebarLayout';

// Import patient profile component
import { PatientProfile } from './components/dashboards/therapist/PatientProfile';

// Navigation Progress Bar Component (SOLID: Single Responsibility)
function NavigationProgress() {
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';
  
  return isNavigating ? (
    <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 animate-pulse z-50 shadow-sm" />
  ) : null;
}

// Root layout that provides auth context
function RootLayout() {
  const authData = useLoaderData() as Awaited<ReturnType<typeof rootLoader>>;
  
  // Pass auth data through context for child components
  return (
    <>
      <NavigationProgress />
      <Outlet context={authData} />
    </>
  );
}

// Public layout with header for login page
function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <Header isAuthenticated={false} />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

// Protected layout with header and role-based access
function DashboardLayout() {
  const authData = useLoaderData() as Awaited<ReturnType<typeof protectedLoader>>;
  const userRole = authData?.profile?.role || 'researcher';
  const location = useLocation();
  
  // Read activeTab from navigation state for sidebar highlighting
  const activeTab = location.state?.activeTab || 'sessions';
  
  // SOLID: Single Responsibility - One layout handles all protected routes
  // This eliminates duplicate SideNav rendering by using consistent layout pattern
  
  // Admin users get traditional layout with header/footer
  if (userRole === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
        <Header isAuthenticated={true} />
        <main className="flex-1">
          <Outlet context={{ ...authData, userRole }} />
        </main>
        <Footer />
      </div>
    );
  }
  
  // Therapist and Researcher use SidebarLayout for ALL routes (dashboard + analysis)
  // This prevents duplicate navigation by having ONE consistent layout
  return (
    <div className="min-h-screen bg-slate-50">
      <SidebarLayout activeTab={activeTab}>
        <Outlet context={{ ...authData, userRole }} />
      </SidebarLayout>
    </div>
  );
}

// Dashboard component that renders based on role
function Dashboard() {
  const { userRole } = useOutletContext<{ userRole: string }>();
  const location = useLocation();
  
  // Read activeTab from navigation state (for Analytics/About tabs)
  const activeTab = location.state?.activeTab || 'sessions';
  
  const DashboardLoadingFallback = (
    <div className="p-6 flex items-center justify-center">
      <Spinner />
      <span className="ml-3 text-slate-600">Loading dashboard...</span>
    </div>
  );
  
  // Handle navigation to analysis view using React Router
  const navigate = useNavigate();
  const handleAnalysisNavigation = (filename: string, uploadDate?: string) => {
    // Navigate to analysis route with params using React Router
    const searchParams = new URLSearchParams();
    searchParams.set('file', filename);
    if (uploadDate) {
      searchParams.set('date', uploadDate);
    }
    // Use React Router navigation for SPA behavior
    navigate(`/analysis?${searchParams.toString()}`);
  };
  
  switch (userRole) {
    case 'admin':
      return (
        <React.Suspense fallback={DashboardLoadingFallback}>
          <AdminDashboard />
        </React.Suspense>
      );
    case 'therapist':
      return (
        <React.Suspense fallback={DashboardLoadingFallback}>
          <TherapistDashboard activeTab={activeTab} />
        </React.Suspense>
      );
    case 'researcher':
    default:
      return (
        <React.Suspense fallback={DashboardLoadingFallback}>
          <ResearcherDashboard 
            onQuickSelect={handleAnalysisNavigation} 
            activeTab={activeTab}
          />
        </React.Suspense>
      );
  }
}

// Footer component
function Footer() {
  return (
    <footer className="bg-white shadow-sm border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="flex items-center gap-6">
            <img 
              src="/vub_etro_logo.png" 
              alt="VUB ETRO Logo" 
              className="h-16 object-contain"
            />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-slate-700 font-medium text-center">
              ETRO Electronics & Informatics
            </p>
            <p className="text-xs text-slate-500 text-center">
              Vrije Universiteit Brussel (VUB)
            </p>
          </div>
          
          <div className="text-xs text-slate-400 space-y-1 text-center">
            <p>Developed for rehabilitation research and therapy assessment</p>
            <p>© {new Date().getFullYear()} VUB. All rights reserved.</p>
          </div>
          
          <div className="flex items-center gap-4 pt-2">
            <a 
              href="https://github.com/ggustin93/emg-c3d-analyzer" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-slate-600 hover:text-slate-800 transition-colors text-xs"
            >
              <GitHubLogoIcon className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Create the router with all routes
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    loader: rootLoader,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'login',
        element: <PublicLayout />,
        loader: publicLoader,
        children: [
          {
            index: true,
            element: <LoginPage />,
            action: loginAction
          }
        ]
      },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        loader: protectedLoader,
        children: [
          {
            index: true,
            element: <Dashboard />
          }
        ]
      },
      {
        path: 'analysis',
        element: <DashboardLayout />,
        loader: protectedLoader,
        children: [
          {
            index: true,
            element: <AnalysisView />
          }
        ]
      },
      {
        path: 'patients/:patientId',
        element: <DashboardLayout />,
        loader: protectedLoader,
        children: [
          {
            index: true,
            element: <PatientProfile />
          }
        ]
      }
    ]
  }
]);

// Main App component
function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;