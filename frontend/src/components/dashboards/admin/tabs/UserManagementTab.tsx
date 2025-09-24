/**
 * User Management Tab Component
 * 
 * Purpose: Manage users with direct Supabase integration
 * Architecture: Direct Supabase for most operations, FastAPI for admin-only actions
 * Features: Role management, temporary passwords, user creation
 * 
 * Security Note: User deletion is intentionally not implemented in this interface.
 * Deletion should be handled through Supabase Studio by technical team to ensure
 * proper data integrity and audit trail maintenance.
 */

import { useState, useEffect, useMemo } from 'react'
import { API_CONFIG } from '@/config/apiConfig'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/services/adminAuditService'
import { getAvatarColor, getPatientIdentifier, getPatientAvatarInitials } from '@/lib/avatarColors'
import * as Icons from '@radix-ui/react-icons'

interface UserProfile {
  id: string
  role: 'admin' | 'therapist' | 'researcher'
  first_name: string | null
  last_name: string | null
  institution: string | null
  department: string | null
  access_level: string | null
  active: boolean
  created_at: string
  last_sign_in_at: string | null
  user_code: string | null
  email: string  // Now guaranteed from RPC function
}

interface CreateUserForm {
  email: string
  firstName: string
  lastName: string
  role: 'therapist' | 'researcher' | 'admin'
  institution: string
  department: string
}

interface EditUserForm {
  firstName: string
  lastName: string
  role: 'therapist' | 'researcher' | 'admin'
  institution: string
  department: string
  accessLevel: string
  active: boolean
}

