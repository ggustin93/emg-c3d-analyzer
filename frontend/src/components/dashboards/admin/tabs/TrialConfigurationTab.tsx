/**
 * Trial Configuration Tab Component for Admin Dashboard
 * 
 * Purpose: Manage GHOSTLY-TRIAL-DEFAULT scoring configuration
 * Architecture: Direct Supabase integration following KISS principles
 * Inspired by existing configuration patterns
 */

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { logAdminAction } from '@/services/adminAuditService'
import * as Icons from '@radix-ui/react-icons'

interface TargetDefaults {
  mvc_threshold_percentage: number
  target_duration_ch1_ms: number
  target_duration_ch2_ms: number
  target_contractions_ch1: number
  target_contractions_ch2: number
  bfr_target_lop_percentage_ch1: number
  bfr_target_lop_percentage_ch2: number
}

interface ScoringConfig {
  id: string
  name: string
  active: boolean
  parameters: Record<string, any>
  target_defaults: TargetDefaults
  created_at: string
  updated_at: string
}

export function TrialConfigurationTab() {
  const [config, setConfig] = useState<ScoringConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState<ScoringConfig | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('scoring_configuration')
        .select('*')
        .eq('id', 'a0000000-0000-0000-0000-000000000001')
        .single()

      if (error) throw error
      setConfig(data)
      setFormData(data)
    } catch (error) {
      console.error('Failed to load configuration:', error)
      toast({
        title: "Error",
        description: "Failed to load trial configuration",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData) return

    setSaving(true)
    try {
      const changes: Record<string, any> = {}
      
      // Track changes for audit log
      if (formData.active !== config?.active) {
        changes.active = { from: config?.active, to: formData.active }
      }
      if (JSON.stringify(formData.target_defaults) !== JSON.stringify(config?.target_defaults)) {
        changes.target_defaults = { from: config?.target_defaults, to: formData.target_defaults }
      }
      if (JSON.stringify(formData.parameters) !== JSON.stringify(config?.parameters)) {
        changes.parameters = { from: config?.parameters, to: formData.parameters }
      }

      const { data, error } = await supabase
        .from('scoring_configuration')
        .update({
          active: formData.active,
          target_defaults: formData.target_defaults,
          parameters: formData.parameters,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'a0000000-0000-0000-0000-000000000001')
        .select()
        .single()

      if (error) throw error

      // Log the action
      await logAdminAction({
        action: 'UPDATE_TRIAL_CONFIG',
        tableName: 'scoring_configuration',
        recordId: 'a0000000-0000-0000-0000-000000000001',
        changes
      })

      setConfig(data)
      setFormData(data)
      setEditMode(false)
      
      toast({
        title: "Success",
        description: "Trial configuration updated successfully"
      })
    } catch (error) {
      console.error('Failed to save configuration:', error)
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTargetDefaultChange = (field: keyof TargetDefaults, value: number) => {
    if (!formData) return
    setFormData({
      ...formData,
      target_defaults: {
        ...formData.target_defaults,
        [field]: value
      }
    })
  }

  const handleParameterChange = (key: string, value: any) => {
    if (!formData) return
    setFormData({
      ...formData,
      parameters: {
        ...formData.parameters,
        [key]: value
      }
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="border border-gray-200/70 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Icons.UpdateIcon className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2">Loading configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <Card className="border border-gray-200/70 shadow-lg bg-gradient-to-br from-white via-gray-50/20 to-blue-50/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200/80 shadow-sm">
                <Icons.GearIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">GHOSTLY-TRIAL-DEFAULT Configuration</CardTitle>
                <CardDescription className="mt-1">System-wide scoring and parameter settings for the clinical trial</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config?.active ? "default" : "secondary"}>
                {config?.active ? "Active" : "Inactive"}
              </Badge>
              {editMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditMode(false)
                      setFormData(config)
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving && <Icons.UpdateIcon className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setEditMode(true)}
                >
                  <Icons.Pencil1Icon className="mr-2 h-4 w-4" />
                  Edit Configuration
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuration Tabs */}
      <Tabs defaultValue="target-defaults" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="target-defaults">Target Defaults</TabsTrigger>
          <TabsTrigger value="scoring-params">Scoring Parameters</TabsTrigger>
          <TabsTrigger value="system-settings">System Settings</TabsTrigger>
        </TabsList>

        {/* Target Defaults Tab */}
        <TabsContent value="target-defaults">
          <Card className="border border-gray-200/70 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Patient Initialization Defaults</CardTitle>
              <CardDescription>Default values used when creating new patient records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900">MVC & Duration Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mvc_threshold">MVC Threshold Percentage</Label>
                    <Input
                      id="mvc_threshold"
                      type="number"
                      value={formData?.target_defaults.mvc_threshold_percentage || 75}
                      onChange={(e) => handleTargetDefaultChange('mvc_threshold_percentage', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                      max={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration_ch1">Target Duration CH1 (ms)</Label>
                    <Input
                      id="duration_ch1"
                      type="number"
                      value={formData?.target_defaults.target_duration_ch1_ms || 2000}
                      onChange={(e) => handleTargetDefaultChange('target_duration_ch1_ms', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration_ch2">Target Duration CH2 (ms)</Label>
                    <Input
                      id="duration_ch2"
                      type="number"
                      value={formData?.target_defaults.target_duration_ch2_ms || 2000}
                      onChange={(e) => handleTargetDefaultChange('target_duration_ch2_ms', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900">Contraction & BFR Settings</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contractions_ch1">Target Contractions CH1</Label>
                    <Input
                      id="contractions_ch1"
                      type="number"
                      value={formData?.target_defaults.target_contractions_ch1 || 12}
                      onChange={(e) => handleTargetDefaultChange('target_contractions_ch1', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contractions_ch2">Target Contractions CH2</Label>
                    <Input
                      id="contractions_ch2"
                      type="number"
                      value={formData?.target_defaults.target_contractions_ch2 || 12}
                      onChange={(e) => handleTargetDefaultChange('target_contractions_ch2', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bfr_ch1">BFR Target LOP % CH1</Label>
                    <Input
                      id="bfr_ch1"
                      type="number"
                      value={formData?.target_defaults.bfr_target_lop_percentage_ch1 || 50}
                      onChange={(e) => handleTargetDefaultChange('bfr_target_lop_percentage_ch1', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                      max={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bfr_ch2">BFR Target LOP % CH2</Label>
                    <Input
                      id="bfr_ch2"
                      type="number"
                      value={formData?.target_defaults.bfr_target_lop_percentage_ch2 || 50}
                      onChange={(e) => handleTargetDefaultChange('bfr_target_lop_percentage_ch2', parseInt(e.target.value))}
                      disabled={!editMode}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Parameters Tab */}
        <TabsContent value="scoring-params">
          <Card className="border border-gray-200/70 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Scoring Parameters</CardTitle>
              <CardDescription>Advanced parameters for EMG analysis and scoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formData?.parameters && Object.entries(formData.parameters).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <Label htmlFor={key} className="text-sm font-medium">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    <Input
                      id={key}
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) => handleParameterChange(key, typeof value === 'number' ? parseFloat(e.target.value) : e.target.value)}
                      disabled={!editMode}
                      className="w-32"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="system-settings">
          <Card className="border border-gray-200/70 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">System Settings</CardTitle>
              <CardDescription>Global system configuration and feature flags</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="active-status">Configuration Status</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enable or disable this configuration for all users
                    </p>
                  </div>
                  <Switch
                    id="active-status"
                    checked={formData?.active || false}
                    onCheckedChange={(checked) => {
                      if (!formData) return
                      setFormData({ ...formData, active: checked })
                    }}
                    disabled={!editMode}
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>Configuration ID:</strong> {config?.id}</p>
                    <p><strong>Name:</strong> {config?.name}</p>
                    <p><strong>Created:</strong> {config?.created_at ? new Date(config.created_at).toLocaleString() : 'N/A'}</p>
                    <p><strong>Last Updated:</strong> {config?.updated_at ? new Date(config.updated_at).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}