'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

interface AnalyticsData {
  totalViews: number
  totalComments: number
  totalVideos: number
  uniqueViewers: number
  chart: { date: string; views: number; comments: number }[]
  topVideos: { id: string; name: string; views: number; percentage: number }[]
  countries: { name: string; code: string; views: number; percentage: number }[]
  browsers: { name: string; views: number; percentage: number }[]
  devices: { type: string; views: number; percentage: number }[]
}

type AnalyticsRange = '24h' | '7d' | '30d' | 'lifetime'

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: 'lifetime', label: 'Tout' },
]

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toLocaleString()
}

// ─── SVG Line Chart ───────────────────────────────────────
function LineChart({ 
  data, 
  selectedMetrics,
  height = 240 
}: { 
  data: { date: string; views: number; comments: number }[]
  selectedMetrics: Set<'views' | 'comments'>
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; views: number; comments: number } | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  
  const padding = { top: 20, right: 20, bottom: 30, left: 45 }
  const width = 800
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const maxVal = useMemo(() => {
    if (!data.length) return 100
    return Math.max(
      ...data.flatMap(p => [
        selectedMetrics.has('views') ? p.views : 0,
        selectedMetrics.has('comments') ? p.comments : 0
      ]),
      1
    )
  }, [data, selectedMetrics])

  const yTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(maxVal / 4))
    const ticks = []
    for (let i = 0; i <= maxVal; i += step) ticks.push(i)
    if (ticks[ticks.length - 1] < maxVal) ticks.push(maxVal)
    return ticks
  }, [maxVal])

  const getX = (i: number) => padding.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2)
  const getY = (val: number) => padding.top + chartH - (val / maxVal) * chartH

  const buildPath = (key: 'views' | 'comments') => {
    if (!data.length) return ''
    return data.map((p, i) => {
      const x = getX(i)
      const y = getY(p[key])
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }

  const buildAreaPath = (key: 'views' | 'comments') => {
    if (!data.length) return ''
    const linePath = data.map((p, i) => {
      const x = getX(i)
      const y = getY(p[key])
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
    const lastX = getX(data.length - 1)
    const firstX = getX(0)
    const bottom = padding.top + chartH
    return `${linePath} L${lastX},${bottom} L${firstX},${bottom} Z`
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr)
    if (dateStr.length <= 13) { // Hourly
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Show ~6 x-axis labels max
  const labelInterval = Math.max(1, Math.floor(data.length / 6))

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || !data.length) return
    const rect = containerRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * width
    
    // Find closest data point
    let closestIdx = 0
    let closestDist = Infinity
    data.forEach((_, i) => {
      const dist = Math.abs(getX(i) - svgX)
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = i
      }
    })
    
    setHoveredIdx(closestIdx)
    setTooltip({
      x: getX(closestIdx),
      y: e.clientY - rect.top,
      date: data[closestIdx].date,
      views: data[closestIdx].views,
      comments: data[closestIdx].comments,
    })
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        Pas de données pour cette période
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setTooltip(null); setHoveredIdx(null) }}
      >
        {/* Grid lines */}
        {yTicks.map(tick => (
          <g key={tick}>
            <line 
              x1={padding.left} y1={getY(tick)} 
              x2={width - padding.right} y2={getY(tick)} 
              stroke="#f0f0f0" strokeWidth={1}
            />
            <text 
              x={padding.left - 8} y={getY(tick)} 
              textAnchor="end" dominantBaseline="middle"
              fontSize={10} fill="#9ca3af"
            >
              {formatCount(tick)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((p, i) => {
          if (i % labelInterval !== 0 && i !== data.length - 1) return null
          return (
            <text 
              key={i} 
              x={getX(i)} y={height - 5}
              textAnchor="middle" fontSize={10} fill="#9ca3af"
            >
              {formatDateLabel(p.date)}
            </text>
          )
        })}

        {/* Areas */}
        {selectedMetrics.has('views') && (
          <path d={buildAreaPath('views')} fill="url(#viewsGradient)" />
        )}
        {selectedMetrics.has('comments') && (
          <path d={buildAreaPath('comments')} fill="url(#commentsGradient)" />
        )}

        {/* Lines */}
        {selectedMetrics.has('views') && (
          <path d={buildPath('views')} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        )}
        {selectedMetrics.has('comments') && (
          <path d={buildPath('comments')} fill="none" stroke="#ec4899" strokeWidth={2} strokeLinejoin="round" />
        )}

        {/* Hover line & dots */}
        {hoveredIdx !== null && (
          <>
            <line 
              x1={getX(hoveredIdx)} y1={padding.top} 
              x2={getX(hoveredIdx)} y2={padding.top + chartH} 
              stroke="#d1d5db" strokeWidth={1} strokeDasharray="4,4"
            />
            {selectedMetrics.has('views') && (
              <circle cx={getX(hoveredIdx)} cy={getY(data[hoveredIdx].views)} r={4} fill="#3b82f6" stroke="white" strokeWidth={2} />
            )}
            {selectedMetrics.has('comments') && (
              <circle cx={getX(hoveredIdx)} cy={getY(data[hoveredIdx].comments)} r={4} fill="#ec4899" stroke="white" strokeWidth={2} />
            )}
          </>
        )}

        {/* Gradients */}
        <defs>
          <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="commentsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Tooltip */}
      {tooltip && hoveredIdx !== null && (
        <div 
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10"
          style={{ 
            left: `${(tooltip.x / width) * 100}%`,
            top: Math.max(8, tooltip.y - 70),
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-medium mb-1">{formatDateLabel(tooltip.date)}</div>
          {selectedMetrics.has('views') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{tooltip.views} vues</span>
            </div>
          )}
          {selectedMetrics.has('comments') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              <span>{tooltip.comments} commentaires</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────
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
        if (next.size > 1) next.delete(metric) // Keep at least one selected
      } else {
        next.add(metric)
      }
      return next
    })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-gray-200">
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
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all ${
                  range === option.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
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
          <div className="space-y-6 max-w-6xl">
            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                title="Visiteurs uniques"
                value={formatCount(data.uniqueViewers || 0)}
                color="green"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
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
                title="Clips"
                value={formatCount(data.totalVideos)}
                color="gray"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                }
              />
            </div>

            {/* Line Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Évolution</h3>
                <div className="flex items-center gap-4 text-sm">
                  {selectedMetrics.has('views') && (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
                      Vues
                    </span>
                  )}
                  {selectedMetrics.has('comments') && (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="w-3 h-0.5 bg-pink-500 rounded-full" />
                      Commentaires
                    </span>
                  )}
                </div>
              </div>
              <LineChart data={data.chart} selectedMetrics={selectedMetrics} />
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Videos */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  Top Clips
                </h3>
                {data.topVideos.length > 0 ? (
                  <div className="space-y-3">
                    {data.topVideos.map((video, i) => (
                      <a
                        key={video.id}
                        href={`/v/${video.id}`}
                        className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                      >
                        <span className="w-6 text-center text-sm text-gray-400 font-medium">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{video.name}</p>
                          <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#08CF65] rounded-full transition-all"
                              style={{ width: `${video.percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 tabular-nums font-medium">{formatCount(video.views)}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Aucune donnée" />
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
                    {data.countries.map((country) => (
                      <div key={country.code} className="flex items-center gap-3">
                        <span className="text-lg w-7 text-center">{getFlagEmoji(country.code)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">{country.name}</p>
                            <span className="text-xs text-gray-500 tabular-nums">{country.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${country.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Aucune donnée" />
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
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                          {getBrowserIcon(browser.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">{browser.name}</p>
                            <span className="text-xs text-gray-500 tabular-nums">{browser.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all"
                              style={{ width: `${browser.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Aucune donnée" />
                )}
              </div>

              {/* Devices */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                  </svg>
                  Appareils
                </h3>
                {data.devices.length > 0 ? (
                  <div className="space-y-4">
                    {data.devices.map((device) => (
                      <div key={device.type} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {getDeviceIcon(device.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900 capitalize">{getDeviceLabel(device.type)}</p>
                            <span className="text-xs text-gray-500 tabular-nums">{device.percentage.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full transition-all"
                              style={{ width: `${device.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="Aucune donnée" />
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

// ─── Sub-components ───────────────────────────────────────

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  color: 'blue' | 'pink' | 'gray' | 'green'
  isSelected?: boolean
  onClick?: () => void
}

function StatCard({ title, value, icon, color, isSelected = false, onClick }: StatCardProps) {
  const colors = {
    blue: {
      bg: isSelected ? 'bg-blue-50' : 'bg-white',
      border: isSelected ? 'border-blue-200' : 'border-gray-200',
      icon: 'text-blue-500',
      dot: 'bg-blue-500',
    },
    pink: {
      bg: isSelected ? 'bg-pink-50' : 'bg-white',
      border: isSelected ? 'border-pink-200' : 'border-gray-200',
      icon: 'text-pink-500',
      dot: 'bg-pink-500',
    },
    green: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-[#08CF65]',
      dot: 'bg-[#08CF65]',
    },
    gray: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-gray-400',
      dot: 'bg-gray-400',
    },
  }

  const styles = colors[color]

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${styles.bg} ${styles.border} ${onClick ? 'hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`${styles.icon} flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{title}</p>
        <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
      </div>
      {onClick && isSelected && (
        <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${styles.dot}`} />
      )}
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  )
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2 || countryCode === 'Unknown') return '🌍'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

function getBrowserIcon(name: string): string {
  const icons: { [key: string]: string } = {
    Chrome: 'Cr',
    Firefox: 'Ff',
    Safari: 'Sa',
    Edge: 'Ed',
    Opera: 'Op',
    IE: 'IE',
  }
  return icons[name] || name.slice(0, 2)
}

function getDeviceIcon(type: string): React.ReactNode {
  if (type === 'mobile') {
    return (
      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    )
  }
  if (type === 'tablet') {
    return (
      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
    </svg>
  )
}

function getDeviceLabel(type: string): string {
  const labels: { [key: string]: string } = {
    desktop: 'Bureau',
    mobile: 'Mobile',
    tablet: 'Tablette',
  }
  return labels[type] || type
}
