'use client'

import { useState, useEffect, useMemo } from 'react'

interface AnalyticsData {
  totalViews: number
  totalComments: number
  totalVideos: number
  chart: { date: string; views: number; comments: number }[]
  topVideos: { id: string; name: string; views: number; percentage: number }[]
  countries: { name: string; code: string; views: number; percentage: number }[]
  browsers: { name: string; views: number; percentage: number }[]
  devices: { type: string; views: number; percentage: number }[]
}

type AnalyticsRange = '24h' | '7d' | '30d' | 'lifetime'

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: '24h', label: 'Dernières 24h' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: 'lifetime', label: 'Tout' },
]

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString()
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('7d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<Set<'views' | 'comments'>>(() => new Set(['views', 'comments'] as const))

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/analytics?range=${range}`, { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
        }
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [range])

  const toggleMetric = (metric: 'views' | 'comments') => {
    setSelectedMetrics(prev => {
      const next = new Set(prev)
      if (next.has(metric)) {
        next.delete(metric)
      } else {
        next.add(metric)
      }
      return next
    })
  }

  const chartMax = useMemo(() => {
    if (!data?.chart.length) return 100
    return Math.max(...data.chart.flatMap(p => [
      selectedMetrics.has('views') ? p.views : 0,
      selectedMetrics.has('comments') ? p.comments : 0
    ]))
  }, [data?.chart, selectedMetrics])

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Statistiques de vos clips
            </p>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            {RANGE_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  range === option.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Vues"
                value={formatCount(data.totalViews)}
                isSelected={selectedMetrics.has('views')}
                onClick={() => toggleMetric('views')}
                color="blue"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              />
              <StatCard
                title="Commentaires"
                value={formatCount(data.totalComments)}
                isSelected={selectedMetrics.has('comments')}
                onClick={() => toggleMetric('comments')}
                color="pink"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
              />
              <StatCard
                title="Total Clips"
                value={formatCount(data.totalVideos)}
                color="gray"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                }
              />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Évolution</h3>
              {data.chart.length > 0 ? (
                <div className="h-64 flex items-end gap-1">
                  {data.chart.map((point, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {selectedMetrics.has('views') && (
                        <div
                          className="w-full bg-blue-500 rounded-t transition-all"
                          style={{ height: `${(point.views / chartMax) * 200}px` }}
                        />
                      )}
                      {selectedMetrics.has('comments') && (
                        <div
                          className="w-full bg-pink-500 rounded-t transition-all"
                          style={{ height: `${(point.comments / chartMax) * 200}px` }}
                        />
                      )}
                      <span className="text-[10px] text-gray-400 mt-2 rotate-45 origin-left whitespace-nowrap">
                        {new Date(point.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  Pas de données pour cette période
                </div>
              )}
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Videos */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Top Clips
                </h3>
                {data.topVideos.length > 0 ? (
                  <div className="space-y-3">
                    {data.topVideos.map((video, i) => (
                      <div key={video.id} className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm text-gray-400 font-medium">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{video.name}</p>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#08CF65] rounded-full"
                              style={{ width: `${video.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 tabular-nums">{formatCount(video.views)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Aucune donnée</p>
                )}
              </div>

              {/* Countries */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  Pays
                </h3>
                {data.countries.length > 0 ? (
                  <div className="space-y-3">
                    {data.countries.map((country, i) => (
                      <div key={country.code} className="flex items-center gap-3">
                        <span className="text-lg">{getFlagEmoji(country.code)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{country.name}</p>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${country.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 tabular-nums">{country.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Aucune donnée</p>
                )}
              </div>

              {/* Browsers */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
                  </svg>
                  Navigateurs
                </h3>
                {data.browsers.length > 0 ? (
                  <div className="space-y-3">
                    {data.browsers.map((browser) => (
                      <div key={browser.name} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                          {browser.name.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{browser.name}</p>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${browser.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 tabular-nums">{browser.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Aucune donnée</p>
                )}
              </div>

              {/* Devices */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                  Appareils
                </h3>
                {data.devices.length > 0 ? (
                  <div className="space-y-3">
                    {data.devices.map((device) => (
                      <div key={device.type} className="flex items-center gap-3">
                        <div className="w-6 text-center">
                          {device.type === 'mobile' ? '📱' : device.type === 'tablet' ? '📱' : '💻'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 capitalize">{device.type}</p>
                          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full"
                              style={{ width: `${device.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 tabular-nums">{device.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Aucune donnée</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Pas de données</h3>
            <p className="text-gray-500 mt-1">Les analytics seront disponibles une fois que vos clips auront des vues.</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: 'blue' | 'pink' | 'gray'
  isSelected?: boolean
  onClick?: () => void
}

function StatCard({ title, value, icon, color, isSelected = false, onClick }: StatCardProps) {
  const colors = {
    blue: {
      bg: isSelected ? 'bg-blue-50' : 'bg-white',
      border: isSelected ? 'border-blue-200' : 'border-gray-200',
      icon: 'text-blue-500',
    },
    pink: {
      bg: isSelected ? 'bg-pink-50' : 'bg-white',
      border: isSelected ? 'border-pink-200' : 'border-gray-200',
      icon: 'text-pink-500',
    },
    gray: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-gray-400',
    },
  }

  const styles = colors[color]

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-4 p-5 rounded-xl border transition-all text-left ${styles.bg} ${styles.border} ${onClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`${styles.icon}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
      {onClick && (
        <div className={`ml-auto w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-[#08CF65] border-[#08CF65]' : 'border-gray-300'}`}>
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
    </button>
  )
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