export function UserManagementTab() {
  const { toast } = useToast()
  const { userRole, userProfile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [showSecurityWarningDialog, setShowSecurityWarningDialog] = useState(false)
  const [showDeleteInfoDialog, setShowDeleteInfoDialog] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
    adminNote: ''
  })
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'therapist',
    institution: '',
    department: ''
  })
  const [createPasswordForm, setCreatePasswordForm] = useState({
    useCustomPassword: false,
    customPassword: '',
    confirmPassword: '',
    adminNote: ''
  })

  // Sorting state
  const [sortField, setSortField] = useState<keyof UserProfile | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Patient assignment state
  const [showPatientsDialog, setShowPatientsDialog] = useState(false)
  const [assignedPatients, setAssignedPatients] = useState<any[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [editForm, setEditForm] = useState<EditUserForm>({
    firstName: '',
    lastName: '',
    role: 'therapist',
    institution: '',
    department: '',
    accessLevel: 'basic',
    active: true
  })
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      // Use RPC function to safely get user data with emails
      const { data, error } = await supabase
        .rpc('get_users_with_emails')

      if (error) {
        console.error('Error loading users:', error)
        toast({
          title: 'Error',
          description: 'Failed to load users. Make sure you have admin privileges.',
          variant: 'destructive'
        })
        return
      }

      // Data already includes emails and all fields from RPC function
      setUsers(data || [])
    } catch (error) {
      console.error('Failed to load users:', error)
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    try {
      // Check if email already exists in the current user list
      const emailExists = users.some(user => user.email.toLowerCase() === createForm.email.toLowerCase())
      if (emailExists) {
        toast({
          title: 'Email Already Exists',
          description: 'A user with this email address already exists. Please use a different email.',
          variant: 'destructive'
        })
        return
      }

      // Validate custom password if enabled
      if (createPasswordForm.useCustomPassword) {
        if (createPasswordForm.customPassword !== createPasswordForm.confirmPassword) {
          toast({
            title: 'Password Mismatch',
            description: 'Passwords do not match',
            variant: 'destructive'
          })
          return
        }

        if (createPasswordForm.customPassword.length < 8) {
          toast({
            title: 'Password Too Short',
            description: 'Password must be at least 8 characters long',
            variant: 'destructive'
          })
          return
        }
      }

      // Get valid session (with refresh handling)
      const activeSession = await getValidSession()

      console.log('Creating user with session:', {
        hasToken: !!activeSession.access_token,
        tokenLength: activeSession.access_token?.length,
        userEmail: activeSession.user?.email,
        userId: activeSession.user?.id,
        userRole: userRole,
        userProfile: userProfile
      })

      // Check if user has admin role
      if (userRole !== 'ADMIN') {
        throw new Error(`Access denied. Current role: ${userRole}. Admin role required.`)
      }

      // Call backend API to create user with service key
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeSession.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: createForm.email,
          first_name: createForm.firstName,
          last_name: createForm.lastName,
          role: createForm.role,
          institution: createForm.institution,
          department: createForm.department,
          notify_user: false,
          custom_password: createPasswordForm.useCustomPassword ? createPasswordForm.customPassword : null,
          admin_note: createPasswordForm.adminNote
        })
      })

      if (!response.ok) {
        console.error('User creation failed:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        })
        
        let errorMessage = 'Failed to create user'
        try {
          const error = await response.json()
          console.error('Error response:', error)
          errorMessage = error.detail || error.message || errorMessage
        } catch (e) {
          console.error('Could not parse error response:', e)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()

      // Show success message with kPaste recommendation
      const passwordMessage = createPasswordForm.useCustomPassword 
        ? `Custom password set. Use kPaste (https://kpaste.infomaniak.com/) to securely share the password with the user.`
        : `User ${createForm.email} created. Check the Password Vault to retrieve their temporary password for manual delivery. Use kPaste (https://kpaste.infomaniak.com/) for secure password sharing. User code: ${result.user_code || 'N/A'}`
      
        toast({
          title: 'User Created Successfully',
          description: `${createForm.firstName} ${createForm.lastName} (${createForm.email}) has been created as a ${createForm.role}. ${passwordMessage}`,
          variant: 'success'
        })

      // Reset form and reload users
      setShowCreateDialog(false)
      setCreateForm({
        email: '',
        firstName: '',
        lastName: '',
        role: 'therapist',
        institution: '',
        department: ''
      })
      setCreatePasswordForm({
        useCustomPassword: false,
        customPassword: '',
        confirmPassword: '',
        adminNote: ''
      })
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to create user:', error)
      
      // Handle specific error types
      if (error.message.includes('Session expired') || error.message.includes('Please log in again')) {
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please refresh the page and log in again.',
          variant: 'destructive'
        })
      } else if (error.message.includes('already been registered') || error.message.includes('email address')) {
        toast({
          title: 'Email Already Exists',
          description: 'A user with this email address already exists. Please use a different email.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Error',
          description: `Failed to create user: ${error.message}`,
          variant: 'destructive'
        })
      }
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return

    try {
      // Get valid session (with refresh handling)
      const activeSession = await getValidSession()

      const response = await fetch(`${API_CONFIG.baseUrl}/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${activeSession.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          role: editForm.role,
          institution: editForm.institution,
          department: editForm.department,
          access_level: editForm.accessLevel,
          active: editForm.active
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to update user')
      }

      const result = await response.json()

        toast({
          title: 'User Updated Successfully',
          description: `${editForm.firstName} ${editForm.lastName}'s profile has been updated successfully.`,
          variant: 'success'
        })

      setShowEditDialog(false)
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to update user:', error)
      
      // Handle specific error types
      if (error.message.includes('Session expired') || error.message.includes('Please log in again')) {
        toast({
          title: 'Session Expired',
          description: 'Please log in again to continue',
          variant: 'destructive'
        })
        return
      }
      
      toast({
        title: 'Error',
        description: `Failed to update user: ${error.message}`,
        variant: 'destructive'
      })
    }
  }

  const handleSetTemporaryPassword = async () => {
    if (!selectedUser) return

    // Validate password
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive'
      })
      return
    }

    try {
      // Get valid session (with refresh handling)
      const activeSession = await getValidSession()

      // Call the backend admin API to reset password
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeSession.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          new_password: passwordForm.newPassword,
          delivery_method: 'manual',  // For small clinical deployments
          admin_note: passwordForm.adminNote || 'Will deliver via WhatsApp or in-person'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to reset password')
      }

      const result = await response.json()
      
      // SECURITY: Password has been reset successfully
      const isSelfReset = selectedUser?.id === userProfile?.id
      toast({
        title: 'Password Reset Successful',
        description: isSelfReset 
          ? `Your own password has been reset. You will be logged out and must use the new password on your next login.`
          : `Password reset for ${selectedUser.first_name} ${selectedUser.last_name} (${selectedUser.email}). The user will be logged out and must use the new password on their next login. Use kPaste (https://kpaste.infomaniak.com/) for secure password delivery.`,
        variant: 'success'
      })

      setShowPasswordDialog(false)
      setShowSecurityWarningDialog(false)
      setPasswordForm({ newPassword: '', confirmPassword: '', adminNote: '' })
      
      // Refresh the user list to show any status changes
      loadUsers()
      
    } catch (error: any) {
      console.error('Failed to reset password:', error)
      
      // Handle session expiration specially
      if (error.message.includes('Session expired') || error.message.includes('Please log in again')) {
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please refresh the page and log in again.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to reset password',
          variant: 'destructive'
        })
      }
    }
  }

  const handlePasswordDialogOpen = () => {
    setShowSecurityWarningDialog(true)
  }

  const handleSecurityWarningAcknowledge = () => {
    setShowSecurityWarningDialog(false)
    setShowPasswordDialog(true)
  }

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPasswordForm(prev => ({ ...prev, newPassword: password, confirmPassword: password }))
  }

  const generateCreatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCreatePasswordForm(prev => ({ ...prev, customPassword: password, confirmPassword: password }))
  }

  const getValidSession = async () => {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      throw new Error(`Session error: ${sessionError.message}`)
    }
    
    if (!session) {
      throw new Error('No active session. Please log in again.')
    }

    // Try to refresh the session, but don't fail if refresh token is invalid
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.warn('Session refresh failed, using current session:', refreshError.message)
        // If refresh fails, try to use the current session
        if (session.access_token) {
          return session
        } else {
          throw new Error('Session expired. Please log in again.')
        }
      }
      
      return refreshedSession || session
    } catch (refreshError) {
      console.warn('Session refresh failed, using current session:', refreshError)
      // If refresh fails completely, try to use the current session
      if (session.access_token) {
        return session
      } else {
        throw new Error('Session expired. Please log in again.')
      }
    }
  }


  // Handle sorting
  const handleSort = (field: keyof UserProfile) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Load assigned patients for a therapist
  const loadAssignedPatients = async (therapistId: string) => {
    setLoadingPatients(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          patient_code,
          age_group,
          gender,
          pathology_category,
          created_at,
          last_assessment_date,
          treatment_start_date,
          total_sessions_planned,
          active,
          patient_medical_info!inner(
            first_name,
            last_name
          )
        `)
        .eq('therapist_id', therapistId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAssignedPatients(data || [])
      setShowPatientsDialog(true)
    } catch (error) {
      console.error('Error loading assigned patients:', error)
      toast({
        title: 'Error',
        description: 'Failed to load assigned patients',
        variant: 'destructive'
      })
    } finally {
      setLoadingPatients(false)
    }
  }

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let filtered = users
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = users.filter(user => 
        user.email?.toLowerCase().includes(search) ||
        user.first_name?.toLowerCase().includes(search) ||
        user.last_name?.toLowerCase().includes(search) ||
        user.institution?.toLowerCase().includes(search) ||
        user.role.toLowerCase().includes(search)
      )
    }
    
    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue = a[sortField]
        let bValue = b[sortField]
        
        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0
        if (aValue == null) return sortDirection === 'asc' ? 1 : -1
        if (bValue == null) return sortDirection === 'asc' ? -1 : 1
        
        // Convert to strings for comparison
        aValue = String(aValue).toLowerCase()
        bValue = String(bValue).toLowerCase()
        
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }
    
    return filtered
  }, [users, searchTerm, sortField, sortDirection])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Brussels'
    })
  }

  const getRoleBadgeClassName = (role: string) => {
    switch (role) {
      case 'admin': return 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100 shadow-sm'
      case 'therapist': return 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 shadow-sm'
      case 'researcher': return 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100 shadow-sm'
      default: return 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 shadow-sm'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Icons.LockClosedIcon className="h-3 w-3 mr-1" />
      case 'therapist': return <Icons.PersonIcon className="h-3 w-3 mr-1" />
      case 'researcher': return <Icons.MagnifyingGlassIcon className="h-3 w-3 mr-1" />
      default: return <Icons.PersonIcon className="h-3 w-3 mr-1" />
    }
  }

  // Render sortable header
  const renderSortableHeader = (field: keyof UserProfile, label: string) => {
    const isActive = sortField === field
    const isAsc = isActive && sortDirection === 'asc'
    const isDesc = isActive && sortDirection === 'desc'
    
    return (
      <TableHead 
        className="cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            isAsc ? (
              <Icons.CaretUpIcon className="h-4 w-4" />
            ) : (
              <Icons.CaretDownIcon className="h-4 w-4" />
            )
          ) : (
            <Icons.CaretUpIcon className="h-4 w-4 opacity-30" />
          )}
        </div>
      </TableHead>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.PersonIcon className="h-5 w-5 text-blue-500" />
            All Users
            <Badge variant="secondary" className="ml-auto">
              {filteredUsers.length} users
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Add Button Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Icons.MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowCreateDialog(true)}>
                <Icons.PlusIcon className="mr-2 h-4 w-4" />
                Add New User
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {renderSortableHeader('first_name' as keyof UserProfile, 'Name')}
                {renderSortableHeader('role' as keyof UserProfile, 'Role')}
                {renderSortableHeader('institution' as keyof UserProfile, 'Institution')}
                {renderSortableHeader('email' as keyof UserProfile, 'Email')}
                {renderSortableHeader('created_at' as keyof UserProfile, 'Created')}
                {renderSortableHeader('last_sign_in_at' as keyof UserProfile, 'Last Login')}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm flex-shrink-0">
                        <AvatarFallback className={`${getAvatarColor(getPatientIdentifier({
                          patient_code: user.email?.split('@')[0] || 'unknown',
                          first_name: user.first_name,
                          last_name: user.last_name,
                          display_name: user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.email?.split('@')[0] || 'Unknown'
                        }))} text-white font-semibold text-xs`}>
                          {getPatientAvatarInitials(user.first_name, user.last_name, user.email?.split('@')[0])}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {user.first_name || user.last_name 
                            ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                            : 'No name'}
                        </div>
                        {user.user_code && (
                          <div className="text-xs text-muted-foreground truncate">{user.user_code}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-start">
                      <Badge variant="outline" className={`${getRoleBadgeClassName(user.role)} inline-flex items-center`}>
                        {getRoleIcon(user.role)}
                        <span className="capitalize">{user.role}</span>
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{user.institution || '-'}</TableCell>
                  <TableCell>
                    <a 
                      href={`mailto:${user.email}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {user.email}
                    </a>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center justify-start gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setEditForm({
                                  firstName: user.first_name || '',
                                  lastName: user.last_name || '',
                                  role: user.role,
                                  institution: user.institution || '',
                                  department: user.department || '',
                                  accessLevel: user.access_level || 'basic',
                                  active: user.active
                                })
                                setShowEditDialog(true)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Icons.Pencil1Icon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit user profile</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                handlePasswordDialogOpen()
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Icons.LockClosedIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reset password</p>
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* View Patients button - only for therapists */}
                        {user.role === 'therapist' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user)
                                  loadAssignedPatients(user.id)
                                }}
                                disabled={loadingPatients}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Icons.PersonIcon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View assigned patients</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setShowDeleteInfoDialog(true)
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Icons.TrashIcon className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete user (requires technical team)</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive a temporary password.
            </DialogDescription>
            {/* Avatar Preview */}
            {(createForm.firstName || createForm.lastName || createForm.email) && (
              <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
                <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                  <AvatarFallback className={`${getAvatarColor(getPatientIdentifier({
                    patient_code: createForm.email?.split('@')[0] || 'unknown',
                    first_name: createForm.firstName,
                    last_name: createForm.lastName,
                    display_name: createForm.firstName && createForm.lastName 
                      ? `${createForm.firstName} ${createForm.lastName}` 
                      : createForm.email?.split('@')[0] || 'New User'
                  }))} text-white font-semibold text-sm`}>
                    {getPatientAvatarInitials(createForm.firstName, createForm.lastName, createForm.email?.split('@')[0])}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-gray-900">
                    {createForm.firstName || createForm.lastName 
                      ? `${createForm.firstName || ''} ${createForm.lastName || ''}`.trim()
                      : createForm.email?.split('@')[0] || 'New User'}
                  </div>
                  <div className="text-sm text-gray-500">{createForm.email || 'email@example.com'}</div>
                </div>
              </div>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className={users.some(user => user.email.toLowerCase() === createForm.email.toLowerCase()) && createForm.email ? 'border-red-500' : ''}
                />
                {users.some(user => user.email.toLowerCase() === createForm.email.toLowerCase()) && createForm.email && (
                  <p className="text-xs text-red-600">This email address is already in use</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">First Name</Label>
              <Input
                id="firstName"
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">Last Name</Label>
              <Input
                id="lastName"
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => setCreateForm({ ...createForm, role: value as any })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="therapist" className="flex items-center">
                    <Icons.PersonIcon className="h-4 w-4 mr-2 text-blue-600" />
                    Therapist
                  </SelectItem>
                  <SelectItem value="researcher" className="flex items-center">
                    <Icons.MagnifyingGlassIcon className="h-4 w-4 mr-2 text-green-600" />
                    Researcher
                  </SelectItem>
                  <SelectItem value="admin" className="flex items-center">
                    <Icons.LockClosedIcon className="h-4 w-4 mr-2 text-red-600" />
                    Admin
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="institution" className="text-right">Institution</Label>
              <Input
                id="institution"
                value={createForm.institution}
                onChange={(e) => setCreateForm({ ...createForm, institution: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">Department</Label>
              <Input
                id="department"
                value={createForm.department}
                onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                className="col-span-3"
                placeholder="Optional"
              />
            </div>

            {/* Password Configuration Section */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="useCustomPassword"
                  checked={createPasswordForm.useCustomPassword}
                  onChange={(e) => setCreatePasswordForm(prev => ({ ...prev, useCustomPassword: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="useCustomPassword" className="text-sm font-medium">
                  Set custom initial password
                </Label>
              </div>

              {createPasswordForm.useCustomPassword && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="customPassword" className="text-right">Password</Label>
                    <div className="col-span-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          id="customPassword"
                          type="password"
                          value={createPasswordForm.customPassword}
                          onChange={(e) => setCreatePasswordForm(prev => ({ ...prev, customPassword: e.target.value }))}
                          placeholder="Enter custom password (min 8 characters)"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateCreatePassword}
                          className="shrink-0"
                        >
                          Generate
                        </Button>
                      </div>
                      {createPasswordForm.customPassword && (
                        <div className="text-xs text-muted-foreground">
                          Strength: {createPasswordForm.customPassword.length >= 8 ? '✓ Good' : '⚠ Too short'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="confirmCreatePassword" className="text-right">Confirm</Label>
                    <Input
                      id="confirmCreatePassword"
                      type="password"
                      value={createPasswordForm.confirmPassword}
                      onChange={(e) => setCreatePasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm the password"
                      className="col-span-3"
                    />
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="createAdminNote" className="text-right">Admin Note</Label>
                    <Textarea
                      id="createAdminNote"
                      value={createPasswordForm.adminNote}
                      onChange={(e) => setCreatePasswordForm(prev => ({ ...prev, adminNote: e.target.value }))}
                      placeholder="How will you deliver this password? (e.g., kPaste, WhatsApp, in-person)"
                      rows={2}
                      className="col-span-3"
                    />
                  </div>

                  <Alert className="border-blue-200 bg-blue-50">
                    <Icons.Share1Icon className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Secure Delivery Recommendation:</strong> Use{' '}
                      <a 
                        href="https://kpaste.infomaniak.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-900"
                      >
                        kPaste
                      </a>{' '}
                      for secure password sharing. It's encrypted end-to-end, temporary, and stored in Switzerland.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateUser}
              disabled={
                !!(users.some(user => user.email.toLowerCase() === createForm.email.toLowerCase()) && createForm.email) ||
                (createPasswordForm.useCustomPassword && (
                  !createPasswordForm.customPassword || 
                  !createPasswordForm.confirmPassword || 
                  createPasswordForm.customPassword !== createPasswordForm.confirmPassword ||
                  createPasswordForm.customPassword.length < 8
                ))
              }
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update profile information for {selectedUser?.email}
            </DialogDescription>
            {/* Avatar Preview */}
            {selectedUser && (
              <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
                <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                  <AvatarFallback className={`${getAvatarColor(getPatientIdentifier({
                    patient_code: selectedUser.email?.split('@')[0] || 'unknown',
                    first_name: editForm.firstName,
                    last_name: editForm.lastName,
                    display_name: editForm.firstName && editForm.lastName 
                      ? `${editForm.firstName} ${editForm.lastName}` 
                      : selectedUser.email?.split('@')[0] || 'User'
                  }))} text-white font-semibold text-sm`}>
                    {getPatientAvatarInitials(editForm.firstName, editForm.lastName, selectedUser.email?.split('@')[0])}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-gray-900">
                    {editForm.firstName || editForm.lastName 
                      ? `${editForm.firstName || ''} ${editForm.lastName || ''}`.trim()
                      : selectedUser.email?.split('@')[0] || 'User'}
                  </div>
                  <div className="text-sm text-gray-500">{selectedUser.email}</div>
                </div>
              </div>
            )}
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editFirstName" className="text-right">First Name</Label>
              <Input
                id="editFirstName"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editLastName" className="text-right">Last Name</Label>
              <Input
                id="editLastName"
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Role</Label>
              <Select 
                value={editForm.role} 
                onValueChange={(value) => setEditForm({ ...editForm, role: value as any })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="therapist" className="flex items-center">
                    <Icons.PersonIcon className="h-4 w-4 mr-2 text-blue-600" />
                    Therapist
                  </SelectItem>
                  <SelectItem value="researcher" className="flex items-center">
                    <Icons.MagnifyingGlassIcon className="h-4 w-4 mr-2 text-green-600" />
                    Researcher
                  </SelectItem>
                  <SelectItem value="admin" className="flex items-center">
                    <Icons.LockClosedIcon className="h-4 w-4 mr-2 text-red-600" />
                    Admin
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editInstitution" className="text-right">Institution</Label>
              <Input
                id="editInstitution"
                value={editForm.institution}
                onChange={(e) => setEditForm({ ...editForm, institution: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="editDepartment" className="text-right">Department</Label>
              <Input
                id="editDepartment"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                className="col-span-3"
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Access Level</Label>
              <Select 
                value={editForm.accessLevel} 
                onValueChange={(value) => setEditForm({ ...editForm, accessLevel: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Status</Label>
              <Select 
                value={editForm.active ? 'active' : 'inactive'} 
                onValueChange={(value) => setEditForm({ ...editForm, active: value === 'active' })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>Update Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security Warning Dialog */}
      <Dialog open={showSecurityWarningDialog} onOpenChange={setShowSecurityWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Icons.ExclamationTriangleIcon className="h-5 w-5" />
              Security Warning
            </DialogTitle>
            <DialogDescription>
              You are about to change the password for {selectedUser?.email}
              {selectedUser?.id === userProfile?.id && (
                <span className="block mt-1 text-orange-600 font-medium">
                  ⚠️ You are changing your own password
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert className="border-red-200 bg-red-50">
              <Icons.ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Important Security Notice:</strong>
              </AlertDescription>
            </Alert>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-red-700">
                {selectedUser?.id === userProfile?.id ? 'This action will:' : 'This action will:'}
              </p>
              <ul className="list-disc list-inside space-y-1 text-red-600 ml-4">
                <li>Immediately invalidate the {selectedUser?.id === userProfile?.id ? 'your' : 'user\'s'} current session</li>
                <li>Log {selectedUser?.id === userProfile?.id ? 'you' : 'the user'} out from all devices</li>
                <li>Force {selectedUser?.id === userProfile?.id ? 'you' : 'them'} to use the new password on next login</li>
                <li>Be permanently logged in the audit trail</li>
              </ul>
              <p className="text-red-700 font-medium mt-3">
                This action cannot be undone. Only proceed if you are certain this is necessary.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSecurityWarningDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleSecurityWarningAcknowledge}
              className="bg-red-600 hover:bg-red-700"
            >
              I Understand, Proceed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password (min 8 characters)"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateSecurePassword}
                  className="shrink-0"
                >
                  Generate
                </Button>
              </div>
              {passwordForm.newPassword && (
                <div className="text-xs text-muted-foreground">
                  Strength: {passwordForm.newPassword.length >= 8 ? '✓ Good' : '⚠ Too short'}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm the new password"
              />
              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <div className="text-xs text-red-600">Passwords do not match</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminNote">Admin Note (Optional)</Label>
              <Textarea
                id="adminNote"
                value={passwordForm.adminNote}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, adminNote: e.target.value }))}
                placeholder="How will you deliver this password? (e.g., kPaste, WhatsApp, in-person)"
                rows={2}
              />
            </div>

            <Alert>
              <Icons.InfoCircledIcon className="h-4 w-4" />
              <AlertDescription>
                The user will be logged out immediately and must use this new password on their next login.
              </AlertDescription>
            </Alert>

            <Alert className="border-blue-200 bg-blue-50">
              <Icons.Share1Icon className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Secure Delivery Recommendation:</strong> Use{' '}
                <a 
                  href="https://kpaste.infomaniak.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-900"
                >
                  kPaste
                </a>{' '}
                for secure password sharing. It's encrypted end-to-end, temporary, and stored in Switzerland.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSetTemporaryPassword}
              disabled={!passwordForm.newPassword || !passwordForm.confirmPassword || passwordForm.newPassword !== passwordForm.confirmPassword || passwordForm.newPassword.length < 8}
            >
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Information Dialog - Yellow Warning */}
      <Dialog open={showDeleteInfoDialog} onOpenChange={setShowDeleteInfoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-600">
              <Icons.ExclamationTriangleIcon className="h-5 w-5" />
              User Deletion Information
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icons.ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-yellow-800">
                    Sensitive Operation Required
                  </p>
                  <p className="text-sm text-yellow-700">
                    User deletion is a sensitive operation that requires technical team intervention 
                    to ensure proper data integrity and audit trail maintenance.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Icons.PersonIcon className="h-4 w-4 text-slate-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">User to be deleted:</p>
                  <p className="text-sm text-slate-600">
                    {selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email : 'Unknown user'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Icons.LockClosedIcon className="h-4 w-4 text-slate-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Next Steps:</p>
                  <p className="text-sm text-slate-600">
                    Contact your technical team to remove this user through Supabase Studio interface.
                    This ensures proper cleanup of all related data and maintains audit trails.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteInfoDialog(false)}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assigned Patients Dialog */}
      <Dialog open={showPatientsDialog} onOpenChange={setShowPatientsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icons.PersonIcon className="h-5 w-5" />
              Assigned Patients - {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogTitle>
            <DialogDescription>
              View all patients assigned to this therapist
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {loadingPatients ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading patients...</div>
              </div>
            ) : assignedPatients.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Icons.PersonIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No patients assigned to this therapist</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="px-3 py-1">
                    {assignedPatients.length} patients
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {assignedPatients.filter(p => p.active).length} active
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age Group</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Pathology</TableHead>
                      <TableHead>Treatment Start</TableHead>
                      <TableHead>Sessions Planned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">{patient.patient_code}</TableCell>
                        <TableCell className="font-medium">
                          {patient.patient_medical_info?.first_name && patient.patient_medical_info?.last_name 
                            ? `${patient.patient_medical_info.first_name} ${patient.patient_medical_info.last_name}`
                            : '-'
                          }
                        </TableCell>
                        <TableCell>{patient.age_group}</TableCell>
                        <TableCell>{patient.gender}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={patient.pathology_category}>
                          {patient.pathology_category}
                        </TableCell>
                        <TableCell>{formatDate(patient.treatment_start_date)}</TableCell>
                        <TableCell>{patient.total_sessions_planned || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={patient.active ? 'default' : 'secondary'}>
                            {patient.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPatientsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}