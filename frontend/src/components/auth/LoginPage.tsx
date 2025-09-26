import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, useActionData, useNavigation, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import Spinner from '@/components/ui/Spinner';
import { EnvelopeClosedIcon, LockClosedIcon, ExclamationTriangleIcon, PersonIcon, InfoCircledIcon, GitHubLogoIcon, ChevronDownIcon, ChevronRightIcon, DesktopIcon, MobileIcon } from '@radix-ui/react-icons';
import { useScreenSize } from '@/hooks/useScreenSize';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

/**
 * Login interface for EMG C3D Analyzer platform
 * Provides authentication access to the research dashboard
 * 
 * Implementation:
 * - React Router Form for optimized navigation
 * - Server-side action handling with redirects
 * - Responsive design with mobile restrictions
 */
const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';
  const { isSmartphone, isMobile } = useScreenSize();
  
  const isSubmitting = navigation.state === 'submitting';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isDevModeOpen, setIsDevModeOpen] = useState(false);

  // Quick login accounts for development mode
  const quickLoginAccounts = [
    {
      role: 'Admin',
      email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin2@ghostly.be',
      password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'admin',
      color: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700'
    },
    {
      role: 'Researcher',
      email: import.meta.env.VITE_DEMO_RESEARCHER_EMAIL || 'researcher@ghostly.be',
      password: import.meta.env.VITE_DEMO_RESEARCHER_PASSWORD || 'ghostly2025',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700'
    },
    {
      role: 'Therapist',
      email: import.meta.env.VITE_DEMO_THERAPIST_EMAIL || 'therapist1@example.com',
      password: import.meta.env.VITE_DEMO_THERAPIST_PASSWORD || 'ghostly2025',
      color: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700'
    }
  ];

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

  // Memoize button disabled state - also disable on mobile devices
  const isButtonDisabled = useMemo(() => {
    return isSubmitting || !isFormValid || isSmartphone;
  }, [isSubmitting, isFormValid, isSmartphone]);

  // Memoized remember me handler
  const handleRememberMeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
  }, []);

  // Quick login handler for development mode
  const handleQuickLogin = useCallback((account: typeof quickLoginAccounts[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setRememberMe(true);
  }, []);

  // Prevent form submission on mobile devices
  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    if (isSmartphone) {
      e.preventDefault();
      return false;
    }
  }, [isSmartphone]);

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 relative overflow-hidden">
        {/* Decorative pattern backgrounds */}
        <div className="absolute inset-0">
          {/* Dot pattern - blue primary color */}
          <div className="absolute inset-0 opacity-[0.06]" 
               style={{
                 backgroundImage: 'radial-gradient(circle, #3b82f6 1.5px, transparent 1.5px)',
                 backgroundSize: '18px 18px'
               }} />
          {/* Grid pattern overlay - blue primary */}
          <div className="absolute inset-0 opacity-[0.03]"
               style={{
                 backgroundImage: `
                   linear-gradient(to right, #60a5fa 1px, transparent 1px),
                   linear-gradient(to bottom, #60a5fa 1px, transparent 1px)
                 `,
                 backgroundSize: '50px 50px'
               }} />
          {/* Diagonal lines pattern - blue accent */}
          <div className="absolute inset-0 opacity-[0.04]"
               style={{
                 backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(59, 130, 246, 0.3) 30px, rgba(59, 130, 246, 0.3) 31px)',
               }} />
          {/* Gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-50/10 via-transparent to-transparent" />
        </div>
        {/* Mobile device blocking overlay */}
        {isSmartphone && (
          <div className="fixed inset-0 bg-gradient-to-br from-red-50 via-orange-50/20 to-yellow-50/30 z-50 flex flex-col items-center justify-center px-4 text-center">
            {/* Background pattern for mobile block */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 opacity-[0.08]" 
                   style={{
                     backgroundImage: 'radial-gradient(circle, #ef4444 1.5px, transparent 1.5px)',
                     backgroundSize: '20px 20px'
                   }} />
              <div className="absolute inset-0 opacity-[0.04]"
                   style={{
                     backgroundImage: `
                       linear-gradient(to right, #f87171 1px, transparent 1px),
                       linear-gradient(to bottom, #f87171 1px, transparent 1px)
                     `,
                     backgroundSize: '40px 40px'
                   }} />
            </div>
            
            {/* Mobile block content */}
            <div className="relative z-10 max-w-md mx-auto space-y-6">
              {/* Icon and title */}
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="p-4 bg-red-100 rounded-full">
                    <MobileIcon className="w-12 h-12 text-red-600" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-red-900">
                    Mobile Access Not Supported
                  </h1>
                  <p className="text-red-700 text-lg">
                    This application requires a desktop or tablet device for optimal experience.
                  </p>
                </div>
              </div>
              
              {/* Explanation */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 border border-red-200">
                <div className="space-y-4 text-left">
                  <div className="flex items-start gap-3">
                    <DesktopIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-800">Why desktop/tablet only?</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        The EMG analysis dashboard requires precise data visualization and complex interactions that are optimized for larger screens.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-slate-800">Recommended devices:</h3>
                      <ul className="text-sm text-slate-600 mt-1 space-y-1">
                        <li>• Desktop computer (Windows, Mac, Linux)</li>
                        <li>• Laptop computer (13" or larger)</li>
                        <li>• Tablet device (iPad, Android tablet)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Contact information */}
              <div className="text-sm text-slate-600">
                <p>
                  Need help? Contact your administrator at{' '}
                  <a 
                    href={`mailto:${import.meta.env.VITE_ADMIN_EMAIL || 'lubos.omelina@vub.be'}`}
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    {import.meta.env.VITE_ADMIN_EMAIL || 'lubos.omelina@vub.be'}
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className={`flex-1 flex items-center justify-center px-4 relative z-10 ${isSmartphone ? 'hidden' : ''}`}>
          <div className="w-full max-w-md sm:max-w-lg">
            
            {/* Welcome Card */}
            <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm relative">
              <CardHeader className="text-center pb-0 pt-1 px-4 sm:px-6">
                {/* Application logo */}
                <div className="flex items-center justify-center mb-1">
                  <img 
                    src="/ghostly_logo.png" 
                    alt="GHOSTLY Logo" 
                    className="h-32 w-32 object-contain"
                  />
                </div>
                
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    Sign In
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoCircledIcon className="w-4 h-4 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs border-slate-200 bg-white/95 backdrop-blur-sm">
                      <div className="space-y-2">
                        <p className="font-medium text-slate-700">Features:</p>
                        <ul className="text-sm space-y-1 text-slate-600">
                          <li>• C3D file processing</li>
                          <li>• EMG data analysis</li>
                          <li>• Performance metrics</li>
                          <li>• Data visualization</li>
                          <li>• Session management</li>
                        </ul>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription className="text-sm text-slate-500">
                  Access the Ghostly+ Dashboard
                </CardDescription>
              </CardHeader>

            <CardContent className="space-y-4 px-4 sm:px-8 pb-5 sm:pb-6">
              {/* Authentication form */}
              <Form method="post" className="space-y-4" onSubmit={handleFormSubmit}>
                {/* Redirect destination */}
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
                        className="pl-10 h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
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
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={handlePasswordChange}
                        disabled={isSubmitting}
                        className="pl-10 h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
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
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Quick Login for Development Mode - Accordion */}
              {import.meta.env.DEV && (
                <div className="pt-4 border-t border-slate-200/60">
                  <Collapsible open={isDevModeOpen} onOpenChange={setIsDevModeOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-md transition-all duration-200">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                          Development Mode - Quick Login
                        </span>
                        {isDevModeOpen ? (
                          <ChevronDownIcon className="w-4 h-4" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 p-2 bg-slate-50/50 rounded-md">
                        {quickLoginAccounts.map((account) => (
                          <button
                            key={account.role}
                            type="button"
                            onClick={() => handleQuickLogin(account)}
                            className={`w-full px-3 py-2 text-xs font-medium rounded-md border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${account.color}`}
                          >
                            {account.role}
                          </button>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {/* Support and external links */}
              <div className="space-y-3 pt-4 border-t border-slate-200/60">
                <div className="text-center text-sm text-slate-600">
                  <p>
                    New researcher or therapist? Forgot password or login issues?
                    <a href={`mailto:${import.meta.env.VITE_ADMIN_EMAIL || 'lubos.omelina@vub.be'}`} 
                       className="ml-1 text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors">
                      Contact administrator
                    </a>
                  </p>
                </div>
              </div>

              {/* Institutional footer with GitHub */}
              <div className="pt-5 mt-4 border-t border-slate-200/40">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex items-center gap-4">
                    <img 
                      src="/vub_etro_logo.png" 
                      alt="VUB ETRO Logo" 
                      className="h-10 object-contain opacity-75 hover:opacity-90 transition-opacity duration-300"
                    />
                    <a 
                      href={import.meta.env.VITE_GITHUB_URL || "https://github.com/ggustin93/emg-c3d-analyzer"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800 transition-all duration-200 hover:scale-105"
                    >
                      <GitHubLogoIcon className="w-5 h-5" />
                      <span className="font-medium text-sm">GitHub</span>
                    </a>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p className="font-medium">ETRO Electronics & Informatics • Vrije Universiteit Brussel</p>
                    <p>© {new Date().getFullYear()} VUB. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default LoginPage;