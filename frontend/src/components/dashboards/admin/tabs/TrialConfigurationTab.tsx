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
  mvc_threshold_percentage?: number
  target_duration_ch1_ms?: number
  target_duration_ch2_ms?: number
  target_contractions_ch1?: number
  target_contractions_ch2?: number
  bfr_target_lop_percentage_ch1?: number
  bfr_target_lop_percentage_ch2?: number
  channel_1_muscle_name?: string
  channel_2_muscle_name?: string
}

interface ScoringWeights {
  weight_compliance?: number
  weight_symmetry?: number
  weight_effort?: number
  weight_game?: number
  weight_completion?: number
  weight_intensity?: number
  weight_duration?: number
}

interface ScoringConfig {
  id: string
  configuration_name: string
  description: string | null
  active: boolean
  weight_compliance?: number
  weight_symmetry?: number
  weight_effort?: number
  weight_game?: number
  weight_completion?: number
  weight_intensity?: number
  weight_duration?: number
  is_global: boolean
  rpe_mapping: Record<string, any>
  created_at: string
  updated_at: string
  // Legacy field for backward compatibility
  target_defaults?: TargetDefaults
  parameters?: Record<string, any>
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
      
      // Add default muscle configuration if not present
      const configWithDefaults = {
        ...data,
        target_defaults: {
          mvc_threshold_percentage: 75,
          target_duration_ch1_ms: 2000,
          target_duration_ch2_ms: 2000,
          target_contractions_ch1: 12,
          target_contractions_ch2: 12,
          bfr_target_lop_percentage_ch1: 50,
          bfr_target_lop_percentage_ch2: 50,
          channel_1_muscle_name: 'Left Quadriceps',
          channel_2_muscle_name: 'Right Quadriceps',
          ...data.target_defaults
        }
      }
      
      setConfig(configWithDefaults)
      setFormData(configWithDefaults)
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
      
      // Track scoring weight changes
      const scoringFields = ['weight_compliance', 'weight_symmetry', 'weight_effort', 'weight_game', 'weight_completion', 'weight_intensity', 'weight_duration']
      scoringFields.forEach(field => {
        if (formData[field as keyof ScoringConfig] !== config?.[field as keyof ScoringConfig]) {
          changes[field] = { from: config?.[field as keyof ScoringConfig], to: formData[field as keyof ScoringConfig] }
        }
      })

      // Track muscle configuration changes
      if (formData.target_defaults && config?.target_defaults) {
        if (JSON.stringify(formData.target_defaults) !== JSON.stringify(config.target_defaults)) {
          changes.target_defaults = { from: config.target_defaults, to: formData.target_defaults }
        }
      }

      // Track RPE mapping changes
      if (JSON.stringify(formData.rpe_mapping) !== JSON.stringify(config?.rpe_mapping)) {
        changes.rpe_mapping = { from: config?.rpe_mapping, to: formData.rpe_mapping }
      }

      const updateData: any = {
        active: formData.active,
        weight_compliance: formData.weight_compliance,
        weight_symmetry: formData.weight_symmetry,
        weight_effort: formData.weight_effort,
        weight_game: formData.weight_game,
        weight_completion: formData.weight_completion,
        weight_intensity: formData.weight_intensity,
        weight_duration: formData.weight_duration,
        rpe_mapping: formData.rpe_mapping,
        updated_at: new Date().toISOString()
      }

      // Only update target_defaults if it exists
      if (formData.target_defaults) {
        updateData.target_defaults = formData.target_defaults
      }

      const { data, error } = await supabase
        .from('scoring_configuration')
        .update(updateData)
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
        title: "✅ Trial Configuration Updated",
        description: "The GHOSTLY trial configuration has been updated successfully. Changes are now active."
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

