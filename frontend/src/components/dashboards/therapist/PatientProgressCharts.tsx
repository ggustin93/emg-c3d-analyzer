import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  Brush,
  ReferenceLine
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Badge } from '../../ui/badge'
import { 
  BarChartIcon,
  InfoCircledIcon,
  ActivityLogIcon,
  HeartIcon
} from '@radix-ui/react-icons'

interface SessionData {
  timestamp: number
  sessionNumber: number
  performanceScore: number
  fatigueLevel: number
  adherenceRate: number
  date: Date
}

interface PatientProgressChartsProps {
  completedSessions: number
  totalSessions: number
  patientCode: string
}

// Demo data generation following realistic clinical patterns - 2.14 sessions per day average (30 sessions over 14 days)
const generateDemoSessionData = (completedSessionCount: number): SessionData[] => {
  const today = new Date()
  const sessions: SessionData[] = []
  
  // Target 2.14 sessions per day average (30 in 14 days), but most patients don't complete everything
  const daysNeeded = Math.ceil(completedSessionCount / 2.14) // Average 2.14 sessions per day
  const totalDays = Math.min(14, Math.max(3, daysNeeded)) // 3-14 days range
  let sessionIndex = 0
  
  for (let dayOffset = totalDays - 1; dayOffset >= 0 && sessionIndex < completedSessionCount; dayOffset--) {
    const currentDate = new Date(today)
    currentDate.setDate(today.getDate() - dayOffset)
    
    // Calculate sessions remaining and distribute realistically
    const sessionsRemaining = completedSessionCount - sessionIndex
    const daysRemaining = dayOffset + 1
    
    // Most days have 1-4 sessions, averaging 2.14 per day
    let sessionsPerDay
    if (sessionsRemaining <= 1) {
      sessionsPerDay = sessionsRemaining // Final sessions
    } else if (daysRemaining === 1) {
      sessionsPerDay = Math.min(6, sessionsRemaining) // Final day gets remaining (max 6)
    } else {
      // Average 2.14 per day with natural variation (1-4 sessions most days)
      const avgNeeded = sessionsRemaining / daysRemaining
      if (avgNeeded <= 1.5) {
        sessionsPerDay = Math.random() > 0.3 ? 1 : 2 // Mostly 1, sometimes 2
      } else if (avgNeeded <= 3) {
        sessionsPerDay = Math.random() > 0.5 ? 2 : 3 // Mostly 2-3
      } else {
        sessionsPerDay = Math.min(4, Math.ceil(avgNeeded + Math.random() - 0.5)) // 3-4 sessions
      }
    }
    
    // Generate clustered sessions with 5-minute intervals
    const startHour = 9 + Math.floor(Math.random() * 2) // 9-10 AM start
    const startMinute = Math.floor(Math.random() * 30) // Random start minute
    
    for (let sessionOfDay = 0; sessionOfDay < sessionsPerDay && sessionIndex < completedSessionCount; sessionOfDay++) {
      const sessionDate = new Date(currentDate)
      
      // 5-minute intervals with slight variation (±2 minutes)
      const minutesFromStart = sessionOfDay * 5 + Math.floor(Math.random() * 4) - 2 // 5min ± 2min
      const totalMinutes = startMinute + minutesFromStart
      
      sessionDate.setHours(startHour + Math.floor(totalMinutes / 60))
      sessionDate.setMinutes(totalMinutes % 60)
      sessionDate.setSeconds(0)
      sessionDate.setMilliseconds(0)
    
      // Performance: Generally improving trend with natural variations
      const basePerformance = 40 + (sessionIndex / completedSessionCount) * 35 // 40-75% base progression
      const variation = (Math.random() - 0.5) * 20 // ±10% variation
      const performanceScore = Math.max(20, Math.min(95, basePerformance + variation))
      
      // Fatigue: Variable with some correlation to performance (inverse relationship)
      const baseFatigue = 7 - (performanceScore / 100) * 3 // Higher performance = lower fatigue
      const fatigueVariation = (Math.random() - 0.5) * 3
      const fatigueLevel = Math.max(1, Math.min(10, baseFatigue + fatigueVariation))
      
      // Adherence: Starts high, some dips, recovery pattern
      let baseAdherence = 85
      if (sessionIndex > completedSessionCount * 0.3 && sessionIndex < completedSessionCount * 0.6) {
        baseAdherence = 65 // Mid-treatment dip
      } else if (sessionIndex >= completedSessionCount * 0.6) {
        baseAdherence = 80 // Recovery phase
      }
      const adherenceVariation = (Math.random() - 0.5) * 15
      const adherenceRate = Math.max(40, Math.min(100, baseAdherence + adherenceVariation))
    
      sessions.push({
        timestamp: sessionDate.getTime(),
        sessionNumber: sessionIndex + 1,
        performanceScore: Math.round(performanceScore),
        fatigueLevel: Math.round(fatigueLevel),
        adherenceRate: Math.round(adherenceRate),
        date: sessionDate
      })
      
      sessionIndex++
    }
  }
  
  return sessions.sort((a, b) => a.timestamp - b.timestamp)
}

