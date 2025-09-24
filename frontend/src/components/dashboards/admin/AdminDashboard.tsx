/**
 * AdminDashboard - System Administration and User Management Interface
 * 
 * Author: Guillaume Gustin with assistance from Claude Code (Sonnet 3.5, Sonnet 4)
 * GitHub: @ggustin93
 * Project: GHOSTLY+ EMG C3D Analyzer
 * Updated: September 2025
 * 
 * PURPOSE: System administration interface for user management and configuration
 * Current Implementation: 33 lines (minimal implementation with SessionSettings only)
 * 
 * Architecture Notes:
 * - Strategic component for system administration
 * - Integrates with Supabase RLS for authorization
 * - Follows TherapistOverview.tsx component patterns
 * - Uses @radix-ui/react-icons (project standard)
 * 
 * TODO: CRITICAL IMPLEMENTATION NEEDED
 * =====================================
 * 
 * 1. USER MANAGEMENT TAB
 *    - List all users with role-based filtering
 *    - Create new users (patients, therapists, researchers)
 *    - Edit user profiles and permissions
 *    - Assign patient-therapist relationships
 *    - Role management (ADMIN, THERAPIST, RESEARCHER)
 *    - User activation/deactivation
 *    - Password reset functionality
 *    - Integration with user_profiles, therapist_profiles tables
 * 
 * 2. PATIENT MANAGEMENT SECTION
 *    - Complete patient record creation
 *    - Medical information management
 *    - Therapist assignment interface
 *    - Patient code generation
 *    - Scoring configuration per patient
 *    - View patient therapy history
 *    - Export patient data for reports
 *    - Integration with patients table
 * 
 * 3. SYSTEM CONFIGURATION PANEL
 *    - Global scoring configuration management
 *    - Session parameter defaults
 *    - System-wide MVC thresholds
 *    - Feature flags management
 *    - Therapy protocol templates
 *    - Clinical trial configurations
 *    - Integration with scoring_configuration table
 * 
 * 4. ACTIVITY MONITORING DASHBOARD
 *    - Recent user activity logs
 *    - System health indicators
 *    - Processing pipeline status
 *    - Error logs and alerts
 *    - Session processing metrics
 *    - Storage usage statistics
 *    - Performance metrics dashboard
 * 
 * 5. DATA MANAGEMENT UTILITIES
 *    - Batch data import/export
 *    - Database maintenance tools
 *    - Backup configuration
 *    - Data retention policies
 *    - GDPR compliance tools
 * 
 * Technical Implementation Requirements:
 * - Follow existing UI patterns from TherapistOverview.tsx
 * - Use shadcn/ui components (Card, Table, Dialog, Button)
 * - Implement with @radix-ui/react-icons only
 * - Use API_CONFIG.baseUrl for all API calls
 * - Let RLS handle authorization (no frontend auth logic)
 * - Add loading states and error handling
 * - Implement responsive design for tablets/desktop
 * - Add keyboard navigation support
 * - Include search and filtering capabilities
 * - Add pagination for large datasets
 * 
 * Dependencies:
 * - Supabase tables: user_profiles, patients, therapist_profiles, scoring_configuration
 * - Existing RLS policies for admin access
 * - API endpoints: /admin/users, /admin/patients, /admin/config
 * 
 * Production Considerations:
 * - Critical for multi-center clinical trials
 * - Required for system scalability
 * - Essential for compliance and auditing
 * - Performance optimization for large datasets
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '../../ui/card'
import { useAuth } from '../../../contexts/AuthContext'
import { useLocation } from 'react-router-dom'
import { OverviewTab } from './tabs/OverviewTab'
import { UserManagementTab } from './tabs/UserManagementTab'
import { PatientManagement } from '../therapist/PatientManagement'
import { TrialConfigurationTab } from './tabs/TrialConfigurationTab'
import { PasswordVaultTab } from './tabs/PasswordVaultTab'
import C3DFileBrowser from '../../c3d/C3DFileBrowser'
import type { AdminLocationState, AdminTabType } from '../../../types/navigation'

/**
 * Admin Dashboard Component
 * Access: ADMIN role only
 * 
 * Implementation: Full admin interface with tab navigation
 * - Overview: System metrics and recent activity
 * - User Management: User CRUD operations and role management
 * - Patient Management: Patient records and therapist assignments
 * - Trial Configuration: GHOSTLY-TRIAL-DEFAULT settings
 */
export function AdminDashboard() {
  const { userRole } = useAuth()
  const location = useLocation()
  
  // Type-safe location state handling
  const locationState = location.state as AdminLocationState | null
  const locationTab = locationState?.activeTab || 'overview'
  
  // Map location tab to internal tab names with type safety
  const mapTabName = (tab: string): AdminTabType => {
    // The sidebar sends these tab values, map them to our internal tab names
    switch(tab) {
      case 'users': return 'users'
      case 'patients': return 'patients'
      case 'configuration': return 'configuration'
      case 'sessions': return 'sessions'
      case 'password-vault': return 'password-vault'
      case 'overview': 
      default: return 'overview'
    }
  }
  
  // Default to overview tab for admins after login
  const [activeTab, setActiveTab] = useState<AdminTabType>(mapTabName(locationTab))
  
  // Update active tab when location state changes with type safety
  useEffect(() => {
    const state = location.state as AdminLocationState | null
    if (state?.activeTab) {
      setActiveTab(mapTabName(state.activeTab))
    }
  }, [location.state])
  
  // Handle both uppercase (from useAuth) and lowercase (from App.tsx) 
  if (userRole && userRole.toLowerCase() !== 'admin') {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <h1 className="text-xl font-semibold text-destructive">Access Denied</h1>
            <p className="text-muted-foreground">Admin access required</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the appropriate component based on activeTab from sidebar navigation
  // No tabs needed - sidebar handles all navigation
  
  if (activeTab === 'sessions') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <C3DFileBrowser onFileSelect={(filename, uploadDate) => {
          console.log('Admin viewing session:', filename, uploadDate)
        }} />
      </div>
    )
  }

  if (activeTab === 'users') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <UserManagementTab />
      </div>
    )
  }

  if (activeTab === 'patients') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <PatientManagement />
      </div>
    )
  }

  if (activeTab === 'configuration') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <TrialConfigurationTab />
      </div>
    )
  }
  
  if (activeTab === 'password-vault') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <PasswordVaultTab />
      </div>
    )
  }

  // Default to overview
  return (
    <div className="container mx-auto p-6 space-y-6">
      <OverviewTab />
    </div>
  )
}