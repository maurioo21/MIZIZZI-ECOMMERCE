import { NextRequest, NextResponse } from 'next/server'
import { API_BASE_URL } from '@/lib/config'

export const runtime = 'nodejs'
export const revalidate = 300 // 5-minute ISR cache

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || id === 'undefined' || id === 'null') {
      console.error('[v0] Invalid product ID:', id)
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const backendUrl = `${API_BASE_URL}/api/product-details/${id}`
    console.log('[v0] Proxying product-details request to backend:', backendUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15-second timeout

    try {
      const backendResponse = await fetch(backendUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })

      clearTimeout(timeoutId)

      if (!backendResponse.ok) {
        console.error(`[v0] Backend returned status ${backendResponse.status} for product ${id}`)
        return NextResponse.json(
          { error: `Backend error: ${backendResponse.status}` },
          { status: backendResponse.status }
        )
      }

      const backendData = await backendResponse.json()
      console.log(`[v0] Successfully fetched product ${id} from backend`)

      // Return backend data with caching headers
      return NextResponse.json(backendData, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5-minute cache
        },
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[v0] Backend request timeout for product ${id}`)
        return NextResponse.json(
          { error: 'Backend request timeout' },
          { status: 504 }
        )
      }

      console.error(`[v0] Backend fetch error for product ${id}:`, fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch from backend' },
        { status: 502 }
      )
    }
  } catch (error) {
    console.error('[v0] Product details API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