// Color coding functions
const getPerformanceColor = (score: number): string => {
  if (score >= 80) return '#16a34a' // Green
  if (score >= 50) return '#eab308' // Yellow
  return '#dc2626' // Red
}

const getFatigueColor = (level: number): string => {
  if (level <= 3) return '#16a34a' // Green (low fatigue is good)
  if (level <= 6) return '#eab308' // Yellow
  return '#dc2626' // Red (high fatigue is bad)
}

const getAdherenceColor = (rate: number): string => {
  if (rate >= 80) return '#16a34a' // Green
  if (rate >= 60) return '#eab308' // Yellow
  return '#dc2626' // Red
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, chartType }: any) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  const sessionDate = new Date(label)
  const date = sessionDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const time = sessionDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })

  return (
    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
      <p className="font-medium text-gray-900 mb-2">Session {data.sessionNumber}</p>
      <p className="text-sm text-gray-600 mb-1">{date}</p>
      <p className="text-sm font-medium text-blue-600 mb-3">{time}</p>
      
      {chartType === 'performance' && (
        <div className="text-sm">
          <span className="font-medium text-gray-900">Performance Score: </span>
          <span style={{ color: getPerformanceColor(data.performanceScore) }}>
            {data.performanceScore}%
          </span>
        </div>
      )}
      
      {chartType === 'fatigue' && (
        <div className="text-sm">
          <span className="font-medium text-gray-900">Fatigue Level: </span>
          <span style={{ color: getFatigueColor(data.fatigueLevel) }}>
            {data.fatigueLevel}/10
          </span>
        </div>
      )}
      
      {chartType === 'adherence' && (
        <div className="text-sm">
          <span className="font-medium text-gray-900">Adherence Rate: </span>
          <span style={{ color: getAdherenceColor(data.adherenceRate) }}>
            {data.adherenceRate}%
          </span>
        </div>
      )}
    </div>
  )
}

// Custom dot component for session markers
const SessionDot = ({ cx, cy, payload, colorFunction, dataKey }: any) => {
  const color = colorFunction(payload[dataKey])
  return (
    <ReferenceDot
      x={payload.timestamp}
      y={payload[dataKey]}
      r={4}
      fill={color}
      stroke={color}
      strokeWidth={2}
    />
  )
}

