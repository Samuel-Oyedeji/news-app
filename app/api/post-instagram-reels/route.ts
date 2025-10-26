import { NextResponse } from 'next/server';

interface InstagramReelRequest {
  video_url: string;
  caption: string;
  share_to_feed?: boolean;
}

interface InstagramReelResponse {
  success: boolean;
  message?: string;
  reel_id?: string;
  error?: string;
}

interface NewsApiResponse {
  success: boolean;
  posts: {
    postPayload: {
      instagramReels: InstagramReelRequest;
    };
  }[];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postReelToInstagram(reel: InstagramReelRequest, index: number): Promise<InstagramReelResponse> {
  try {
    const { video_url, caption, share_to_feed = false } = reel;

    if (!video_url || !caption) {
      return {
        success: false,
        error: `Missing required fields for reel ${index + 1}: video_url and caption`
      };
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramUserId = process.env.INSTAGRAM_USER_ID;

    if (!accessToken || !instagramUserId) {
      return {
        success: false,
        error: `Instagram credentials not configured for reel ${index + 1}. Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID environment variables.`
      };
    }

    // Step 1: Create a media container for Reels
    const instagramApiUrl = `https://graph.instagram.com/me/media`;
    const createMediaResponse = await fetch(instagramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        media_type: 'REELS',
        video_url: video_url,
        caption: caption,
        share_to_feed: share_to_feed,
      }),
    });

    if (!createMediaResponse.ok) {
      const errorData = await createMediaResponse.text();
      console.error(`Instagram Reels API error for reel ${index + 1}:`, errorData);
      return {
        success: false,
        error: `Failed to create Instagram reel ${index + 1}: ${createMediaResponse.status} ${createMediaResponse.statusText}`
      };
    }

    const mediaData = await createMediaResponse.json();
    const mediaId = mediaData.id;

    if (!mediaId) {
      return {
        success: false,
        error: `No media ID returned from Instagram Reels API for reel ${index + 1}`
      };
    }

    // Step 2: Publish the reel with retry mechanism
    const publishUrl = `https://graph.instagram.com/me/media_publish`;
    
    let attempts = 0;
    const maxAttempts = 5;
    let publishResponse: Response | undefined;
    let errorData: string | undefined;

    while (attempts < maxAttempts) {
      console.log(`Attempting to publish reel ${index + 1} (attempt ${attempts + 1}/${maxAttempts})...`);
      
      publishResponse = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          creation_id: mediaId,
        }),
      });

      if (publishResponse.ok) {
        break; // Success, exit the retry loop
      }

      errorData = await publishResponse.text();
      console.error(`Instagram Reels publish error for reel ${index + 1} (attempt ${attempts + 1}):`, errorData);

      // Check if it's a "media not ready" error (code 9007 or 100)
      const errorObj = JSON.parse(errorData);
      if (errorObj.error && (errorObj.error.code === 9007 || errorObj.error.code === 100)) {
        attempts++;
        if (attempts < maxAttempts) {
          const waitTime = Math.min(5000 * attempts, 30000); // Progressive delay: 5s, 10s, 15s, 20s, 25s, max 30s
          console.log(`Media not ready for reel ${index + 1}, waiting ${waitTime/1000} seconds before retry...`);
          await delay(waitTime);
        }
      } else {
        // Different error, don't retry
        break;
      }
    }

    if (!publishResponse || !publishResponse.ok) {
      return {
        success: false,
        error: `Failed to publish Instagram reel ${index + 1} after ${maxAttempts} attempts: ${publishResponse?.status || 'Unknown'} ${publishResponse?.statusText || 'Unknown error'}`
      };
    }

    const publishData = await publishResponse.json();
    const reelId = publishData.id;

    console.log(`Successfully posted reel to Instagram (reel ${index + 1}):`, {
      mediaId,
      reelId,
      caption: caption.substring(0, 100) + '...',
      videoUrl: video_url,
      shareToFeed: share_to_feed
    });

    return {
      success: true,
      message: `Successfully posted reel to Instagram (reel ${index + 1})`,
      reel_id: reelId
    };
  } catch (error) {
    console.error(`Instagram Reels posting error for reel ${index + 1}:`, error);
    return {
      success: false,
      error: `Internal server error for reel ${index + 1}: ${(error as Error).message}`
    };
  }
}

export async function POST(request: Request) {
  try {
    const body: NewsApiResponse = await request.json();

    if (!body.success || !Array.isArray(body.posts) || body.posts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Invalid payload: Expected a successful response with a non-empty posts array'
      }, { status: 400 });
    }

    const results: InstagramReelResponse[] = [];

    for (const [index, post] of body.posts.entries()) {
      const instagramReel = post.postPayload?.instagramReels;
      if (!instagramReel) {
        results.push({
          success: false,
          error: `Missing instagramReels postPayload for reel ${index + 1}`
        });
        continue;
      }

      const result = await postReelToInstagram(instagramReel, index);
      results.push(result);

      // Add 10-second delay between reels, except for the last reel
      if (index < body.posts.length - 1) {
        console.log(`Waiting 10 seconds before processing reel ${index + 2}`);
        await delay(10000);
      }
    }

    const allSuccessful = results.every(result => result.success);
    return NextResponse.json({
      success: allSuccessful,
      results
    }, { status: allSuccessful ? 200 : 207 }); // 207 Multi-Status for partial success
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to process request: ${(error as Error).message}`
    }, { status: 500 });
  }
}
