import { NextResponse } from 'next/server';

interface InstagramPostResponse {
  success: boolean;
  message?: string;
  post_id?: string;
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

interface CombinedResponse {
  success: boolean;
  message?: string;
  newsData?: NewsApiResponse;
  instagramResults?: InstagramPostResponse[];
  error?: string;
}

export async function GET() {
  try {
    // Step 1: Fetch news from the news API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const newsUrl = `${baseUrl}/api/fetch-news`;
    console.log('Fetching news from:', newsUrl);
    
    const newsResponse = await fetch(newsUrl);

    if (!newsResponse.ok) {
      throw new Error(`Failed to fetch news: ${newsResponse.status} ${newsResponse.statusText}`);
    }

    const newsData: NewsApiResponse = await newsResponse.json();

    if (!newsData.success) {
      return NextResponse.json<CombinedResponse>({
        success: false,
        error: `News fetch failed: ${newsData.error || 'Unknown error'}`
      }, { status: 400 });
    }

    if (!Array.isArray(newsData.posts) || newsData.posts.length === 0) {
      return NextResponse.json<CombinedResponse>({
        success: false,
        error: 'News fetch succeeded but no valid posts found'
      }, { status: 400 });
    }

    // Step 2: Post to Instagram
    const instagramUrl = `${baseUrl}/api/post-instagram`;
    console.log('Posting to Instagram via:', instagramUrl);
    
    const instagramResponse = await fetch(instagramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newsData),
    });

    if (!instagramResponse.ok) {
      const instagramError = await instagramResponse.json();
      return NextResponse.json<CombinedResponse>({
        success: false,
        error: `Instagram post failed: ${instagramError.error || 'Unknown error'}`,
        newsData
      }, { status: instagramResponse.status });
    }

    const instagramData = await instagramResponse.json();
    if (!instagramData.success && !instagramData.results) {
      return NextResponse.json<CombinedResponse>({
        success: false,
        error: `Instagram post failed: ${instagramData.error || 'No results returned'}`,
        newsData
      }, { status: 400 });
    }

    // Determine overall success based on Instagram results
    const allPostsSuccessful = instagramData.results.every((result: InstagramPostResponse) => result.success);

    return NextResponse.json<CombinedResponse>({
      success: allPostsSuccessful,
      message: allPostsSuccessful
        ? 'Successfully fetched news and posted all to Instagram'
        : 'Fetched news and posted some to Instagram',
      newsData,
      instagramResults: instagramData.results
    }, { status: allPostsSuccessful ? 200 : 207 });

  } catch (error) {
    console.error('Combined fetch and post error:', error);
    return NextResponse.json<CombinedResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}