export default function PatientProgressCharts({ 
  completedSessions, 
  totalSessions, 
  patientCode 
}: PatientProgressChartsProps) {
  // Generate demo data based on completed session count with realistic clinical patterns
  const sessionData = useMemo(() => {
    const completedCount = Math.max(1, completedSessions || 8) // Default to 8 if no sessions
    return generateDemoSessionData(completedCount)
  }, [completedSessions])
  
  // Calculate completion context
  const expectedTotal = totalSessions || 30 // Default expected is 30 sessions
  const completionRate = Math.round((completedSessions / expectedTotal) * 100)

  // Chart margins with more generous spacing for professional appearance and timestamp labels
  const chartMargins = { top: 30, right: 40, left: 30, bottom: 90 }

  return (
    <div className="p-6 space-y-8">
      {/* Header with demo indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
            <BarChartIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Progress Analytics</h2>
            <p className="text-sm text-gray-500">Interactive charts with zoom functionality</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 px-3 py-1">
          <InfoCircledIcon className="mr-2 h-3 w-3" />
          Demo Data
        </Badge>
      </div>

      {/* Performance Score Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <ActivityLogIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Performance Score Over Time</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Performance trends with {sessionData.length} of {expectedTotal} sessions completed ({completionRate}%)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sessionData} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(time) => {
                    const date = new Date(time)
                    const dayMonth = date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })
                    const timeStr = date.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })
                    return `${dayMonth}\n${timeStr}`
                  }}
                  tick={{ fontSize: 10 }}
                  height={80}
                />
                <YAxis 
                  domain={[0, 100]}
                  label={{ 
                    value: 'Performance Score (%)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                  tick={{ fontSize: 11 }}
                />
                
                {/* Trend line */}
                <Line
                  type="monotone"
                  dataKey="performanceScore"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                
                {/* Session dots */}
                {sessionData.map((session, index) => (
                  <ReferenceDot
                    key={`perf-dot-${index}`}
                    x={session.timestamp}
                    y={session.performanceScore}
                    r={5}
                    fill={getPerformanceColor(session.performanceScore)}
                    stroke={getPerformanceColor(session.performanceScore)}
                    strokeWidth={2}
                  />
                ))}
                
                <Tooltip content={<CustomTooltip chartType="performance" />} />
                <Brush 
                  dataKey="timestamp" 
                  height={45} 
                  stroke="#059669" 
                  strokeWidth={2}
                  strokeOpacity={1}
                  fill="#d1fae5"
                  fillOpacity={0.6}
                  className="cursor-pointer"
                  tickFormatter={(time) => {
                    const date = new Date(time)
                    const day = date.getDate().toString().padStart(2, '0')
                    const month = (date.getMonth() + 1).toString().padStart(2, '0')
                    const hours = date.getHours().toString().padStart(2, '0')
                    const minutes = date.getMinutes().toString().padStart(2, '0')
                    return `${day}/${month} ${hours}:${minutes}`
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fatigue Level Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <HeartIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Reported Fatigue Over Time</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Fatigue levels with {sessionData.length} of {expectedTotal} sessions (1=Low, 10=High)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sessionData} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(time) => {
                    const date = new Date(time)
                    const dayMonth = date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })
                    const timeStr = date.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })
                    return `${dayMonth}\n${timeStr}`
                  }}
                  tick={{ fontSize: 10 }}
                  height={80}
                />
                <YAxis 
                  domain={[1, 10]}
                  label={{ 
                    value: 'Fatigue Level (1-10)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                  tick={{ fontSize: 11 }}
                />
                
                {/* Reference line for moderate fatigue */}
                <ReferenceLine y={5.5} stroke="#94a3b8" strokeDasharray="2 2" />
                
                {/* Trend line */}
                <Line
                  type="monotone"
                  dataKey="fatigueLevel"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                
                {/* Session dots */}
                {sessionData.map((session, index) => (
                  <ReferenceDot
                    key={`fatigue-dot-${index}`}
                    x={session.timestamp}
                    y={session.fatigueLevel}
                    r={5}
                    fill={getFatigueColor(session.fatigueLevel)}
                    stroke={getFatigueColor(session.fatigueLevel)}
                    strokeWidth={2}
                  />
                ))}
                
                <Tooltip content={<CustomTooltip chartType="fatigue" />} />
                <Brush 
                  dataKey="timestamp" 
                  height={45} 
                  stroke="#ea580c" 
                  strokeWidth={2}
                  strokeOpacity={1}
                  fill="#fed7aa"
                  fillOpacity={0.6}
                  className="cursor-pointer"
                  tickFormatter={(time) => {
                    const date = new Date(time)
                    const day = date.getDate().toString().padStart(2, '0')
                    const month = (date.getMonth() + 1).toString().padStart(2, '0')
                    const hours = date.getHours().toString().padStart(2, '0')
                    const minutes = date.getMinutes().toString().padStart(2, '0')
                    return `${day}/${month} ${hours}:${minutes}`
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Adherence Trend Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <BarChartIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Adherence Trend Over Time</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Adherence with {sessionData.length} of {expectedTotal} sessions (80% target goal)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sessionData} margin={chartMargins}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(time) => {
                    const date = new Date(time)
                    const dayMonth = date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })
                    const timeStr = date.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })
                    return `${dayMonth}\n${timeStr}`
                  }}
                  tick={{ fontSize: 10 }}
                  height={80}
                />
                <YAxis 
                  domain={[0, 100]}
                  label={{ 
                    value: 'Adherence Rate (%)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle' }
                  }}
                  tick={{ fontSize: 11 }}
                />
                
                {/* Target adherence line */}
                <ReferenceLine 
                  y={80} 
                  stroke="#10b981" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ value: "Target 80%", position: "top" }}
                />
                
                {/* Trend line */}
                <Line
                  type="monotone"
                  dataKey="adherenceRate"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                
                {/* Session dots */}
                {sessionData.map((session, index) => (
                  <ReferenceDot
                    key={`adherence-dot-${index}`}
                    x={session.timestamp}
                    y={session.adherenceRate}
                    r={5}
                    fill={getAdherenceColor(session.adherenceRate)}
                    stroke={getAdherenceColor(session.adherenceRate)}
                    strokeWidth={2}
                  />
                ))}
                
                <Tooltip content={<CustomTooltip chartType="adherence" />} />
                <Brush 
                  dataKey="timestamp" 
                  height={45} 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  strokeOpacity={1}
                  fill="#dbeafe"
                  fillOpacity={0.6}
                  className="cursor-pointer"
                  tickFormatter={(time) => {
                    const date = new Date(time)
                    const day = date.getDate().toString().padStart(2, '0')
                    const month = (date.getMonth() + 1).toString().padStart(2, '0')
                    const hours = date.getHours().toString().padStart(2, '0')
                    const minutes = date.getMinutes().toString().padStart(2, '0')
                    return `${day}/${month} ${hours}:${minutes}`
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}