import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { SideNav } from '../navigation/SideNav'
import { 
  ArchiveIcon,
  BarChartIcon,
  InfoCircledIcon,
  PersonIcon,
  DashboardIcon
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
    id: 'about', 
    label: 'About', 
    icon: InfoCircledIcon,
    description: 'Trial information'
  }
]

export function SidebarLayout({ children, activeTab = 'sessions' }: SidebarLayoutProps) {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  
  // Handle navigation
  const handleTabChange = (tab: string) => {
    if (tab === 'sessions') {
      // Navigate to dashboard Sessions tab
      navigate('/dashboard')
    } else if (tab === 'overview' || tab === 'patients' || tab === 'about' || tab === 'analytics') {
      // Navigate to dashboard with specific tab
      navigate('/dashboard', { state: { activeTab: tab } })
    }
  }
  
  // Select navigation items based on role
  const navItems = userRole === 'THERAPIST' 
    ? therapistNavItems 
    : researcherNavItems
  
  // For admin role, just show the content without sidebar
  if (userRole === 'ADMIN') {
    return <>{children}</>
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Side Navigation */}
      <div className="w-72 flex-shrink-0">
        <SideNav 
          activeTab={activeTab} 
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