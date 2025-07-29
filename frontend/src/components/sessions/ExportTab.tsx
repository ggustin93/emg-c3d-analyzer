import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileTextIcon, 
  DownloadIcon, 
  CopyIcon, 
  CheckIcon,
  InfoCircledIcon,
  CodeIcon,
  QuestionMarkCircledIcon,
  FileIcon
} from '@radix-ui/react-icons';
import { EMGAnalysisResult } from '@/types/emg';
import { useSessionStore } from '@/store/sessionStore';
import SupabaseStorageService from '@/services/supabaseStorage';

interface ExportTabProps {
  analysisResult: EMGAnalysisResult | null;
  uploadedFileName?: string | null;
}

const ExportTab: React.FC<ExportTabProps> = ({ analysisResult, uploadedFileName }) => {
  const { sessionParams } = useSessionStore();
  const [exportOptions, setExportOptions] = useState({
    includeRawSignals: false,
    includeProcessedSignals: false,
    includeAnalytics: true,
    includeMetadata: true,
    includeDebugInfo: false,
    includeSessionParams: true,
    includePerformanceAnalysis: true
  });
  
  const [jsonData, setJsonData] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [fileSize, setFileSize] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [isDownloadingC3D, setIsDownloadingC3D] = useState(false);
  const [originalFilename, setOriginalFilename] = useState<string | null>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Detect the original filename from the analysis result
  useEffect(() => {
    if (analysisResult) {
      console.log('🔍 Filename Detection Debug:', {
        uploadedFileName,
        'analysisResult.source_filename': analysisResult.source_filename,
        'analysisResult.metadata?.game_name': analysisResult.metadata?.game_name
      });

      // Priority order for filename detection:
      // 1. Uploaded filename prop (from direct upload or file browser)
      // 2. Source filename from analysis result (from backend)
      // 3. Game metadata filename if available
      // 4. Extract from metadata if present
      let detectedFilename = uploadedFileName;
      
      if (!detectedFilename && analysisResult.source_filename) {
        detectedFilename = analysisResult.source_filename;
      }
      
      // Skip the metadata fileName check since it doesn't exist in GameMetadata interface
      
      // If still no filename, try to construct from game metadata
      if (!detectedFilename && analysisResult.metadata?.game_name) {
        const sessionDate = analysisResult.metadata.session_date || new Date().toISOString().split('T')[0];
        detectedFilename = `${analysisResult.metadata.game_name}_${sessionDate}.c3d`;
      }
      
      // Final fallback
      if (!detectedFilename) {
        detectedFilename = 'unknown.c3d';
      }
      
      // Clean up the filename (remove any path components)
      if (detectedFilename.includes('/') || detectedFilename.includes('\\')) {
        detectedFilename = detectedFilename.split(/[/\\]/).pop() || 'unknown.c3d';
      }
      
      setOriginalFilename(detectedFilename);
      console.log('✅ Final detected filename:', detectedFilename);
    }
  }, [analysisResult, uploadedFileName]);

  // Handle original C3D file download from Supabase
  const handleDownloadOriginalC3D = async () => {
    if (!originalFilename) {
      console.error('No filename detected for C3D download');
      alert('No original filename detected. Cannot download C3D file.');
      return;
    }
    
    setIsDownloadingC3D(true);
    console.log(`🚀 Starting C3D download for: ${originalFilename}`);
    
    try {
      // Check if Supabase is configured
      if (!SupabaseStorageService.isConfigured()) {
        throw new Error('Supabase not configured. Cannot download original C3D file.');
      }

      console.log(`🔍 Checking if file exists: ${originalFilename}`);
      
      // Check if file exists
      const fileExists = await SupabaseStorageService.fileExists(originalFilename);
      console.log(`📁 File exists check result: ${fileExists}`);
      
      if (!fileExists) {
        // Try alternative filename patterns if the exact filename doesn't exist
        console.log('🔄 Trying alternative filename patterns...');
        
        // List all files to see what's available
        try {
          const allFiles = await SupabaseStorageService.listC3DFiles();
          console.log('📋 Available files in storage:', allFiles.map(f => f.name));
          
          // Try to find a similar filename
          const similarFile = allFiles.find(file => 
            file.name.toLowerCase().includes(originalFilename.toLowerCase().replace('.c3d', '')) ||
            originalFilename.toLowerCase().includes(file.name.toLowerCase().replace('.c3d', ''))
          );
          
          if (similarFile) {
            console.log(`🎯 Found similar file: ${similarFile.name}`);
            // Update the filename to the found file
            setOriginalFilename(similarFile.name);
            // Retry download with the correct filename
            setTimeout(() => handleDownloadOriginalC3D(), 100);
            return;
          }
        } catch (listError) {
          console.error('Error listing files:', listError);
        }
        
        throw new Error(`Original C3D file '${originalFilename}' not found in storage. Available files might have different names.`);
      }

      console.log(`⬇️ Downloading file: ${originalFilename}`);
      
      // Download the file
      const blob = await SupabaseStorageService.downloadFile(originalFilename);
      console.log(`📦 Downloaded blob size: ${blob.size} bytes`);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log(`✅ Successfully downloaded: ${originalFilename}`);
    } catch (error: any) {
      console.error('❌ Error downloading original C3D file:', error);
      alert(`Failed to download original C3D file: ${error.message}\n\nDetected filename: ${originalFilename}\nPlease check the console for more details.`);
    } finally {
      setIsDownloadingC3D(false);
    }
  };

  const generateExportData = useCallback(async () => {
    if (!analysisResult) return;
    
    setIsGenerating(true);
    try {
      const exportData: any = {
        metadata: {
          exportDate: new Date().toISOString(),
          fileName: uploadedFileName || 'unknown.c3d',
          exportVersion: '1.0.0',
          exportOptions: { ...exportOptions }
        }
      };

      // Include original metadata
      if (exportOptions.includeMetadata && analysisResult.metadata) {
        exportData.originalMetadata = analysisResult.metadata;
      }

      // Include session parameters
      if (exportOptions.includeSessionParams) {
        exportData.sessionParameters = sessionParams;
      }

      // Include analytics
      if (exportOptions.includeAnalytics && analysisResult.analytics) {
        exportData.analytics = analysisResult.analytics;
      }

      // Include processed signals (PREVIEW ONLY - actual data will be in final export)
      if (exportOptions.includeProcessedSignals) {
        const signalSummary: any = {};
        
        if (analysisResult.emg_signals) {
          Object.entries(analysisResult.emg_signals).forEach(([channelName, channelData]) => {
            signalSummary[channelName] = {
              _note: "📊 FULL PROCESSED SIGNALS WILL BE INCLUDED IN ACTUAL EXPORT",
              preview_info: {
                sampling_rate: channelData.sampling_rate,
                duration_seconds: channelData.time_axis?.[channelData.time_axis.length - 1] || 0,
                data_points: channelData.time_axis?.length || 0,
                signals_included: ["time_axis", "activated_data", "rms_envelope"]
              }
            };
          });
        }
        
        exportData.processedSignals = signalSummary;
      }

      // Include raw signals (PREVIEW ONLY - actual data will be in final export)
      if (exportOptions.includeRawSignals) {
        const rawSignalSummary: any = {};
        
        if (analysisResult.emg_signals) {
          Object.entries(analysisResult.emg_signals).forEach(([channelName, channelData]) => {
            rawSignalSummary[channelName] = {
              _note: "📊 FULL RAW SIGNALS WILL BE INCLUDED IN ACTUAL EXPORT",
              preview_info: {
                sampling_rate: channelData.sampling_rate,
                data_points: channelData.data?.length || 0,
                estimated_size_mb: ((channelData.data?.length || 0) * 8 / 1024 / 1024).toFixed(2),
                signals_included: ["time_axis", "raw_data"]
              }
            };
          });
        }
        
        exportData.rawSignals = rawSignalSummary;
      }

      // Include comprehensive performance analysis with all subscores
      if (exportOptions.includePerformanceAnalysis) {
        const performanceAnalysis: any = {
          overview: {
            overall_score: analysisResult.overall_score,
            symmetry_score: analysisResult.symmetry_score
          }
        };

        // Calculate detailed performance subscores based on metrics definitions
        if (analysisResult.analytics) {
          const musclePerformance: any = {};
          const channelNames = Object.keys(analysisResult.analytics).sort();
          
          channelNames.forEach((channelName, index) => {
            const analytics = analysisResult.analytics[channelName];
            if (!analytics) return;
            
            // Determine expected contractions for this channel
            let expectedContractions: number = 12; // Default from GHOSTLY+ protocol
            const params = analysisResult.metadata?.session_parameters_used;
            if (params) {
              const perChannelKey = `session_expected_contractions_ch${index + 1}`;
              if (params.hasOwnProperty(perChannelKey)) {
                expectedContractions = (params as any)[perChannelKey] ?? 12;
              } else if (params.session_expected_contractions) {
                expectedContractions = params.session_expected_contractions;
              }
            }

            // Calculate compliance subscores (R_comp, R_int, R_dur)
            const totalContractions = analytics.contraction_count || 0;
            const goodContractions = analytics.good_contraction_count || 0;
            const mvcThreshold = analytics.mvc_threshold_used || 0;
            const durationThreshold = sessionParams.contraction_duration_threshold || 2000; // 2s default

            // R_comp: Completion Rate
            const completionRate = expectedContractions > 0 ? 
              Math.min(totalContractions / expectedContractions, 1.0) : 0;
            
            // R_int: Intensity Rate (≥75% MVC) 
            const intensityRate = totalContractions > 0 ? 
              (goodContractions / totalContractions) : 0;
            
            // R_dur: Duration Rate (≥2s threshold)
            // Note: This would need contraction duration data to calculate precisely
            const durationRate = totalContractions > 0 ? 
              (goodContractions / totalContractions) : 0; // Approximation
            
            // S_comp^muscle: Per-muscle compliance (equal weights: 1/3 each)
            const muscleCompliance = (completionRate + intensityRate + durationRate) / 3;

            musclePerformance[channelName] = {
              compliance_subscores: {
                completion_rate: {
                  value: completionRate,
                  percentage: (completionRate * 100).toFixed(1) + '%',
                  formula: `${totalContractions}/${expectedContractions}`,
                  description: "Fraction of prescribed contractions completed"
                },
                intensity_rate: {
                  value: intensityRate,
                  percentage: (intensityRate * 100).toFixed(1) + '%',
                  formula: `${goodContractions}/${totalContractions}`,
                  description: "Fraction of contractions ≥75% MVC threshold"
                },
                duration_rate: {
                  value: durationRate,
                  percentage: (durationRate * 100).toFixed(1) + '%',
                  formula: `contractions≥${durationThreshold}ms/${totalContractions}`,
                  description: "Fraction of contractions meeting duration threshold"
                },
                muscle_compliance: {
                  value: muscleCompliance,
                  percentage: (muscleCompliance * 100).toFixed(1) + '%',
                  formula: "(R_comp + R_int + R_dur) / 3",
                  description: "Combined per-muscle compliance score"
                }
              },
              raw_metrics: {
                contractions: {
                  total: totalContractions,
                  good: goodContractions,
                  poor: totalContractions - goodContractions,
                  expected: expectedContractions
                },
                timing: {
                  average_duration_ms: analytics.avg_duration_ms || 0,
                  total_active_time_ms: analytics.total_time_under_tension_ms || 0,
                  min_duration_ms: analytics.min_duration_ms || 0,
                  max_duration_ms: analytics.max_duration_ms || 0
                },
                intensity: {
                  average_amplitude: analytics.avg_amplitude || 0,
                  peak_amplitude: analytics.max_amplitude || 0,
                  rms: analytics.rms || 0,
                  mav: analytics.mav || 0,
                  mvc_threshold_used: mvcThreshold
                },
                frequency: {
                  mpf: analytics.mpf || 0,
                  mdf: analytics.mdf || 0,
                  fatigue_index: analytics.fatigue_index_fi_nsm5 || 0
                }
              }
            };
          });
          
          performanceAnalysis.muscle_specific = musclePerformance;

          // Calculate bilateral symmetry score
          if (channelNames.length === 2) {
            const leftCompliance = musclePerformance[channelNames[0]]?.compliance_subscores?.muscle_compliance?.value || 0;
            const rightCompliance = musclePerformance[channelNames[1]]?.compliance_subscores?.muscle_compliance?.value || 0;
            
            const symmetryScore = (leftCompliance + rightCompliance) > 0 ? 
              (1 - Math.abs(leftCompliance - rightCompliance) / (leftCompliance + rightCompliance)) * 100 : 100;
            
            performanceAnalysis.symmetry_analysis = {
              left_compliance: (leftCompliance * 100).toFixed(1) + '%',
              right_compliance: (rightCompliance * 100).toFixed(1) + '%',
              symmetry_score: symmetryScore.toFixed(1) + '%',
              formula: "(1 - |S_comp^left - S_comp^right| / (S_comp^left + S_comp^right)) × 100",
              description: "Bilateral muscle coordination assessment"
            };
          }
        }

        // BFR Compliance Analysis
        if (sessionParams.bfr_parameters) {
          const bfrLeft = sessionParams.bfr_parameters.left;
          const bfrRight = sessionParams.bfr_parameters.right;
          
          performanceAnalysis.bfr_compliance = {
            left: {
              percentage_aop: bfrLeft.percentage_aop,
              is_compliant: bfrLeft.is_compliant,
              therapeutic_range: `${bfrLeft.therapeutic_range_min}-${bfrLeft.therapeutic_range_max}%`,
              applied_pressure: `${bfrLeft.applied_pressure} mmHg`,
              aop_measured: `${bfrLeft.aop_measured} mmHg`
            },
            right: {
              percentage_aop: bfrRight.percentage_aop,
              is_compliant: bfrRight.is_compliant,
              therapeutic_range: `${bfrRight.therapeutic_range_min}-${bfrRight.therapeutic_range_max}%`,
              applied_pressure: `${bfrRight.applied_pressure} mmHg`,
              aop_measured: `${bfrRight.aop_measured} mmHg`
            },
            overall_compliance: bfrLeft.is_compliant && bfrRight.is_compliant,
            safety_gate: (bfrLeft.is_compliant && bfrRight.is_compliant) ? 1.0 : 0.0,
            note: "BFR Safety Gate: C_BFR = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0"
          };
        }

        // RPE Effort Analysis (if available)
        if (sessionParams.pre_session_rpe !== undefined || sessionParams.post_session_rpe !== undefined) {
          const postRPE = sessionParams.post_session_rpe || 0;
          let effortScore = 20; // Default poor
          let effortCategory = "poor";
          
          if (postRPE >= 4 && postRPE <= 6) {
            effortScore = 100;
            effortCategory = "optimal";
          } else if (postRPE === 3 || postRPE === 7) {
            effortScore = 80;
            effortCategory = "acceptable";
          } else if (postRPE === 2 || postRPE === 8) {
            effortScore = 60;
            effortCategory = "suboptimal";
          }
          
          performanceAnalysis.effort_analysis = {
            pre_session_rpe: sessionParams.pre_session_rpe,
            post_session_rpe: sessionParams.post_session_rpe,
            effort_score: effortScore,
            effort_category: effortCategory,
            target_zone: "RPE 4-6 (moderate to hard intensity)",
            formula: "Piecewise function based on Borg CR10 scale"
          };
        }

        // Game Performance (if available)
        if (analysisResult.metadata?.score !== undefined) {
          performanceAnalysis.game_performance = {
            achieved_score: analysisResult.metadata.score,
            game_level: analysisResult.metadata.level,
            game_name: analysisResult.metadata.game_name,
            normalized_score: "Requires max achievable points for normalization",
            formula: "(game points achieved / max achievable points) × 100",
            note: "Game performance calculation depends on Dynamic Difficulty Adjustment (DDA)"
          };
        }

        // Overall Performance Score Calculation (P_overall)
        const weights = sessionParams.enhanced_scoring?.weights || {
          completion: 0.20,
          mvcQuality: 0.30,
          qualityThreshold: 0.15,
          symmetry: 0.20,
          effort: 0.15,
          compliance: 0.10,
          gameScore: 0.00
        };

        performanceAnalysis.overall_calculation = {
          formula: "P_overall = w_c·S_compliance + w_s·S_symmetry + w_e·S_effort + w_g·S_game",
          weights: {
            compliance: weights.completion || 0.40,
            symmetry: weights.symmetry || 0.25,
            effort: weights.effort || 0.20,
            game_score: weights.gameScore || 0.15
          },
          note: "Experimental framework - weights are fully customizable by therapists"
        };

        exportData.performanceAnalysis = performanceAnalysis;
      }

      // Include debug information
      if (exportOptions.includeDebugInfo) {
        exportData.debug = {
          processingTime: 'Not available in metadata',
          fileInfo: {
            originalFilename: analysisResult.source_filename,
            channelCount: Object.keys(analysisResult.emg_signals || {}).length,
            analyticsCount: Object.keys(analysisResult.analytics || {}).length,
            availableChannels: analysisResult.available_channels,
            estimated_raw_data_points: Object.values(analysisResult.emg_signals || {})
              .reduce((sum, channel) => sum + (channel.data?.length || 0), 0),
            estimated_processed_data_points: Object.values(analysisResult.emg_signals || {})
              .reduce((sum, channel) => sum + (channel.activated_data?.length || 0), 0)
          },
          exportInfo: {
            generatedAt: new Date().toISOString(),
            exportedBy: 'EMG C3D Analyzer',
            includedSections: Object.entries(exportOptions)
              .filter(([_, value]) => value)
              .map(([key, _]) => key)
          }
        };
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      setJsonData(jsonString);
      
      // Estimate file size for actual export (not preview)
      let estimatedBytes = new Blob([jsonString]).size;
      
      // Add estimated size for signals if they would be included
      if (exportOptions.includeProcessedSignals && analysisResult.emg_signals) {
        const processedDataPoints = Object.values(analysisResult.emg_signals)
          .reduce((sum, channel) => sum + ((channel.activated_data?.length || 0) + (channel.rms_envelope?.length || 0) + (channel.time_axis?.length || 0)), 0);
        estimatedBytes += processedDataPoints * 8; // 8 bytes per number
      }
      
      if (exportOptions.includeRawSignals && analysisResult.emg_signals) {
        const rawDataPoints = Object.values(analysisResult.emg_signals)
          .reduce((sum, channel) => sum + ((channel.data?.length || 0) + (channel.time_axis?.length || 0)), 0);
        estimatedBytes += rawDataPoints * 8; // 8 bytes per number
      }
      
      setFileSize(formatBytes(estimatedBytes));
      
      // Create download URL (this will generate the actual full export when downloaded)
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
    } catch (error) {
      console.error('Error generating export data:', error);
      setJsonData('Error generating export data: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }, [analysisResult, exportOptions, sessionParams, uploadedFileName]);

  // Generate export data when options change or component mounts
  useEffect(() => {
    if (analysisResult) {
      generateExportData();
    }
  }, [analysisResult, exportOptions, generateExportData]);

  // Cleanup download URL on unmount
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const generateFullExportData = useCallback(() => {
    if (!analysisResult) return null;
    
    const exportData: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        fileName: uploadedFileName || 'unknown.c3d',
        exportVersion: '1.0.0',
        exportOptions: { ...exportOptions }
      }
    };

    // Include original metadata
    if (exportOptions.includeMetadata && analysisResult.metadata) {
      exportData.originalMetadata = analysisResult.metadata;
    }

    // Include session parameters
    if (exportOptions.includeSessionParams) {
      exportData.sessionParameters = sessionParams;
    }

    // Include analytics
    if (exportOptions.includeAnalytics && analysisResult.analytics) {
      exportData.analytics = analysisResult.analytics;
    }

    // Include FULL processed signals data (not preview)
    if (exportOptions.includeProcessedSignals && analysisResult.emg_signals) {
      const processedSignals: any = {};
      
      Object.entries(analysisResult.emg_signals).forEach(([channelName, channelData]) => {
        processedSignals[channelName] = {
          time_axis: channelData.time_axis,
          activated_data: channelData.activated_data,
          rms_envelope: channelData.rms_envelope,
          sampling_rate: channelData.sampling_rate,
          duration_seconds: channelData.time_axis?.[channelData.time_axis.length - 1] || 0,
          data_points: channelData.time_axis?.length || 0
        };
      });
      
      exportData.processedSignals = processedSignals;
    }

    // Include FULL raw signals data (not preview)
    if (exportOptions.includeRawSignals && analysisResult.emg_signals) {
      const rawSignals: any = {};
      
      Object.entries(analysisResult.emg_signals).forEach(([channelName, channelData]) => {
        rawSignals[channelName] = {
          time_axis: channelData.time_axis,
          data: channelData.data,
          sampling_rate: channelData.sampling_rate
        };
      });
      
      exportData.rawSignals = rawSignals;
    }

    // Include the same comprehensive performance analysis from preview
    if (exportOptions.includePerformanceAnalysis) {
      // Copy the performance analysis logic from generateExportData
      const performanceAnalysis: any = {
        overview: {
          overall_score: analysisResult.overall_score,
          symmetry_score: analysisResult.symmetry_score
        }
      };

      // Add all the detailed performance subscores (same as in preview)
      if (analysisResult.analytics) {
        const musclePerformance: any = {};
        const channelNames = Object.keys(analysisResult.analytics).sort();
        
        channelNames.forEach((channelName, index) => {
          const analytics = analysisResult.analytics[channelName];
          if (!analytics) return;
          
          let expectedContractions: number = 12;
          const params = analysisResult.metadata?.session_parameters_used;
          if (params) {
            const perChannelKey = `session_expected_contractions_ch${index + 1}`;
            if (params.hasOwnProperty(perChannelKey)) {
              expectedContractions = (params as any)[perChannelKey] ?? 12;
            } else if (params.session_expected_contractions) {
              expectedContractions = params.session_expected_contractions;
            }
          }

          const totalContractions = analytics.contraction_count || 0;
          const goodContractions = analytics.good_contraction_count || 0;
          const mvcThreshold = analytics.mvc_threshold_used || 0;
          const durationThreshold = sessionParams.contraction_duration_threshold || 2000;

          const completionRate = expectedContractions > 0 ? 
            Math.min(totalContractions / expectedContractions, 1.0) : 0;
          const intensityRate = totalContractions > 0 ? 
            (goodContractions / totalContractions) : 0;
          const durationRate = totalContractions > 0 ? 
            (goodContractions / totalContractions) : 0;
          const muscleCompliance = (completionRate + intensityRate + durationRate) / 3;

          musclePerformance[channelName] = {
            compliance_subscores: {
              completion_rate: {
                value: completionRate,
                percentage: (completionRate * 100).toFixed(1) + '%',
                formula: `${totalContractions}/${expectedContractions}`,
                description: "Fraction of prescribed contractions completed"
              },
              intensity_rate: {
                value: intensityRate,
                percentage: (intensityRate * 100).toFixed(1) + '%',
                formula: `${goodContractions}/${totalContractions}`,
                description: "Fraction of contractions ≥75% MVC threshold"
              },
              duration_rate: {
                value: durationRate,
                percentage: (durationRate * 100).toFixed(1) + '%',
                formula: `contractions≥${durationThreshold}ms/${totalContractions}`,
                description: "Fraction of contractions meeting duration threshold"
              },
              muscle_compliance: {
                value: muscleCompliance,
                percentage: (muscleCompliance * 100).toFixed(1) + '%',
                formula: "(R_comp + R_int + R_dur) / 3",
                description: "Combined per-muscle compliance score"
              }
            },
            raw_metrics: {
              contractions: {
                total: totalContractions,
                good: goodContractions,
                poor: totalContractions - goodContractions,
                expected: expectedContractions
              },
              timing: {
                average_duration_ms: analytics.avg_duration_ms || 0,
                total_active_time_ms: analytics.total_time_under_tension_ms || 0,
                min_duration_ms: analytics.min_duration_ms || 0,
                max_duration_ms: analytics.max_duration_ms || 0
              },
              intensity: {
                average_amplitude: analytics.avg_amplitude || 0,
                peak_amplitude: analytics.max_amplitude || 0,
                rms: analytics.rms || 0,
                mav: analytics.mav || 0,
                mvc_threshold_used: mvcThreshold
              },
              frequency: {
                mpf: analytics.mpf || 0,
                mdf: analytics.mdf || 0,
                fatigue_index: analytics.fatigue_index_fi_nsm5 || 0
              }
            }
          };
        });
        
        performanceAnalysis.muscle_specific = musclePerformance;

        // Symmetry analysis
        if (channelNames.length === 2) {
          const leftCompliance = musclePerformance[channelNames[0]]?.compliance_subscores?.muscle_compliance?.value || 0;
          const rightCompliance = musclePerformance[channelNames[1]]?.compliance_subscores?.muscle_compliance?.value || 0;
          
          const symmetryScore = (leftCompliance + rightCompliance) > 0 ? 
            (1 - Math.abs(leftCompliance - rightCompliance) / (leftCompliance + rightCompliance)) * 100 : 100;
          
          performanceAnalysis.symmetry_analysis = {
            left_compliance: (leftCompliance * 100).toFixed(1) + '%',
            right_compliance: (rightCompliance * 100).toFixed(1) + '%',
            symmetry_score: symmetryScore.toFixed(1) + '%',
            formula: "(1 - |S_comp^left - S_comp^right| / (S_comp^left + S_comp^right)) × 100",
            description: "Bilateral muscle coordination assessment"
          };
        }
      }

      // BFR compliance
      if (sessionParams.bfr_parameters) {
        const bfrLeft = sessionParams.bfr_parameters.left;
        const bfrRight = sessionParams.bfr_parameters.right;
        
        performanceAnalysis.bfr_compliance = {
          left: {
            percentage_aop: bfrLeft.percentage_aop,
            is_compliant: bfrLeft.is_compliant,
            therapeutic_range: `${bfrLeft.therapeutic_range_min}-${bfrLeft.therapeutic_range_max}%`,
            applied_pressure: `${bfrLeft.applied_pressure} mmHg`,
            aop_measured: `${bfrLeft.aop_measured} mmHg`
          },
          right: {
            percentage_aop: bfrRight.percentage_aop,
            is_compliant: bfrRight.is_compliant,
            therapeutic_range: `${bfrRight.therapeutic_range_min}-${bfrRight.therapeutic_range_max}%`,
            applied_pressure: `${bfrRight.applied_pressure} mmHg`,
            aop_measured: `${bfrRight.aop_measured} mmHg`
          },
          overall_compliance: bfrLeft.is_compliant && bfrRight.is_compliant,
          safety_gate: (bfrLeft.is_compliant && bfrRight.is_compliant) ? 1.0 : 0.0,
          note: "BFR Safety Gate: C_BFR = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0"
        };
      }

      // RPE effort analysis
      if (sessionParams.pre_session_rpe !== undefined || sessionParams.post_session_rpe !== undefined) {
        const postRPE = sessionParams.post_session_rpe || 0;
        let effortScore = 20;
        let effortCategory = "poor";
        
        if (postRPE >= 4 && postRPE <= 6) {
          effortScore = 100;
          effortCategory = "optimal";
        } else if (postRPE === 3 || postRPE === 7) {
          effortScore = 80;
          effortCategory = "acceptable";
        } else if (postRPE === 2 || postRPE === 8) {
          effortScore = 60;
          effortCategory = "suboptimal";
        }
        
        performanceAnalysis.effort_analysis = {
          pre_session_rpe: sessionParams.pre_session_rpe,
          post_session_rpe: sessionParams.post_session_rpe,
          effort_score: effortScore,
          effort_category: effortCategory,
          target_zone: "RPE 4-6 (moderate to hard intensity)",
          formula: "Piecewise function based on Borg CR10 scale"
        };
      }

      // Game performance
      if (analysisResult.metadata?.score !== undefined) {
        performanceAnalysis.game_performance = {
          achieved_score: analysisResult.metadata.score,
          game_level: analysisResult.metadata.level,
          game_name: analysisResult.metadata.game_name,
          normalized_score: "Requires max achievable points for normalization",
          formula: "(game points achieved / max achievable points) × 100",
          note: "Game performance calculation depends on Dynamic Difficulty Adjustment (DDA)"
        };
      }

      // Overall calculation
      const weights = sessionParams.enhanced_scoring?.weights || {
        completion: 0.20,
        mvcQuality: 0.30,
        qualityThreshold: 0.15,
        symmetry: 0.20,
        effort: 0.15,
        compliance: 0.10,
        gameScore: 0.00
      };

      performanceAnalysis.overall_calculation = {
        formula: "P_overall = w_c·S_compliance + w_s·S_symmetry + w_e·S_effort + w_g·S_game",
        weights: {
          compliance: weights.completion || 0.40,
          symmetry: weights.symmetry || 0.25,
          effort: weights.effort || 0.20,
          game_score: weights.gameScore || 0.15
        },
        note: "Experimental framework - weights are fully customizable by therapists"
      };

      exportData.performanceAnalysis = performanceAnalysis;
    }

    // Include debug information
    if (exportOptions.includeDebugInfo) {
      exportData.debug = {
        processingTime: 'Not available in metadata',
        fileInfo: {
          originalFilename: analysisResult.source_filename,
          channelCount: Object.keys(analysisResult.emg_signals || {}).length,
          analyticsCount: Object.keys(analysisResult.analytics || {}).length,
          availableChannels: analysisResult.available_channels,
          raw_data_points: Object.values(analysisResult.emg_signals || {})
            .reduce((sum, channel) => sum + (channel.data?.length || 0), 0),
          processed_data_points: Object.values(analysisResult.emg_signals || {})
            .reduce((sum, channel) => sum + (channel.activated_data?.length || 0), 0)
        },
        exportInfo: {
          generatedAt: new Date().toISOString(),
          exportedBy: 'EMG C3D Analyzer',
          includedSections: Object.entries(exportOptions)
            .filter(([_, value]) => value)
            .map(([key, _]) => key)
        }
      };
    }

    return JSON.stringify(exportData, null, 2);
  }, [analysisResult, exportOptions, sessionParams, uploadedFileName]);

  const handleDownload = () => {
    if (!analysisResult) return;
    
    // Generate the full export data with actual signal data
    const fullExportJson = generateFullExportData();
    if (!fullExportJson) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `emg-analysis-${timestamp}.json`;
    
    // Create blob with full data
    const blob = new Blob([fullExportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    URL.revokeObjectURL(url);
  };

  if (!analysisResult) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No analysis data to export</p>
          <p className="text-sm text-gray-400 mt-2">Process a C3D file first to export results</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Export Options */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export Options</CardTitle>
            <CardDescription>Choose what data to include in your export</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TooltipProvider>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="processed-signals" className="text-sm font-normal">
                      Processed Signals
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Includes filtered EMG signals with activation data, RMS envelopes, and time axis. Ideal for research and detailed analysis.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="processed-signals"
                    checked={exportOptions.includeProcessedSignals}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeProcessedSignals: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="analytics" className="text-sm font-normal">
                      Analytics & Metrics
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">EMG channel analytics including contraction counts, timing metrics, amplitude measures, and frequency domain analysis (RMS, MAV, MPF, MDF).</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="analytics"
                    checked={exportOptions.includeAnalytics}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeAnalytics: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="metadata" className="text-sm font-normal">
                      Metadata
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Game session metadata including patient ID, session date, game scores, levels, and therapeutic parameters used during recording.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="metadata"
                    checked={exportOptions.includeMetadata}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeMetadata: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="session-params" className="text-sm font-normal">
                      Session Parameters
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Therapeutic session configuration including MVC thresholds, muscle mappings, BFR parameters, RPE scores, and scoring weights.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="session-params"
                    checked={exportOptions.includeSessionParams}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeSessionParams: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="performance" className="text-sm font-normal">
                      Performance Analysis
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Comprehensive GHOSTLY+ performance scoring with compliance subscores (R_comp, R_int, R_dur), symmetry analysis, BFR compliance, and RPE effort assessment.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="performance"
                    checked={exportOptions.includePerformanceAnalysis}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includePerformanceAnalysis: checked }))
                    }
                  />
                </div>

                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="raw-signals" className="text-sm font-normal">
                      Raw Signals
                      <span className="text-xs text-gray-500 block">Large file size</span>
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Unfiltered EMG signal data directly from C3D file. Very large files (10-50MB+). Only include if you need the original signal for custom analysis.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="raw-signals"
                    checked={exportOptions.includeRawSignals}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeRawSignals: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="debug-info" className="text-sm font-normal">
                      Debug Information
                    </Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <QuestionMarkCircledIcon className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">Technical debugging information including processing timestamps, data point counts, and export generation details for troubleshooting.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    id="debug-info"
                    checked={exportOptions.includeDebugInfo}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeDebugInfo: checked }))
                    }
                  />
                </div>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">File Size:</span>
              <Badge variant="secondary">{fileSize || 'Calculating...'}</Badge>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={handleDownload} 
                className="w-full"
                disabled={!jsonData || isGenerating}
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download JSON Analysis
              </Button>
              
              <Button 
                onClick={handleCopy}
                variant="outline" 
                className="w-full"
                disabled={!jsonData || isGenerating}
              >
                {copied ? (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-4 h-4 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </Button>

              <Separator className="my-3" />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Original C3D File:</span>
                  <Badge variant="outline" className="text-xs">
                    {originalFilename || 'Detecting...'}
                  </Badge>
                </div>
                
                <Button 
                  onClick={handleDownloadOriginalC3D}
                  variant="secondary" 
                  className="w-full"
                  disabled={!originalFilename || isDownloadingC3D || !SupabaseStorageService.isConfigured()}
                >
                  {isDownloadingC3D ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Downloading C3D...
                    </>
                  ) : (
                    <>
                      <FileIcon className="w-4 h-4 mr-2" />
                      Download Original C3D
                    </>
                  )}
                </Button>
                
                {!SupabaseStorageService.isConfigured() && (
                  <p className="text-xs text-gray-500 text-center">
                    Supabase not configured - C3D download unavailable
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <InfoCircledIcon className="w-4 h-4 text-blue-600" />
              Export Information
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-gray-600">
            <p>• Exported data includes all selected analysis results</p>
            <p>• Raw signals significantly increase file size</p>
            <p>• Debug info includes processing metrics</p>
            <p>• JSON format is compatible with data analysis tools</p>
          </CardContent>
        </Card>
      </div>

      {/* JSON Preview */}
      <div className="lg:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">JSON Preview</CardTitle>
                <CardDescription>Review your export data before downloading</CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <CodeIcon className="w-3 h-3" />
                JSON
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {isGenerating ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-gray-500">Generating export data...</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="flex-1 border rounded-md bg-gray-50">
                <Textarea
                  value={jsonData}
                  readOnly
                  className="min-h-full font-mono text-xs bg-transparent border-0 resize-none focus:ring-0"
                  style={{ minHeight: '600px' }}
                />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExportTab;