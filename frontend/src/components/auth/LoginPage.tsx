import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/types/auth';
import { EnvelopeClosedIcon, LockClosedIcon, ExclamationTriangleIcon, PersonIcon, LightningBoltIcon } from '@radix-ui/react-icons';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

/**
 * Full-page login interface for EMG C3D Analyzer
 * Professional, on-page authentication without modal disruption
 */
const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, isLoading } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  // Load saved email from localStorage if available
  useEffect(() => {
    const savedEmail = localStorage.getItem('emg_analyzer_saved_email');
    if (savedEmail) {
      setCredentials(prev => ({ ...prev, email: savedEmail }));
    }
  }, []);

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

    setError(null);

    try {
      const response = await login(credentials);
      
      if (response.success) {
        // Save email if remember me is checked
        if (rememberMe) {
          localStorage.setItem('emg_analyzer_saved_email', credentials.email);
        } else {
          localStorage.removeItem('emg_analyzer_saved_email');
        }
        
        // Clear form
        setCredentials({ email: '', password: '' });
        
        // Call success callback
        onLoginSuccess?.();
      } else {
        setError(response.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleDevelopmentBypass = () => {
    console.warn('Development bypass: Authentication skipped');
    // Set a flag in sessionStorage to indicate development bypass
    sessionStorage.setItem('emg_analyzer_dev_bypass', 'true');
    onLoginSuccess?.();
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          
          {/* Welcome Card */}
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PersonIcon className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Researcher Access
              </CardTitle>
              <CardDescription className="text-base text-slate-600 mt-2">
                Sign in to access the research analysis platform
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Feature Highlights */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <LightningBoltIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-blue-900 text-sm">Platform Features</h3>
                </div>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• C3D file processing and EMG analysis</li>
                  <li>• Research-grade performance metrics</li>
                  <li>• Real-time visualization and reporting</li>
                  <li>• Session data management and export</li>
                </ul>
              </div>

              {/* Login Form */}
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
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                      Email Address
                    </Label>
                    <div className="relative">
                      <EnvelopeClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="researcher@institution.edu"
                        value={credentials.email}
                        onChange={handleInputChange('email')}
                        disabled={isLoading}
                        className="pl-10 h-12 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                      Password
                    </Label>
                    <div className="relative">
                      <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={credentials.password}
                        onChange={handleInputChange('password')}
                        disabled={isLoading}
                        className="pl-10 h-12 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                      Remember my email address
                    </label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading || !credentials.email || !credentials.password}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Spinner />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <PersonIcon className="w-4 h-4 mr-2" />
                      Sign In to EMG Analyzer
                    </>
                  )}
                </Button>

              </form>

              {/* Help Text */}
              <div className="text-center pt-4 border-t">
                <p className="text-xs text-slate-500">
                  Need researcher access? Contact your institution administrator.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
};

export default LoginPage;