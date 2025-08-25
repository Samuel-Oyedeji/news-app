import { NextResponse } from 'next/server';

interface SocialPostRequest {
  image_url: string;
  caption: string;
}

interface SocialPostResponse {
  success: boolean;
  message?: string;
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
  error?: string;
}

export async function POST(request: Request) {
  try {
    const body: SocialPostRequest = await request.json();
    const { image_url, caption } = body;

    if (!image_url || !caption) {
      return NextResponse.json<SocialPostResponse>({
        success: false,
        error: 'Missing required fields: image_url and caption'
      }, { status: 400 });
    }

    const results: SocialPostResponse = {
      success: true,
      message: 'Social media posting completed',
      instagram: { success: false },
      x: { success: false }
    };

    // Post to Instagram
    try {
      const instagramResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/post-instagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url, caption }),
      });

      if (instagramResponse.ok) {
        const instagramData = await instagramResponse.json();
        results.instagram = {
          success: instagramData.success,
          post_id: instagramData.post_id,
          error: instagramData.error
        };
      } else {
        results.instagram = {
          success: false,
          error: `Instagram API error: ${instagramResponse.status}`
        };
      }
    } catch (instagramError) {
      results.instagram = {
        success: false,
        error: `Instagram request failed: ${(instagramError as Error).message}`
      };
    }

    // Post to X (Twitter)
    try {
      const xResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/post-x`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url, caption }),
      });

      if (xResponse.ok) {
        const xData = await xResponse.json();
        results.x = {
          success: xData.success,
          tweet_id: xData.tweet_id,
          error: xData.error
        };
      } else {
        results.x = {
          success: false,
          error: `X API error: ${xResponse.status}`
        };
      }
    } catch (xError) {
      results.x = {
        success: false,
        error: `X request failed: ${(xError as Error).message}`
      };
    }

    // Determine overall success
    const hasAnySuccess = results.instagram?.success || results.x?.success;
    if (!hasAnySuccess) {
      results.success = false;
      results.message = 'Failed to post to any social media platform';
    }

    return NextResponse.json<SocialPostResponse>(results);

  } catch (error) {
    console.error('Social media posting error:', error);
    return NextResponse.json<SocialPostResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}
