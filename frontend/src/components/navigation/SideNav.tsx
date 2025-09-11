import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  HomeIcon, 
  PersonIcon,
  GearIcon,
  ArchiveIcon,
  ExitIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog'
import Spinner from '@/components/ui/Spinner'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  description?: string
  badge?: string | number
}

interface SideNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
  items?: NavItem[]
  className?: string
}

const defaultItems: NavItem[] = [
  { 
    id: 'overview', 
    label: 'Overview', 
    icon: HomeIcon,
    description: 'Dashboard & metrics'
  },
  { 
    id: 'sessions', 
    label: 'Sessions', 
    icon: ArchiveIcon,
    description: 'C3D files & analysis',
    badge: 36
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

export function SideNav({ 
  activeTab, 
  onTabChange, 
  items = defaultItems,
  className 
}: SideNavProps) {
  const { user, userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setShowLogoutDialog(false)
    
    try {
      // Use the logout function from useAuth hook
      await logout()
      // Always navigate to login for immediate feedback
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      // Still navigate to login even on error
      navigate('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const displayProfile = {
    full_name: userProfile?.full_name || 
               (userProfile?.first_name && userProfile?.last_name 
                 ? `${userProfile.first_name} ${userProfile.last_name}` 
                 : user?.email?.split('@')[0] || 'User'),
    institution: userProfile?.institution || 'Unknown Institution',
    role: userProfile?.role || 'researcher'
  }

  return (
    <div className={cn(
      "flex flex-col h-full bg-gradient-to-b from-gray-50 to-white border-r border-gray-200",
      className
    )}>
      {/* Logo Section - Balanced spacing */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-center">
          <img 
            src="/ghostly_logo.png" 
            alt="Ghostly+ Logo" 
            className="h-28 w-28 object-contain"
          />
        </div>
      </div>
      
      {/* Header Section - Better visibility */}
      <div className="px-4 pb-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigation</h2>
      </div>
      
      {/* Navigation Items - Better readability and spacing */}
      <nav className="flex-1 px-3 pb-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full justify-start px-3 py-3 h-auto relative",
                "transition-all duration-200 rounded-lg",
                isActive ? [
                  "bg-gradient-to-r from-blue-50 via-blue-50/50 to-transparent",
                  "hover:from-blue-50",
                  "text-blue-700",
                  "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                  "before:w-1 before:h-6 before:bg-blue-600 before:rounded-r-full"
                ] : [
                  "hover:bg-gray-50",
                  "text-gray-600",
                  "hover:text-gray-900"
                ]
              )}
            >
              <div className="flex items-center gap-3 w-full">
                <Icon 
                  className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isActive ? "text-blue-600" : "text-gray-500"
                  )} 
                />
                <div className="flex-1 flex flex-col items-start text-left">
                  <div className="flex items-center gap-2 w-full">
                    <span className={cn(
                      "font-medium text-base",
                      isActive ? "text-gray-900" : "text-gray-700"
                    )}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={cn(
                        "ml-auto text-xs px-2 py-0.5 rounded-full font-medium",
                        isActive 
                          ? "bg-blue-100 text-blue-600" 
                          : "bg-gray-100 text-gray-500"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <span className={cn(
                      "text-xs mt-0.5 leading-relaxed",
                      isActive ? "text-gray-600" : "text-gray-500"
                    )}>
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
            </Button>
          )
        })}
      </nav>

      {/* User Profile Section - Balanced and readable */}
      <div className="border-t border-gray-200/50 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-gradient-to-br from-gray-100 to-gray-50 rounded-full flex items-center justify-center">
            <PersonIcon className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {displayProfile.full_name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {displayProfile.institution}
            </p>
          </div>
        </div>
        
        {/* Role badge centered below name with smaller font */}
        <div className="mb-3 text-center">
          <span className={cn(
            "inline-flex text-[11px] px-2.5 py-1 rounded-md font-medium capitalize",
            displayProfile.role === 'therapist' 
              ? "bg-green-100 text-green-700" 
              : displayProfile.role === 'admin'
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700"
          )}>
            {displayProfile.role.charAt(0).toUpperCase() + displayProfile.role.slice(1)}
          </span>
        </div>
        
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLogoutDialog(true)}
            className="text-xs h-8 px-4 text-gray-500 hover:text-red-600 hover:bg-red-50/70 transition-colors"
          >
            <ExitIcon className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Confirm Sign Out
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You'll need to sign in again to access your dashboard.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowLogoutDialog(false)}
              disabled={isLoggingOut}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="min-w-[100px]"
            >
              {isLoggingOut ? (
                <div className="flex items-center gap-2">
                  <Spinner />
                  <span>Signing out...</span>
                </div>
              ) : (
                'Sign Out'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Compact version for mobile/smaller screens
export function CompactSideNav({ 
  activeTab, 
  onTabChange, 
  items = defaultItems 
}: SideNavProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50/50 border-r border-gray-200">
      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full p-3",
                "transition-all duration-200",
                isActive ? [
                  "bg-white shadow-sm",
                  "hover:bg-white",
                  "text-blue-600"
                ] : [
                  "hover:bg-gray-100",
                  "text-gray-700",
                  "hover:text-gray-900"
                ]
              )}
              title={item.label}
            >
              <Icon 
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-blue-600" : "text-gray-500"
                )} 
              />
            </Button>
          )
        })}
      </nav>
    </div>
  )
}

export default SideNav