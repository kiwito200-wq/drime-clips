import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || '7d'

    const now = new Date()
    let startDate: Date

    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'lifetime':
      default:
        startDate = new Date(0)
    }

    const videos = await prisma.video.findMany({
      where: { ownerId: user.id },
      include: {
        views: {
          where: range !== 'lifetime' ? { createdAt: { gte: startDate } } : undefined,
        },
        comments: {
          where: range !== 'lifetime' ? { createdAt: { gte: startDate } } : undefined,
        },
      },
    })

    const totalViews = videos.reduce((sum, v) => sum + v.views.length, 0)
    const totalComments = videos.reduce((sum, v) => sum + v.comments.length, 0)
    const totalVideos = videos.length

    // Unique viewers by IP
    const uniqueIPs = new Set<string>()
    videos.forEach(v => {
      v.views.forEach(view => {
        if (view.ipAddress) uniqueIPs.add(view.ipAddress)
      })
    })
    const uniqueViewers = uniqueIPs.size

    const allViews = videos.flatMap(v => v.views.map(view => ({
      ...view,
      videoId: v.id,
      videoName: v.name,
    })))

    const chartData: { [key: string]: { views: number; comments: number } } = {}
    
    const days = range === '24h' ? 24 : range === '7d' ? 7 : range === '30d' ? 30 : 30
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * (range === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000))
      const key = range === '24h' 
        ? date.toISOString().slice(0, 13) 
        : date.toISOString().slice(0, 10)
      chartData[key] = { views: 0, comments: 0 }
    }

    allViews.forEach(view => {
      const key = range === '24h'
        ? view.createdAt.toISOString().slice(0, 13)
        : view.createdAt.toISOString().slice(0, 10)
      if (chartData[key]) {
        chartData[key].views++
      }
    })

    videos.forEach(v => {
      v.comments.forEach(comment => {
        const key = range === '24h'
          ? comment.createdAt.toISOString().slice(0, 13)
          : comment.createdAt.toISOString().slice(0, 10)
        if (chartData[key]) {
          chartData[key].comments++
        }
      })
    })

    const chart = Object.entries(chartData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const videoViewCounts = videos.map(v => ({
      id: v.id,
      name: v.name,
      views: v.views.length,
    })).sort((a, b) => b.views - a.views).slice(0, 5)

    const maxViews = Math.max(...videoViewCounts.map(v => v.views), 1)
    const topVideos = videoViewCounts.map(v => ({
      ...v,
      percentage: (v.views / maxViews) * 100,
    }))

    const countryCounts: { [key: string]: number } = {}
    const browserCounts: { [key: string]: number } = {}
    const deviceCounts: { [key: string]: number } = {}

    allViews.forEach(view => {
      const country = view.country || 'Unknown'
      const browser = view.browser || 'Unknown'
      const device = view.device || 'desktop'

      countryCounts[country] = (countryCounts[country] || 0) + 1
      browserCounts[browser] = (browserCounts[browser] || 0) + 1
      deviceCounts[device] = (deviceCounts[device] || 0) + 1
    })

    const totalViewsForPercentage = Math.max(allViews.length, 1)

    const countries = Object.entries(countryCounts)
      .map(([name, views]) => ({
        name: getCountryName(name),
        code: name,
        views,
        percentage: (views / totalViewsForPercentage) * 100,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)

    const browsers = Object.entries(browserCounts)
      .map(([name, views]) => ({
        name,
        views,
        percentage: (views / totalViewsForPercentage) * 100,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)

    const devices = Object.entries(deviceCounts)
      .map(([type, views]) => ({
        type,
        views,
        percentage: (views / totalViewsForPercentage) * 100,
      }))
      .sort((a, b) => b.views - a.views)

    return NextResponse.json({
      data: {
        totalViews,
        totalComments,
        totalVideos,
        uniqueViewers,
        chart,
        topVideos,
        countries,
        browsers,
        devices,
      },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

function getCountryName(code: string): string {
  const countries: { [key: string]: string } = {
    FR: 'France',
    US: 'États-Unis',
    GB: 'Royaume-Uni',
    DE: 'Allemagne',
    ES: 'Espagne',
    IT: 'Italie',
    CA: 'Canada',
    BE: 'Belgique',
    CH: 'Suisse',
    NL: 'Pays-Bas',
    PT: 'Portugal',
    BR: 'Brésil',
    JP: 'Japon',
    CN: 'Chine',
    IN: 'Inde',
    AU: 'Australie',
    MA: 'Maroc',
    DZ: 'Algérie',
    TN: 'Tunisie',
    SN: 'Sénégal',
    CI: 'Côte d\'Ivoire',
    Unknown: 'Inconnu',
  }
  return countries[code] || code
}
