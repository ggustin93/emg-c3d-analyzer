import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { SideNav } from '../navigation/SideNav'
import { 
  ArchiveIcon,
  BarChartIcon,
  InfoCircledIcon,
  PersonIcon,
  GroupIcon,
  DashboardIcon,
  QuestionMarkCircledIcon,
  GearIcon
} from '@radix-ui/react-icons'

interface SidebarLayoutProps {
  children: React.ReactNode
  activeTab?: string
}

// Navigation items for different roles
const therapistNavItems = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: DashboardIcon,
    description: 'Dashboard overview'
  },
  { 
    id: 'sessions', 
    label: 'Sessions', 
    icon: ArchiveIcon,
    description: 'C3D files & analysis'
  },
  { 
    id: 'patients', 
    label: 'Patients', 
    icon: PersonIcon,
    description: 'Patient management'
  },
  { 
    id: 'faq', 
    label: 'FAQ', 
    icon: QuestionMarkCircledIcon,
    description: 'Frequently asked questions'
  },
  { 
    id: 'about', 
    label: 'About', 
    icon: InfoCircledIcon,
    description: 'Trial information'
  }
]

const researcherNavItems = [
  { 
    id: 'sessions', 
    label: 'Sessions', 
    icon: ArchiveIcon,
    description: 'C3D files & analysis'
  },
  { 
    id: 'analytics', 
    label: 'Analytics', 
    icon: BarChartIcon,
    description: 'Custom analytics'
  },
  { 
    id: 'faq', 
    label: 'FAQ', 
    icon: QuestionMarkCircledIcon,
    description: 'Frequently asked questions'
  },
  { 
    id: 'about', 
    label: 'About', 
    icon: InfoCircledIcon,
    description: 'Trial information'
  }
]

const adminNavItems = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: DashboardIcon,
    description: 'System dashboard'
  },
  { 
    id: 'users', 
    label: 'Users', 
    icon: GroupIcon,
    description: 'User management'
  },
  { 
    id: 'patients', 
    label: 'Patients', 
    icon: PersonIcon,
    description: 'Patient management'
  },
  { 
    id: 'configuration', 
    label: 'Configuration', 
    icon: GearIcon,
    description: 'Trial settings'
  },
  { 
    id: 'sessions', 
    label: 'Sessions', 
    icon: ArchiveIcon,
    description: 'C3D files & analysis'
  }
]

export function SidebarLayout({ children, activeTab }: SidebarLayoutProps) {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Function to determine active tab based on current route
  const determineActiveTab = (): string => {
    const pathname = location.pathname
    const search = location.search
    
    // Check for specific routes first
    if (pathname.startsWith('/patients/') || pathname === '/patients') {
      return 'patients'
    }
    
    if (pathname.startsWith('/analysis') || pathname === '/analysis' || search.includes('file=')) {
      return 'sessions'
    }
    
    if (pathname === '/faq') {
      return 'faq'
    }
    
    if (pathname === '/about') {
      return 'about'
    }
    
    // If we have an explicit activeTab prop, use it
    if (activeTab) {
      return activeTab
    }
    
    // Check location state for activeTab
    const locationState = location.state as { activeTab?: string } | null
    if (locationState?.activeTab) {
      return locationState.activeTab
    }
    
    // Default based on role
    const normalizedRole = userRole?.toUpperCase()
    return normalizedRole === 'THERAPIST' || normalizedRole === 'ADMIN' ? 'overview' : 'sessions'
  }
  
  const currentActiveTab = determineActiveTab()
  
  // Handle navigation
  const handleTabChange = (tab: string) => {
    if (tab === 'faq') {
      // Navigate to FAQ page (only for therapists and researchers)
      navigate('/faq')
    } else {
      // Navigate to dashboard with specific tab
      // This includes: overview, patients, about, analytics, users, configuration, sessions
      navigate('/dashboard', { state: { activeTab: tab } })
    }
  }
  
  // Select navigation items based on role (handle both uppercase and lowercase)
  const normalizedRole = userRole?.toUpperCase()
  let navItems = researcherNavItems
  if (normalizedRole === 'THERAPIST') {
    navItems = therapistNavItems
  } else if (normalizedRole === 'ADMIN') {
    navItems = adminNavItems
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Side Navigation */}
      <div className="w-64 flex-shrink-0">
        <SideNav 
          activeTab={currentActiveTab} 
          onTabChange={handleTabChange}
          items={navItems}
          className="h-full"
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-white">
        {children}
      </div>
    </div>
  )
}