import React, { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Spinner from '@/components/ui/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials } from '@/types/auth';
import { EnvelopeClosedIcon, LockClosedIcon, ExclamationTriangleIcon, PersonIcon, InfoCircledIcon, GitHubLogoIcon } from '@radix-ui/react-icons';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

/**
 * Full-page login interface for EMG C3D Analyzer
 * Professional, on-page authentication without modal disruption
 * 
 * Features:
 * - Concurrent navigation transitions for smooth post-login experience
 * - Performance optimized callbacks with startTransition
 * - Non-blocking authentication state updates
 */
const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, loading } = useAuth();
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

  // Memoized and optimized input change handler
  const handleInputChange = useCallback((field: keyof LoginCredentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing (only if error exists)
    if (error) setError(null);
  }, [error]);

  // Optimized submit handler with performance logging
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const submitStart = performance.now();
    console.debug('[LoginPage] Sign-in initiated');
    
    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }

    setError(null);

    try {
      // Main authentication call - this is where the delay occurs
      const response = await login(credentials.email, credentials.password);
      
      if (response.data && !response.error) {
        // Optimize localStorage operations - do them asynchronously after success
        setTimeout(() => {
          if (rememberMe) {
            localStorage.setItem('emg_analyzer_saved_email', credentials.email);
          } else {
            localStorage.removeItem('emg_analyzer_saved_email');
          }
        }, 0);
        
        const totalTime = performance.now() - submitStart;
        console.debug(`[LoginPage] Sign-in completed in ${totalTime.toFixed(2)}ms`);
        
        // Skip form clearing - user will be redirected anyway
        // Call success callback with concurrent transition to prevent blocking
        if (onLoginSuccess) {
          startTransition(() => {
            onLoginSuccess();
          });
        }
      } else {
        setError(response.error?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    }
  }, [credentials, login, onLoginSuccess, rememberMe]);

  const handleDevelopmentBypass = useCallback(() => {
    // Set a flag in sessionStorage to indicate development bypass
    sessionStorage.setItem('emg_analyzer_dev_bypass', 'true');
    onLoginSuccess?.();
  }, [onLoginSuccess]);

  // Memoize form validation to prevent unnecessary recalculations
  const isFormValid = useMemo(() => {
    return Boolean(credentials.email && credentials.password);
  }, [credentials.email, credentials.password]);

  // Memoize button disabled state
  const isButtonDisabled = useMemo(() => {
    return loading || !isFormValid;
  }, [loading, isFormValid]);

  // Memoized remember me handler
  const handleRememberMeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col px-4">
        <div className="flex-grow flex items-center justify-center pt-8 pb-4">
          <div className="w-full max-w-md sm:max-w-lg">
            
            {/* Welcome Card */}
            <Card className="shadow-2xl border-0">
              <CardHeader className="text-center pb-3 pt-5 px-4 sm:px-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    Sign In
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="w-4 h-4 text-blue-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold">Platform Features:</p>
                        <ul className="text-sm space-y-1">
                          <li>• C3D file processing and EMG analysis</li>
                          <li>• Research-grade performance metrics</li>
                          <li>• Real-time visualization and reporting</li>
                          <li>• Session data management and export</li>
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription className="text-sm text-slate-600">
                  Access the Ghostly+ EMG C3D Analysis Platform
                </CardDescription>
              </CardHeader>

            <CardContent className="space-y-4 px-4 sm:px-8 pb-5 sm:pb-6">
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
                        disabled={loading}
                        className="pl-10 h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                        Password
                      </Label>
                      <a href="#" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <LockClosedIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={credentials.password}
                        onChange={handleInputChange('password')}
                        disabled={loading}
                        className="pl-10 h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
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
                      onChange={handleRememberMeChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                      Remember my email address
                    </label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isButtonDisabled}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium text-base transition-colors"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Spinner />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <>
                      <PersonIcon className="w-4 h-4 mr-2" />
                      Sign In to Ghostly+
                    </>
                  )}
                </Button>
              </form>

              {/* Footer Links */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <p className="text-slate-600">
                    New researcher? 
                    <a href="#" className="ml-1 text-blue-600 hover:text-blue-700 hover:underline">
                      Contact administrator
                    </a>
                  </p>
                  <a 
                    href="https://github.com/ggustin93/emg-c3d-analyzer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    <GitHubLogoIcon className="w-4 h-4" />
                    <span>GitHub</span>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
        
        {/* Footer with VUB ETRO */}
        <footer className="mt-auto pt-8 pb-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center gap-2">
              <img 
                src="/vub_etro_logo.png" 
                alt="VUB ETRO Logo" 
                className="h-12 object-contain"
              />
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>ETRO Electronics & Informatics • Vrije Universiteit Brussel</p>
              <p>© {new Date().getFullYear()} VUB. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
};

export default LoginPage;