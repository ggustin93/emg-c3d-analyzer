import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { 
  PersonIcon, 
  HomeIcon, 
  BackpackIcon, 
  CalendarIcon, 
  ExitIcon,
  GearIcon,
  ExclamationTriangleIcon,
  SizeIcon
} from '@radix-ui/react-icons';

interface UserProfileProps {
  className?: string;
  compact?: boolean;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  className = '', 
  compact = false 
}) => {
  const { authState, logout, isLoading } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { profile, user } = authState;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const response = await logout();
      if (response.success) {
        setShowLogoutDialog(false);
      } else {
        console.error('Logout failed:', response.error);
        // Optionally show user-friendly error message
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'clinical_specialist':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'researcher':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'full':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'advanced':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'basic':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!user) {
    return null;
  }

  // Fallback profile data if profile is not loaded
  const displayProfile = profile || {
    full_name: user.email?.split('@')[0] || 'User',
    institution: 'Unknown',
    department: null,
    role: 'researcher',
    access_level: 'basic',
    created_at: user.created_at || new Date().toISOString(),
    last_login: null
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <PersonIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {displayProfile.full_name || user.email}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {displayProfile.institution || 'Researcher'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowLogoutDialog(true)}
          className="h-8 w-8 p-0"
        >
          <ExitIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className={`shadow-sm ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <PersonIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {displayProfile.full_name || 'Researcher'}
                </h3>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="secondary" 
                className={getRoleColor(displayProfile.role)}
              >
                {displayProfile.role.replace('_', ' ')}
              </Badge>
              <Badge 
                variant="secondary" 
                className={getAccessLevelColor(displayProfile.access_level)}
              >
                {displayProfile.access_level} access
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {displayProfile.institution && displayProfile.institution !== 'Unknown' && (
            <div className="flex items-center gap-2 text-sm">
              <HomeIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{displayProfile.institution}</span>
            </div>
          )}

          {displayProfile.department && (
            <div className="flex items-center gap-2 text-sm">
              <BackpackIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{displayProfile.department}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">
              Member since {formatDate(displayProfile.created_at)}
            </span>
          </div>

          {displayProfile.last_login && (
            <div className="flex items-center gap-2 text-sm">
              <SizeIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                Last login: {formatDate(displayProfile.last_login)}
              </span>
            </div>
          )}

          <div className="pt-3 border-t flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              disabled={isLoading}
            >
              <GearIcon className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowLogoutDialog(true)}
              disabled={isLoading}
              className="flex-1"
            >
              <ExitIcon className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
              Confirm Sign Out
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out? You'll lose access to researcher features until you sign in again.
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
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing out...</span>
                </div>
              ) : (
                'Sign Out'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserProfile;