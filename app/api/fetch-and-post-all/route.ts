import { NextResponse } from 'next/server';

interface InstagramPostResponse {
  success: boolean;
  message?: string;
  post_id?: string;
  error?: string;
}

interface XPostResponse {
  success: boolean;
  message?: string;
  tweet_id?: string;
  error?: string;
}

interface NewsApiResponse {
  success: boolean;
  posts?: {
    headline: string;
    description: string;
    originalImage: string;
    caption: string;
    editedImage: string;
    platformImages: { instagram: string };
    link: string;
    originalHeadline: string;
    postPayload: { instagram: { image_url: string; caption: string } };
  }[];
  error?: string;
}

interface AllSocialResponse {
  success: boolean;
  message?: string;
  newsData?: NewsApiResponse;
  instagramResults?: InstagramPostResponse[];
  xResults?: XPostResponse[];
  error?: string;
}

export async function GET() {
  try {
    // Step 1: Fetch news from the news API
    const newsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-news`);

    if (!newsResponse.ok) {
      throw new Error(`Failed to fetch news: ${newsResponse.status} ${newsResponse.statusText}`);
    }

    const newsData: NewsApiResponse = await newsResponse.json();

    if (!newsData.success) {
      return NextResponse.json<AllSocialResponse>({
        success: false,
        error: `News fetch failed: ${newsData.error || 'Unknown error'}`
      }, { status: 400 });
    }

    if (!Array.isArray(newsData.posts) || newsData.posts.length === 0) {
      return NextResponse.json<AllSocialResponse>({
        success: false,
        error: 'News fetch succeeded but no valid posts found'
      }, { status: 400 });
    }

    // Step 2: Post to Instagram
    const instagramResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/post-instagram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newsData),
    });

    let instagramData: { success: boolean; results?: InstagramPostResponse[]; error?: string } = { success: false };
    if (instagramResponse.ok) {
      instagramData = await instagramResponse.json();
    } else {
      const instagramError = await instagramResponse.json();
      instagramData = { success: false, error: instagramError.error || 'Unknown error' };
    }

    // Step 3: Post to X
    const xResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/post-x`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newsData),
    });

    let xData: { success: boolean; results?: XPostResponse[]; error?: string } = { success: false };
    if (xResponse.ok) {
      xData = await xResponse.json();
    } else {
      const xError = await xResponse.json();
      xData = { success: false, error: xError.error || 'Unknown error' };
    }

    // Determine overall success
    const instagramSuccess = instagramData.success && (instagramData.results ? instagramData.results.every(result => result.success) : false);
    const xSuccess = xData.success && (xData.results ? xData.results.every(result => result.success) : false);
    const allSuccessful = instagramSuccess && xSuccess;

    return NextResponse.json<AllSocialResponse>({
      success: allSuccessful,
      message: allSuccessful
        ? 'Successfully fetched news and posted all to Instagram and X'
        : 'Fetched news and posted some to Instagram and/or X',
      newsData,
      instagramResults: instagramData.results || [],
      xResults: xData.results || []
    }, { status: allSuccessful ? 200 : 207 });

  } catch (error) {
    console.error('Combined fetch and post to Instagram and X error:', error);
    return NextResponse.json<AllSocialResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}