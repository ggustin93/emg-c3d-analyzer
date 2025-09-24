/**
 * PasswordVaultTab - Secure temporary password retrieval for admins
 * 
 * SECURITY: This component allows admins to securely retrieve temporary passwords
 * for manual delivery (WhatsApp, in-person, etc.) in small clinical deployments
 * without email infrastructure.
 * 
 * Security measures:
 * - Passwords are only shown once when clicked
 * - Auto-expire after viewing
 * - Audit logging of all password retrievals
 * - Confirmation dialog before revealing
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card'
import { Button } from '../../../ui/button'
import { Badge } from '../../../ui/badge'
import { Alert, AlertDescription } from '../../../ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../ui/dialog'
import { EyeOpenIcon, EyeClosedIcon, ClockIcon, LockClosedIcon, PersonIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons'
import { useToast } from '../../../../hooks/use-toast'
import { supabase } from '../../../../lib/supabase'
import { API_CONFIG } from '../../../../config/apiConfig'

interface TemporaryPassword {
  id: string
  user_id: string
  user_email: string
  user_name: string
  masked_password: string
  delivery_method: string
  created_at: string
  expires_at: string
  retrieved: boolean
  retrieved_at?: string
}

export function PasswordVaultTab() {
  const { toast } = useToast()
  const [passwords, setPasswords] = useState<TemporaryPassword[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPassword, setSelectedPassword] = useState<TemporaryPassword | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [isRevealing, setIsRevealing] = useState(false)

  const loadPendingPasswords = async () => {
    try {
      setLoading(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      // Fetch pending temporary passwords from secure admin endpoint
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/password-vault`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch password vault')
      
      const data = await response.json()
      setPasswords(data.passwords || [])
      
    } catch (error: any) {
      console.error('Failed to load password vault:', error)
      toast({
        title: 'Error',
        description: 'Failed to load pending passwords',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRevealPassword = async () => {
    if (!selectedPassword) return
    
    setIsRevealing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      // Retrieve the actual password from secure endpoint
      const response = await fetch(`${API_CONFIG.baseUrl}/admin/password-vault/${selectedPassword.id}/retrieve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          confirm_user_id: selectedPassword.user_id,
          delivery_method: selectedPassword.delivery_method
        })
      })

      if (!response.ok) throw new Error('Failed to retrieve password')
      
      const data = await response.json()
      setRevealedPassword(data.password)
      
      // Log the retrieval action
      toast({
        title: '✅ Password Retrieved',
        description: `Password for ${selectedPassword.user_email} has been revealed successfully. It will expire after viewing for security.`
      })
      
      // Mark as retrieved in local state
      setPasswords(prev => prev.map(p => 
        p.id === selectedPassword.id 
          ? { ...p, retrieved: true, retrieved_at: new Date().toISOString() }
          : p
      ))
      
    } catch (error: any) {
      console.error('Failed to retrieve password:', error)
      toast({
        title: 'Error',
        description: 'Failed to retrieve password',
        variant: 'destructive'
      })
    } finally {
      setIsRevealing(false)
      setShowConfirmDialog(false)
    }
  }

  const handleCopyAndClose = () => {
    if (revealedPassword) {
      navigator.clipboard.writeText(revealedPassword)
      toast({
        title: 'Password Copied',
        description: 'Password copied to clipboard. Deliver it securely to the user.'
      })
      setRevealedPassword(null)
      setSelectedPassword(null)
      loadPendingPasswords() // Refresh the list
    }
  }

  useEffect(() => {
    loadPendingPasswords()
  }, [])

  const getExpiryStatus = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const minutesLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60))
    const hoursLeft = Math.floor(minutesLeft / 60)
    
    if (minutesLeft <= 0) return { label: 'Expired', variant: 'destructive' as const }
    if (minutesLeft <= 30) return { label: `${minutesLeft}min left!`, variant: 'destructive' as const }
    if (hoursLeft < 1) return { label: `${minutesLeft}min left`, variant: 'warning' as const }
    if (hoursLeft <= 1) return { label: `${hoursLeft}h left`, variant: 'warning' as const }
    return { label: `${hoursLeft}h left`, variant: 'default' as const }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockClosedIcon className="h-5 w-5" />
            Password Vault
          </CardTitle>
          <CardDescription>
            Securely retrieve temporary passwords for manual delivery to users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {passwords.length === 0 ? (
            <Alert>
              <AlertDescription>
                No pending passwords to retrieve. Passwords appear here after resetting a user's password.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {passwords.filter(p => !p.retrieved).map(password => {
                const expiryStatus = getExpiryStatus(password.expires_at)
                return (
                  <Card key={password.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <PersonIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{password.user_name}</span>
                          <span className="text-muted-foreground">({password.user_email})</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Masked: {password.masked_password}</span>
                          <Badge variant="outline">{password.delivery_method}</Badge>
                          <div className="flex items-center gap-1">
                            <ClockIcon className="h-3 w-3" />
                            <Badge variant={expiryStatus.variant}>
                              {expiryStatus.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPassword(password)
                          setShowConfirmDialog(true)
                        }}
                        disabled={expiryStatus.label === 'Expired'}
                      >
                        <EyeOpenIcon className="h-4 w-4 mr-2" />
                        Reveal
                      </Button>
                    </div>
                  </Card>
                )
              })}
              
              {passwords.some(p => p.retrieved) && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Retrieved Passwords</h4>
                  {passwords.filter(p => p.retrieved).map(password => (
                    <div key={password.id} className="flex items-center justify-between p-3 text-sm text-muted-foreground">
                      <span>{password.user_email}</span>
                      <span>Retrieved at {new Date(password.retrieved_at!).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Password Retrieval</DialogTitle>
            <DialogDescription>
              You are about to reveal the temporary password for {selectedPassword?.user_name}.
              This action will be logged for security purposes.
            </DialogDescription>
          </DialogHeader>
          <Alert className="my-4">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> The password will be shown only once.
              Make sure you're ready to copy it and deliver it securely via {selectedPassword?.delivery_method}.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRevealPassword} disabled={isRevealing}>
              {isRevealing ? 'Retrieving...' : 'Reveal Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Display Dialog */}
      <Dialog open={!!revealedPassword} onOpenChange={() => setRevealedPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
            <DialogDescription>
              For {selectedPassword?.user_name} ({selectedPassword?.user_email})
            </DialogDescription>
          </DialogHeader>
          <div className="my-6">
            <div className="p-4 bg-muted rounded-lg font-mono text-lg text-center select-all">
              {revealedPassword}
            </div>
          </div>
          <Alert>
            <AlertDescription>
              Deliver this password securely via {selectedPassword?.delivery_method}.
              The password expires in 24 hours.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={handleCopyAndClose}>
              Copy and Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}