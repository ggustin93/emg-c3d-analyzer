import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials } from '@/types/auth';
import { EnvelopeClosedIcon, LockClosedIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface ResearcherLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ResearcherLoginModal: React.FC<ResearcherLoginModalProps> = ({
  open,
  onOpenChange
}) => {
  const { login, loading } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const handleInputChange = (field: keyof LoginCredentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }

    setLocalLoading(true);
    setError(null);

    try {
      const response = await login(credentials.email, credentials.password);
      
      if (response.data && !response.error) {
        // Close modal on successful login
        onOpenChange(false);
        // Reset form
        setCredentials({ email: '', password: '' });
      } else {
        setError(response.error?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleClose = () => {
    if (!localLoading && !loading) {
      onOpenChange(false);
      setCredentials({ email: '', password: '' });
      setError(null);
    }
  };

  const isFormLoading = localLoading || loading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <EnvelopeClosedIcon className="w-4 h-4 text-blue-600" />
            </div>
            Researcher Access
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Sign in with your researcher credentials to access advanced features and save analysis sessions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
              <div className="text-red-800 text-sm font-medium">
                {error}
              </div>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <div className="relative">
                <EnvelopeClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="researcher@institution.edu"
                  value={credentials.email}
                  onChange={handleInputChange('email')}
                  disabled={isFormLoading}
                  className="pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  disabled={isFormLoading}
                  className="pl-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isFormLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isFormLoading || !credentials.email || !credentials.password}
              className="w-full sm:w-auto min-w-[120px]"
            >
              {isFormLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </Button>
          </DialogFooter>
        </form>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Need researcher access? Contact your administrator for credentials.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResearcherLoginModal;