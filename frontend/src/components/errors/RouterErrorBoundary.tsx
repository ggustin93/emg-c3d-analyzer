import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ExclamationTriangleIcon, HomeIcon, ReloadIcon } from '@radix-ui/react-icons';

export function RouterErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-2xl">Page Not Found</CardTitle>
              <CardDescription>
                The page you're looking for doesn't exist or has been moved.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-md">
                <p className="text-sm text-slate-600">
                  Requested URL: <code className="font-mono">{window.location.pathname}</code>
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild className="flex-1">
                  <Link to="/dashboard">
                    <HomeIcon className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                  className="flex-1"
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    if (error.status === 401) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="max-w-md w-full shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Authentication Required</CardTitle>
              <CardDescription>
                Please sign in to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/login">
                  Sign In
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }
  
  // Generic error fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error instanceof Error && (
            <div className="bg-red-50 p-3 rounded-md">
              <p className="text-sm text-red-800 font-mono">
                {error.message}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <Button 
              onClick={() => window.location.reload()} 
              className="flex-1"
            >
              <ReloadIcon className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/dashboard">
                <HomeIcon className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}