  const handleTargetDefaultChange = (field: keyof TargetDefaults, value: number | string) => {
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

  const handleScoringWeightChange = (field: keyof ScoringWeights, value: number) => {
    if (!formData) return
    
    // Only normalize the main 4 components (compliance, symmetry, effort, game)
    const mainComponents = ['weight_compliance', 'weight_symmetry', 'weight_effort', 'weight_game']
    
    if (!mainComponents.includes(field)) {
      // For sub-components, just update directly without normalization
      setFormData({
        ...formData,
        [field]: value / 100
      })
      return
    }
    
    // Convert percentage to decimal
    const newValue = value / 100
    
    // Get current main component weights
    const currentWeights: any = {
      weight_compliance: formData.weight_compliance || 0.5,
      weight_symmetry: formData.weight_symmetry || 0.25,
      weight_effort: formData.weight_effort || 0.25,
      weight_game: formData.weight_game || 0.0
    }
    
    // Update the changed weight
    currentWeights[field] = newValue
    
    // Calculate total of other main components
    const otherWeightsTotal = Object.entries(currentWeights)
      .filter(([key]) => key !== field && mainComponents.includes(key))
      .reduce((sum, [, weight]) => sum + (weight as number), 0)
    
    // Normalize other main components to make total = 1.0
    const normalizedWeights = { ...formData }
    normalizedWeights[field] = newValue
    
    if (otherWeightsTotal > 0) {
      const scaleFactor = (1.0 - newValue) / otherWeightsTotal
      mainComponents.forEach(key => {
        if (key !== field) {
          normalizedWeights[key as keyof ScoringWeights] = (currentWeights[key] * scaleFactor)
        }
      })
    }
    
    setFormData(normalizedWeights)
  }

  const handleConfigFieldChange = (field: string, value: any) => {
    if (!formData) return
    setFormData({
      ...formData,
      [field]: value
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
                <CardTitle className="text-xl font-semibold text-gray-900">{config?.configuration_name || 'GHOSTLY-TRIAL-DEFAULT Configuration'}</CardTitle>
                <CardDescription className="mt-1">{config?.description || 'System-wide scoring and parameter settings for the clinical trial'}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config?.active ? "default" : "secondary"}>
                {config?.active ? "Active" : "Inactive"}
              </Badge>
              {editMode && (
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
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuration Tabs */}
      <Tabs defaultValue="target-defaults" className="border-l border-r border-b border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
        <div className="border-b mb-4 relative">
          <TabsList className="w-full flex justify-between border border-gray-200">
            <TabsTrigger value="target-defaults" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Icons.TargetIcon className="h-4 w-4" />
                <span>Target Defaults</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="muscle-config" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Icons.PersonIcon className="h-4 w-4" />
                <span>Muscle Config</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="scoring-params" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Icons.BarChartIcon className="h-4 w-4" />
                <span>Scoring</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="rpe-mapping" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Icons.ActivityLogIcon className="h-4 w-4" />
                <span>RPE Mapping</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Target Defaults Tab */}
        <TabsContent value="target-defaults">
          <Card className="border border-gray-200/70 shadow-lg">
            <CardHeader className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10"
                onClick={() => setEditMode(!editMode)}
              >
                <Icons.Pencil1Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
              <CardTitle className="text-lg pr-12">Patient Initialization Defaults</CardTitle>
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
                      value={formData?.target_defaults?.mvc_threshold_percentage || 75}
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
                      value={formData?.target_defaults?.target_duration_ch1_ms || 2000}
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
                      value={formData?.target_defaults?.target_duration_ch2_ms || 2000}
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
                      value={formData?.target_defaults?.target_contractions_ch1 || 12}
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
                      value={formData?.target_defaults?.target_contractions_ch2 || 12}
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
                      value={formData?.target_defaults?.bfr_target_lop_percentage_ch1 || 50}
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
                      value={formData?.target_defaults?.bfr_target_lop_percentage_ch2 || 50}
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

        {/* Muscle Configuration Tab */}
        <TabsContent value="muscle-config">
          <Card className="border border-gray-200/70 shadow-lg">
            <CardHeader className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10"
                onClick={() => setEditMode(!editMode)}
              >
                <Icons.Pencil1Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
              <CardTitle className="text-lg pr-12">Muscle Channel Configuration</CardTitle>
              <CardDescription>Configure which muscles correspond to each EMG channel for all patients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Channel 1 Configuration</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="channel_1_muscle">Channel 1 Muscle Name</Label>
                      <Input
                        id="channel_1_muscle"
                        type="text"
                        value={formData?.target_defaults?.channel_1_muscle_name || 'Left Quadriceps'}
                        onChange={(e) => handleTargetDefaultChange('channel_1_muscle_name', e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g., Left Quadriceps"
                      />
                      <p className="text-xs text-muted-foreground">
                        This will be displayed instead of "Channel 1" throughout the system
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Channel 2 Configuration</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="channel_2_muscle">Channel 2 Muscle Name</Label>
                      <Input
                        id="channel_2_muscle"
                        type="text"
                        value={formData?.target_defaults?.channel_2_muscle_name || 'Right Quadriceps'}
                        onChange={(e) => handleTargetDefaultChange('channel_2_muscle_name', e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g., Right Quadriceps"
                      />
                      <p className="text-xs text-muted-foreground">
                        This will be displayed instead of "Channel 2" throughout the system
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Icons.InfoCircledIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="text-sm font-medium text-blue-900 mb-1">Muscle Configuration Impact</h5>
                        <div className="text-sm text-blue-800 space-y-1">
                          <p>• These muscle names will appear in:</p>
                          <ul className="list-disc list-inside ml-4 space-y-1">
                            <li>Patient Treatment Targets (MVC, BFR, Duration)</li>
                            <li>Progress Charts and Analytics</li>
                            <li>Session Analysis Reports</li>
                            <li>Clinical Notes and Documentation</li>
                          </ul>
                          <p className="mt-2"><strong>Common Examples:</strong> Left/Right Quadriceps, Biceps, Triceps, Hamstrings, etc.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Parameters Tab */}
        <TabsContent value="scoring-params">
          <div className="space-y-6">
            {/* Overall Performance Scoring */}
            <Card className="border border-gray-200/70 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icons.TargetIcon className="h-5 w-5 text-blue-600" />
                  Overall Performance Scoring
                </CardTitle>
                <CardDescription>Configure the mathematical model and component weights for performance assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Compact Performance Formula */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-mono text-blue-800">
                      <span className="text-green-600 font-bold">S<sub>overall</sub></span> = 
                      <span className="text-green-600">{((formData?.weight_compliance || 0.5) * 100).toFixed(0)}%</span> × <span className="text-green-600">S<sub>compliance</sub></span> + 
                      <span className="text-purple-600">{((formData?.weight_symmetry || 0.25) * 100).toFixed(0)}%</span> × <span className="text-purple-600">S<sub>symmetry</sub></span> + 
                      <span className="text-orange-600">{((formData?.weight_effort || 0.25) * 100).toFixed(0)}%</span> × <span className="text-orange-600">S<sub>effort</sub></span> + 
                      <span className="text-gray-600">{((formData?.weight_game || 0.0) * 100).toFixed(0)}%</span> × <span className="text-gray-600">S<sub>game</sub></span>
                    </div>
                  </div>

                  {/* S_compliance Formula */}
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">S<sub>compliance</sub> Formula</h4>
                    <div className="text-sm font-mono text-green-800">
                      <span className="text-green-600 font-bold">S<sub>compliance</sub></span> = 
                      <span className="text-green-600">{((formData?.weight_completion || 0.333) * 100).toFixed(1)}%</span> × <span className="text-green-600">Completion</span> + 
                      <span className="text-green-600">{((formData?.weight_intensity || 0.333) * 100).toFixed(1)}%</span> × <span className="text-green-600">Intensity</span> + 
                      <span className="text-green-600">{((formData?.weight_duration || 0.334) * 100).toFixed(1)}%</span> × <span className="text-green-600">Duration</span>
                    </div>
                    <div className="text-xs text-green-700 mt-2">
                      <p><strong>Completion:</strong> % of planned contractions completed</p>
                      <p><strong>Intensity:</strong> % of contractions ≥75% MVC threshold</p>
                      <p><strong>Duration:</strong> % of contractions ≥patient-specific duration threshold (adaptive)</p>
                    </div>
                  </div>

                  {/* Compact Component Weights */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Therapeutic Compliance */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Compliance
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {((formData?.weight_compliance || 0.5) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={((formData?.weight_compliance || 0.5) * 100).toFixed(0)}
                        onChange={(e) => handleScoringWeightChange('weight_compliance', parseInt(e.target.value))}
                        disabled={!editMode}
                        min={0}
                        max={100}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Muscle Symmetry */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                          Symmetry
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {((formData?.weight_symmetry || 0.25) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={((formData?.weight_symmetry || 0.25) * 100).toFixed(0)}
                        onChange={(e) => handleScoringWeightChange('weight_symmetry', parseInt(e.target.value))}
                        disabled={!editMode}
                        min={0}
                        max={100}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Subjective Effort */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Effort (RPE)
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {((formData?.weight_effort || 0.25) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={((formData?.weight_effort || 0.25) * 100).toFixed(0)}
                        onChange={(e) => handleScoringWeightChange('weight_effort', parseInt(e.target.value))}
                        disabled={!editMode}
                        min={0}
                        max={100}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Game Performance */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                          Game
                          <Badge variant="outline" className="text-xs">Exp</Badge>
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {((formData?.weight_game || 0.0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Input
                        type="number"
                        value={((formData?.weight_game || 0.0) * 100).toFixed(0)}
                        onChange={(e) => handleScoringWeightChange('weight_game', parseInt(e.target.value))}
                        disabled={!editMode}
                        min={0}
                        max={50}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Compliance Sub-Components */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-base font-semibold text-gray-800">Compliance Sub-Components</h4>
                    <p className="text-sm text-muted-foreground">
                      Internal weighting for therapeutic compliance calculation
                    </p>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Completion Rate</Label>
                        <Input
                          type="number"
                          value={((formData?.weight_completion || 0.333) * 100).toFixed(1)}
                          onChange={(e) => handleScoringWeightChange('weight_completion', parseFloat(e.target.value))}
                          disabled={!editMode}
                          min={0}
                          max={100}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Intensity Rate</Label>
                        <Input
                          type="number"
                          value={((formData?.weight_intensity || 0.333) * 100).toFixed(1)}
                          onChange={(e) => handleScoringWeightChange('weight_intensity', parseFloat(e.target.value))}
                          disabled={!editMode}
                          min={0}
                          max={100}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration Rate</Label>
                        <Input
                          type="number"
                          value={((formData?.weight_duration || 0.334) * 100).toFixed(1)}
                          onChange={(e) => handleScoringWeightChange('weight_duration', parseFloat(e.target.value))}
                          disabled={!editMode}
                          min={0}
                          max={100}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configuration Details - Read Only */}
            <Card className="border border-gray-200/70 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Configuration Details</CardTitle>
                <CardDescription>Basic configuration information (read-only)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Configuration Name</Label>
                    <div className="px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-700">
                      {formData?.configuration_name || 'GHOSTLY-TRIAL-DEFAULT'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <div className="px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-700">
                      {formData?.description || 'System-wide scoring and parameter settings for the clinical trial'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RPE Mapping Tab */}
        <TabsContent value="rpe-mapping">
          <div className="space-y-6">
            {/* RPE Overview */}
            <Card className="border border-emerald-200/70 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icons.PersonIcon className="h-5 w-5 text-emerald-600" />
                  RPE Mapping Configuration
                </CardTitle>
                <CardDescription>Configure Rating of Perceived Exertion (RPE) scoring ranges for subjective effort assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                  <h4 className="text-sm font-semibold text-emerald-900 mb-2">How RPE Mapping Works</h4>
                  <div className="text-sm text-emerald-800 space-y-1">
                    <p>• <strong>RPE Scale:</strong> Patients rate perceived exertion from 0 (no effort) to 10 (maximum effort)</p>
                    <p>• <strong>Score Mapping:</strong> Each RPE value maps to a numerical score (0-100) for S<sub>effort</sub> calculation</p>
                    <p>• <strong>Clinical Categories:</strong> Define therapeutic intensity ranges (optimal, acceptable, concerning)</p>
                    <p>• <strong>Impact:</strong> RPE scores contribute {((formData?.weight_effort || 0.25) * 100).toFixed(0)}% to overall performance score</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {formData?.rpe_mapping && Object.entries(formData.rpe_mapping)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([rpeValue, mapping]) => {
                    const rpeData = mapping as { score: number; category: string; clinical: string }
                    const rpeNum = parseInt(rpeValue)
                    
                    // Color coding based on RPE value
                    const getColorClass = (rpe: number) => {
                      if (rpe <= 1) return 'border-red-200 bg-red-50'
                      if (rpe <= 3) return 'border-yellow-200 bg-yellow-50'
                      if (rpe <= 5) return 'border-green-200 bg-green-50'
                      if (rpe <= 7) return 'border-orange-200 bg-orange-50'
                      return 'border-red-300 bg-red-100'
                    }
                    
                    return (
                      <div key={rpeValue} className={`p-3 border rounded-lg ${getColorClass(rpeNum)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">RPE {rpeValue}</span>
                            <span className="text-xs text-muted-foreground">({rpeData.category})</span>
                          </div>
                          <Input
                            type="number"
                            value={rpeData.score}
                            onChange={(e) => {
                              const newScore = parseInt(e.target.value)
                              if (!formData) return
                              setFormData({
                                ...formData,
                                rpe_mapping: {
                                  ...formData.rpe_mapping,
                                  [rpeValue]: {
                                    ...rpeData,
                                    score: newScore
                                  }
                                }
                              })
                            }}
                            disabled={!editMode}
                            min={0}
                            max={100}
                            className="h-8 w-16 text-sm text-center"
                            placeholder="0"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rpeData.clinical}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* RPE Scale Reference */}
            <Card className="border border-gray-200/70 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">RPE Scale Reference Guide</CardTitle>
                <CardDescription>Standard Rating of Perceived Exertion scale interpretation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-800">0-1: No/Very Light Exertion</h4>
                      <p className="text-xs text-red-700">Patient feels no effort or very minimal effort</p>
                    </div>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-yellow-800">2-3: Light Exertion</h4>
                      <p className="text-xs text-yellow-700">Patient feels light effort, easy to maintain</p>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-800">4-5: Moderate Exertion</h4>
                      <p className="text-xs text-green-700">Optimal therapeutic intensity range</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-orange-800">6-7: Hard Exertion</h4>
                      <p className="text-xs text-orange-700">Patient feels hard effort, challenging</p>
                    </div>
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-900">8-9: Very Hard Exertion</h4>
                      <p className="text-xs text-red-800">Very hard effort, approaching maximum</p>
                    </div>
                    <div className="p-3 bg-red-200 border border-red-400 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-900">10: Maximum Exertion</h4>
                      <p className="text-xs text-red-800">Maximum possible effort</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}