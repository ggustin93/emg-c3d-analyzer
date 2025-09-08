import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, useActionData, useNavigation, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Spinner from '@/components/ui/Spinner';
import { EnvelopeClosedIcon, LockClosedIcon, ExclamationTriangleIcon, PersonIcon, InfoCircledIcon, GitHubLogoIcon } from '@radix-ui/react-icons';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

/**
 * Full-page login interface for EMG C3D Analyzer
 * Professional, on-page authentication without modal disruption
 * 
 * Features:
 * - React Router 7 Form for <200ms navigation
 * - Server-side action handling with instant redirects
 * - Non-blocking authentication state updates
 */
const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';
  
  const isSubmitting = navigation.state === 'submitting';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Load saved email from localStorage if available
  useEffect(() => {
    const savedEmail = localStorage.getItem('emg_analyzer_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Save email preference when form is submitted successfully
  useEffect(() => {
    if (navigation.state === 'loading' && !actionData?.error) {
      // Login was successful, save email if remember me is checked
      if (rememberMe && email) {
        localStorage.setItem('emg_analyzer_saved_email', email);
      } else {
        localStorage.removeItem('emg_analyzer_saved_email');
      }
    }
  }, [navigation.state, actionData, rememberMe, email]);

  // Memoized input handlers for optimal performance
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const handleDevelopmentBypass = useCallback(() => {
    // Set a flag in sessionStorage to indicate development bypass
    sessionStorage.setItem('emg_analyzer_dev_bypass', 'true');
    onLoginSuccess?.();
  }, [onLoginSuccess]);

  // Memoize form validation to prevent unnecessary recalculations
  const isFormValid = useMemo(() => {
    return Boolean(email && password);
  }, [email, password]);

  // Memoize button disabled state
  const isButtonDisabled = useMemo(() => {
    return isSubmitting || !isFormValid;
  }, [isSubmitting, isFormValid]);

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
              {/* Login Form - Using React Router Form for instant navigation */}
              <Form method="post" className="space-y-4">
                {/* Include redirect destination */}
                <input type="hidden" name="from" value={from} />
                
                {actionData?.error && (
                  <Alert className="border-red-200 bg-red-50">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                    <div className="text-red-800 text-sm font-medium">
                      {actionData.error}
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
                        name="email"
                        type="email"
                        placeholder="researcher@institution.edu"
                        value={email}
                        onChange={handleEmailChange}
                        disabled={isSubmitting}
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
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={handlePasswordChange}
                        disabled={isSubmitting}
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
                  {isSubmitting ? (
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
              </Form>

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