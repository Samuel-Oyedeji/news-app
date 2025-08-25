import { NextResponse } from 'next/server';

interface AllSocialResponse {
  success: boolean;
  message?: string;
  newsData?: any;
  socialPosts?: {
    instagram?: {
      success: boolean;
      post_id?: string;
      error?: string;
    };
    x?: {
      success: boolean;
      tweet_id?: string;
      error?: string;
    };
  };
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
      return NextResponse.json<AllSocialResponse>({
        success: false,
        error: `News fetch failed: ${newsData.message || 'Unknown error'}`
      }, { status: 400 });
    }

    // Step 2: Post to all social media platforms
    const socialResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/post-all-social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: newsData.platformImages.instagram,
        caption: newsData.caption,
      }),
    });

    if (!socialResponse.ok) {
      const socialError = await socialResponse.json();
      return NextResponse.json<AllSocialResponse>({
        success: false,
        error: `Social media posting failed: ${socialError.error || 'Unknown error'}`,
        newsData: newsData
      }, { status: 400 });
    }

    const socialData = await socialResponse.json();

    return NextResponse.json<AllSocialResponse>({
      success: true,
      message: 'Successfully fetched news and posted to all social media platforms',
      newsData: newsData,
      socialPosts: {
        instagram: socialData.instagram,
        x: socialData.x
      }
    });

  } catch (error) {
    console.error('Combined fetch and post to all social media error:', error);
    return NextResponse.json<AllSocialResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}
