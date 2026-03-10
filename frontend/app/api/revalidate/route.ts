import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Revalidate endpoint for clearing Next.js cache tags
 * Called when admin updates categories to refresh cached homepage data
 * 
 * Usage:
 * POST /api/revalidate
 * Body: { tags: ["homepage", "feature-cards"] }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request is from internal admin or has auth token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    // You can add token validation here if needed
    // For now, we'll keep it simple for localhost development

    const body = await request.json()
    const { tags } = body

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'tags array is required' },
        { status: 400 }
      )
    }

    console.log('[Revalidate] Clearing cache tags:', tags)

    // Revalidate each tag
    tags.forEach((tag: string) => {
      revalidateTag(tag)
      console.log(`[Revalidate] Cleared tag: ${tag}`)
    })

    return NextResponse.json(
      { 
        success: true, 
        message: `Revalidated ${tags.length} cache tag(s)`,
        tags
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Revalidate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to revalidate cache' },
      { status: 500 }
    )
  }
}
