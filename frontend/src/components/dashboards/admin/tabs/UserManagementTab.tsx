/**
 * User Management Tab Component
 * 
 * Purpose: Manage users with direct Supabase integration
 * Architecture: Direct Supabase for most operations, FastAPI for admin-only actions
 * Features: Role management, temporary passwords, user creation
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/services/adminAuditService'
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
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'therapist',
    institution: '',
    department: ''
  })
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
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Call backend API to create user with service key
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: createForm.email,
          first_name: createForm.firstName,
          last_name: createForm.lastName,
          role: createForm.role,
          institution: createForm.institution,
          department: createForm.department,
          notify_user: false
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to create user')
      }

      const result = await response.json()

      // Show temporary password to admin
      toast({
        title: 'User created successfully!',
        description: `Temporary password: ${result.temporary_password} | User code: ${result.user_code || 'N/A'} | Share this password securely with the user.`
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
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to create user:', error)
      toast({
        title: 'Error',
        description: `Failed to create user: ${error.message}`,
        variant: 'destructive'
      })
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return

    try {
      // Update user profile directly in Supabase
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          role: editForm.role,
          institution: editForm.institution,
          department: editForm.department,
          access_level: editForm.accessLevel,
          active: editForm.active,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'User profile updated successfully'
      })

      // Log the action
      await logAdminAction({
        action: 'user_profile_updated',
        tableName: 'user_profiles',
        recordId: selectedUser.id,
        changes: {
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          role: editForm.role,
          institution: editForm.institution,
          department: editForm.department,
          access_level: editForm.accessLevel,
          active: editForm.active
        }
      })

      setShowEditDialog(false)
      await loadUsers()
    } catch (error: any) {
      console.error('Failed to update user:', error)
      toast({
        title: 'Error',
        description: `Failed to update user: ${error.message}`,
        variant: 'destructive'
      })
    }
  }

  const handleSetTemporaryPassword = async () => {
    if (!selectedUser) return

    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Call the backend admin API to reset password
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notify_user: false  // We'll handle notification manually
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to reset password')
      }

      const result = await response.json()
      
      // Show success with the temporary password
      toast({
        title: 'Password Reset Successful!',
        description: `Temporary password for ${selectedUser.email}: ${result.temporary_password} | Expires in ${result.expires_in_hours} hours | Share this securely with the user.`
      })

      setShowPasswordDialog(false)
      
      // Refresh the user list to show any status changes
      loadUsers()
      
    } catch (error: any) {
      console.error('Failed to reset password:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive'
      })
    }
  }

  const handleToggleUserStatus = async (user: UserProfile) => {
    try {
      const newStatus = !user.active
      
      // Update user status
      const { error } = await supabase
        .from('user_profiles')
        .update({
          active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: `User ${newStatus ? 'activated' : 'deactivated'} successfully`
      })

      // Log the action
      await logAdminAction({
        action: newStatus ? 'user_activated' : 'user_deactivated',
        tableName: 'user_profiles',
        recordId: user.id
      })

      await loadUsers()
    } catch (error: any) {
      console.error('Failed to toggle user status:', error)
      toast({
        title: 'Error',
        description: `Failed to update user status: ${error.message}`,
        variant: 'destructive'
      })
    }
  }

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users
    
    const search = searchTerm.toLowerCase()
    return users.filter(user => 
      user.email?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search) ||
      user.institution?.toLowerCase().includes(search) ||
      user.role.toLowerCase().includes(search)
    )
  }, [users, searchTerm])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'therapist': return 'default'
      case 'researcher': return 'secondary'
      default: return 'outline'
    }
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
      {/* Header with Search and Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Icons.MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline" className="px-3 py-1">
            {filteredUsers.length} users
          </Badge>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Icons.PlusIcon className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">
                      {user.first_name || user.last_name 
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : 'No name'}
                    </div>
                    {user.user_code && (
                      <div className="text-xs text-muted-foreground">{user.user_code}</div>
                    )}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.institution || '-'}</TableCell>
                  <TableCell>{user.department || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.active ? 'default' : 'secondary'}>
                      {user.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
                      >
                        <Icons.Pencil1Icon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user)
                          setShowPasswordDialog(true)
                        }}
                      >
                        <Icons.LockClosedIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleUserStatus(user)}
                      >
                        {user.active ? (
                          <Icons.CrossCircledIcon className="h-4 w-4 text-orange-600" />
                        ) : (
                          <Icons.CheckCircledIcon className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                    </div>
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
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="col-span-3"
              />
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
                  <SelectItem value="therapist">Therapist</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser}>Create User</Button>
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
                  <SelectItem value="therapist">Therapist</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Temporary Password</DialogTitle>
            <DialogDescription>
              Generate a temporary password for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              A temporary password will be generated and displayed for you to share with the user.
              The user will be required to change this password on their next login.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetTemporaryPassword}>Generate Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}