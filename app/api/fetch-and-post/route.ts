import { NextResponse } from 'next/server';

interface CombinedResponse {
  success: boolean;
  message?: string;
  newsData?: any;
  instagramPost?: any;
  error?: string;
}

export async function GET() {
  try {
    // Step 1: Fetch news from the existing API
    const newsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-news`);
    
    if (!newsResponse.ok) {
      throw new Error(`Failed to fetch news: ${newsResponse.status} ${newsResponse.statusText}`);
    }

    const newsData = await newsResponse.json();
    
    if (!newsData.success) {
      return NextResponse.json<CombinedResponse>({
        success: false,
        error: `News fetch failed: ${newsData.message || 'Unknown error'}`
      }, { status: 400 });
    }

    // Step 2: Post to Instagram
    const instagramResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/post-instagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: newsData.platformImages.instagram,
        caption: newsData.caption,
      }),
    });

    if (!instagramResponse.ok) {
      const instagramError = await instagramResponse.json();
      return NextResponse.json<CombinedResponse>({
        success: false,
        error: `Instagram post failed: ${instagramError.error || 'Unknown error'}`,
        newsData: newsData
      }, { status: 400 });
    }

    const instagramData = await instagramResponse.json();

    return NextResponse.json<CombinedResponse>({
      success: true,
      message: 'Successfully fetched news and posted to Instagram',
      newsData: newsData,
      instagramPost: instagramData
    });

  } catch (error) {
    console.error('Combined fetch and post error:', error);
    return NextResponse.json<CombinedResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}
