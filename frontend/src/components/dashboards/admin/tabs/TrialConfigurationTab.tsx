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
import { ClinicalTooltip } from '@/components/ui/clinical-tooltip'
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
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200/80 shadow-sm">
                <Icons.GearIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-gray-900">Trial Configuration</CardTitle>
                <CardDescription className="mt-1">System-wide scoring and parameter settings for the clinical trial</CardDescription>
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
      <Tabs defaultValue="scoring-params" className="border-l border-r border-b border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
        <div className="border-b mb-4 relative">
          <TabsList className="w-full flex justify-between border border-gray-200">
            <TabsTrigger value="scoring-params" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Icons.BarChartIcon className="h-4 w-4" />
                <span>Performance Scoring</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="rpe-mapping" className="flex-1 flex-shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <div className="flex items-center gap-2">
                <Icons.ActivityLogIcon className="h-4 w-4" />
                <span>RPE Mapping</span>
              </div>
            </TabsTrigger>
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
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="channel_1_muscle" className="text-sm font-medium text-gray-700">
                        Channel 1 Muscle Name
                      </Label>
                      <Input
                        id="channel_1_muscle"
                        type="text"
                        value={formData?.target_defaults?.channel_1_muscle_name || 'Left Quadriceps'}
                        onChange={(e) => handleTargetDefaultChange('channel_1_muscle_name', e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g., Left Quadriceps"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="channel_2_muscle" className="text-sm font-medium text-gray-700">
                        Channel 2 Muscle Name
                      </Label>
                      <Input
                        id="channel_2_muscle"
                        type="text"
                        value={formData?.target_defaults?.channel_2_muscle_name || 'Right Quadriceps'}
                        onChange={(e) => handleTargetDefaultChange('channel_2_muscle_name', e.target.value)}
                        disabled={!editMode}
                        placeholder="e.g., Right Quadriceps"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <strong>Impact:</strong> These muscle names will replace "Channel 1" and "Channel 2" throughout the system in patient targets, progress charts, and clinical reports.
                  </p>
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
              <CardHeader className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-3 right-3 h-8 w-8 opacity-60 hover:opacity-100 z-10"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Icons.Pencil1Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </Button>
                <CardTitle className="text-lg flex items-center gap-2 pr-12">
                  <Icons.TargetIcon className="h-5 w-5 text-blue-600" />
                  Overall Performance Scoring
                </CardTitle>
                <CardDescription>Configure the mathematical model and component weights for performance assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Overall Performance Formula - LaTeX Style */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Overall Performance Formula</h4>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <span className="font-bold text-slate-900 text-xl font-serif italic tracking-wide">
                        S<sub className="text-lg">overall</sub> <span className="mx-2 text-amber-600">=</span>
                      </span>
                      
                      {/* Therapeutic Compliance Term */}
                      <ClinicalTooltip
                        title="Therapeutic Compliance Score"
                        description="Measures whether prescribed exercise intensity and duration achieve therapeutic effect"
                        sections={[
                          {
                            title: "Formula:",
                            type: "formula",
                            items: [
                              { 
                                label: "S<sub>compliance</sub>", 
                                value: " = (S<sub>left</sub> + S<sub>right</sub>) / 2" 
                              }
                            ]
                          },
                          {
                            title: "Components:",
                            type: "list",
                            items: [
                              { label: "Completion Rate", description: "Contractions performed (12/12 target)" },
                              { label: "Intensity Rate", description: "Force relative to MVC (≥75% target)" },
                              { label: "Duration Rate", description: "Contraction hold time (≥patient-specific threshold)" }
                            ]
                          },
                          {
                            title: "Clinical Purpose:",
                            items: [
                              { label: "Primary indicator", description: "Therapeutic dose for muscle adaptation" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-purple-100 border border-purple-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-purple-700">
                            {((formData?.weight_compliance || 0.5) * 100).toFixed(0)}% × S<sub className="text-sm">compliance</sub>
                          </span>
                        </div>
                      </ClinicalTooltip>
                      
                      <span className="text-amber-600 font-serif text-lg mx-1">+</span>
                      
                      {/* Muscle Symmetry Term */}
                      <ClinicalTooltip
                        title="Muscle Symmetry Score"
                        description="Quantifies performance balance between legs"
                        sections={[
                          {
                            title: "Formula:",
                            type: "formula",
                            items: [
                              { 
                                label: "S<sub>symmetry</sub>", 
                                value: " = (1 - |S<sub>left</sub> - S<sub>right</sub>| / (S<sub>left</sub> + S<sub>right</sub>)) × 100" 
                              }
                            ]
                          },
                          {
                            title: "Score Ranges:",
                            items: [
                              { label: ">90%", description: "Within normal limits - progress difficulty" },
                              { label: "80-90%", description: "Acceptable asymmetry - continue protocol" },
                              { label: "70-80%", description: "Moderate asymmetry - focus on weaker side" },
                              { label: "<70%", description: "Significant asymmetry - clinical review required" }
                            ]
                          },
                          {
                            title: "Clinical Purpose:",
                            items: [
                              { label: "Bilateral assessment", description: "Detects weakness, pain, or compensatory patterns" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-teal-100 border border-teal-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-teal-700">
                            {((formData?.weight_symmetry || 0.25) * 100).toFixed(0)}% × S<sub className="text-sm">symmetry</sub>
                          </span>
                        </div>
                      </ClinicalTooltip>
                      
                      <span className="text-amber-600 font-serif text-lg mx-1">+</span>
                      
                      {/* Subjective Effort Term */}
                      <ClinicalTooltip
                        title="Subjective Effort Score (RPE)"
                        description="Based on Borg CR-10 Scale (0-10 rating of perceived exertion)"
                        sections={[
                          {
                            title: "RPE Mapping:",
                            items: [
                              { label: "RPE 4-6", description: "100% - Target range for elderly rehabilitation" },
                              { label: "RPE 3, 7", description: "80% - Acceptable, monitor for adjustment" },
                              { label: "RPE 2, 8", description: "60% - Outside target, consider modification" },
                              { label: "RPE 0-1, 9-10", description: "20% - Requires immediate adjustment" }
                            ]
                          },
                          {
                            title: "Clinical Purpose:",
                            items: [
                              { label: "Safety validation", description: "RPE 4-6 represents optimal balance between therapeutic stimulus and safety for elderly patients" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-amber-100 border border-amber-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-amber-700">
                            {((formData?.weight_effort || 0.25) * 100).toFixed(0)}% × S<sub className="text-sm">effort</sub>
                          </span>
                        </div>
                      </ClinicalTooltip>
                      
                      <span className="text-amber-600 font-serif text-lg mx-1">+</span>
                      
                      {/* Game Score Term */}
                      <ClinicalTooltip
                        title="Game Performance Score"
                        description="Optional metric for patient engagement assessment"
                        sections={[
                          {
                            title: "Formula:",
                            type: "formula",
                            items: [
                              { 
                                label: "S<sub>game</sub>", 
                                value: " = (points<sub>achieved</sub> / points<sub>max</sub>) × 100" 
                              }
                            ]
                          },
                          {
                            title: "Clinical Note:",
                            items: [
                              { label: "Engagement metric", description: "Game performance does not correlate directly with therapeutic benefit" },
                              { label: "Weighted at 0%", description: "By default, game performance is not included in overall score calculation" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-slate-700">
                            {((formData?.weight_game || 0.0) * 100).toFixed(0)}% × S<sub className="text-sm">game</sub>
                          </span>
                        </div>
                      </ClinicalTooltip>
                    </div>
                  </div>

                  {/* S_compliance Formula - LaTeX Style */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">S<sub>compliance</sub> Formula</h4>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <span className="font-bold text-slate-900 text-xl font-serif italic tracking-wide">
                        S<sub className="text-lg">compliance</sub> <span className="mx-2 text-amber-600">=</span>
                      </span>
                      
                      {/* Completion Term */}
                      <ClinicalTooltip
                        title="Completion Rate"
                        description="Percentage of planned contractions completed"
                        sections={[
                          {
                            title: "Target:",
                            items: [
                              { label: "Goal", description: "12/12 contractions (100% completion rate)" }
                            ]
                          },
                          {
                            title: "Clinical Significance:",
                            items: [
                              { label: "Volume assessment", description: "Ensures adequate exercise volume for therapeutic benefit" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-blue-100 border border-blue-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-blue-700">
                            {((formData?.weight_completion || 0.333) * 100).toFixed(1)}% × Completion
                          </span>
                        </div>
                      </ClinicalTooltip>
                      
                      <span className="text-amber-600 font-serif text-lg mx-1">+</span>
                      
                      {/* Intensity Term */}
                      <ClinicalTooltip
                        title="Intensity Rate"
                        description="Percentage of contractions meeting force threshold"
                        sections={[
                          {
                            title: "Target:",
                            items: [
                              { label: "Goal", description: "≥75% MVC threshold for therapeutic effect" }
                            ]
                          },
                          {
                            title: "Clinical Significance:",
                            items: [
                              { label: "Force assessment", description: "Ensures sufficient muscle activation for adaptation" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-green-100 border border-green-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-green-700">
                            {((formData?.weight_intensity || 0.333) * 100).toFixed(1)}% × Intensity
                          </span>
                        </div>
                      </ClinicalTooltip>
                      
                      <span className="text-amber-600 font-serif text-lg mx-1">+</span>
                      
                      {/* Duration Term */}
                      <ClinicalTooltip
                        title="Duration Rate"
                        description="Percentage of contractions meeting duration threshold"
                        sections={[
                          {
                            title: "Target:",
                            items: [
                              { label: "Goal", description: "≥patient-specific duration threshold (adaptive)" }
                            ]
                          },
                          {
                            title: "Clinical Significance:",
                            items: [
                              { label: "Time under tension", description: "Ensures adequate muscle loading time for adaptation" }
                            ]
                          }
                        ]}
                      >
                        <div className="px-3 py-2 rounded-lg bg-orange-100 border border-orange-300 cursor-help">
                          <span className="font-serif italic text-lg font-medium text-orange-700">
                            {((formData?.weight_duration || 0.334) * 100).toFixed(1)}% × Duration
                          </span>
                        </div>
                      </ClinicalTooltip>
                    </div>
                    
                    {/* Component Descriptions */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                        <span><strong>Completion:</strong> % of planned contractions completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-500"></div>
                        <span><strong>Intensity:</strong> % of contractions ≥75% MVC threshold</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-orange-500"></div>
                        <span><strong>Duration:</strong> % of contractions ≥patient-specific duration threshold (adaptive)</span>
                      </div>
                    </div>
                  </div>

                  {/* Compact Component Weights */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Therapeutic Compliance */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-sm">
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
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
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
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
                          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
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
                          <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
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
                <CardTitle className="text-lg flex items-center gap-2 pr-12">
                  <Icons.PersonIcon className="h-5 w-5 text-emerald-600" />
                  RPE Mapping Configuration
                  <ClinicalTooltip
                    title="Rating of Perceived Exertion (RPE) Mapping"
                    description="Configure how patient-reported effort levels translate to numerical scores"
                    sections={[
                      {
                        title: "How RPE Mapping Works:",
                        type: "list",
                        items: [
                          { label: "RPE Scale", description: "Patients rate perceived exertion from 0 (no effort) to 10 (maximum effort)" },
                          { label: "Score Mapping", description: "Each RPE value maps to a numerical score (0-100) for S_effort calculation" },
                          { label: "Clinical Categories", description: "Define therapeutic intensity ranges (optimal, acceptable, concerning)" },
                          { label: "Impact", description: `RPE scores contribute ${((formData?.weight_effort || 0.25) * 100).toFixed(0)}% to overall performance score` }
                        ]
                      }
                    ]}
                  />
                </CardTitle>
                <CardDescription>Configure Rating of Perceived Exertion (RPE) scoring ranges. RPE scores contribute {((formData?.weight_effort || 0.25) * 100).toFixed(0)}% to the Overall Performance Score</CardDescription>
              </CardHeader>
              <CardContent>

                <div className="grid grid-cols-2 gap-4">
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

                    // User-friendly descriptions
                    const getRpeDescription = (rpe: number) => {
                      if (rpe === 0) return "No effort - Patient feels no effort at all"
                      if (rpe === 1) return "Very light - Minimal effort, barely noticeable"
                      if (rpe === 2) return "Light - Easy effort, comfortable to maintain"
                      if (rpe === 3) return "Moderate light - Noticeable effort, still comfortable"
                      if (rpe === 4) return "Moderate - Clear effort, optimal therapeutic range"
                      if (rpe === 5) return "Moderate hard - Strong effort, peak therapeutic intensity"
                      if (rpe === 6) return "Somewhat hard - Challenging effort, approaching limit"
                      if (rpe === 7) return "Hard - Difficult effort, requires focus"
                      if (rpe === 8) return "Very hard - Very difficult, near maximum capacity"
                      if (rpe === 9) return "Extremely hard - Maximum effort, very challenging"
                      if (rpe === 10) return "Maximum - Absolute maximum effort possible"
                      return "Unknown effort level"
                    }
                    
                    return (
                      <div key={rpeValue} className={`p-3 border rounded-lg ${getColorClass(rpeNum)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">RPE {rpeValue}</span>
                            <span className="text-sm font-medium text-muted-foreground">
                              {getRpeDescription(rpeNum).split(' - ')[0]}
                            </span>
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
                            className="h-8 w-16 text-sm text-center font-semibold"
                            placeholder="0"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getRpeDescription(rpeNum).split(' - ')[1]}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}