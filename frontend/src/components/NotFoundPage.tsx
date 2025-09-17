import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { 
  ExclamationTriangleIcon, 
  HomeIcon, 
  MagnifyingGlassIcon 
} from '@radix-ui/react-icons'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-lg w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-3xl mb-2">Page Not Found</CardTitle>
          <CardDescription className="text-base">
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Current URL Display */}
          <div className="bg-slate-50 p-4 rounded-md border">
            <p className="text-sm text-slate-600 mb-1">Requested URL:</p>
            <code className="font-mono text-sm bg-white px-2 py-1 rounded border">
              {window.location.pathname}
            </code>
          </div>

          {/* Helpful Suggestions */}
          <div className="bg-blue-50 p-4 rounded-md border-l-4 border-blue-500">
            <h4 className="font-medium text-blue-900 mb-2">What you can do:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Check if you typed the URL correctly</li>
              <li>• Return to the dashboard to find what you need</li>
              <li>• Use the search feature to locate content</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1">
              <Link to="/dashboard" className="flex items-center justify-center">
                <HomeIcon className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="flex-1">
              <Link to="/faq" className="flex items-center justify-center">
                <MagnifyingGlassIcon className="mr-2 h-4 w-4" />
                Browse FAQ
              </Link>
            </Button>
          </div>

          {/* Additional Help */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-slate-600 mb-2">
              Still having trouble?
            </p>
            <Button 
              variant="ghost" 
              onClick={() => window.history.back()}
              className="text-sm"
            >
              ← Go Back to Previous Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}