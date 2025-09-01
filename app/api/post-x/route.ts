import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { fileTypeFromBuffer } from 'file-type';

interface XPostRequest {
  image_url: string;
  caption: string;
}

interface XPostResponse {
  success: boolean;
  message?: string;
  tweet_id?: string;
  error?: string;
}

interface NewsApiResponse {
  success: boolean;
  posts: {
    postPayload: {
      instagram: XPostRequest;
    };
  }[];
  error?: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postToX(post: XPostRequest, index: number): Promise<XPostResponse> {
  try {
    const { image_url, caption } = post;

    if (!image_url || !caption) {
      return {
        success: false,
        error: `Missing required fields for post ${index + 1}: image_url and caption`
      };
    }

    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return {
        success: false,
        error: `X API credentials not configured for post ${index + 1}. Please set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET environment variables.`
      };
    }

    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    });

    // Fetch remote image to buffer
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch image for post ${index + 1}: ${imageResponse.status} ${imageResponse.statusText}`
      };
    }
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    // Detect MIME type dynamically
    const type = await fileTypeFromBuffer(imageBuffer);
    if (!type) {
      return {
        success: false,
        error: `Unsupported or unknown file type for provided image_url in post ${index + 1}`
      };
    }

    // Upload media (v1) with detected MIME
    const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: type.mime });

    // Truncate caption to X 280 char limit
    const text = caption.length > 280 ? `${caption.slice(0, 277)}...` : caption;

    // Create tweet (v2)
    const tweet = await client.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });

    const tweetId = tweet?.data?.id;
    if (!tweetId) {
      return {
        success: false,
        error: `Tweet posted but no tweet ID was returned for post ${index + 1}`
      };
    }

    console.log(`Successfully posted to X (post ${index + 1}):`, {
      tweetId,
      caption: text.substring(0, 100) + '...',
      imageUrl: image_url
    });

    return {
      success: true,
      message: `Successfully posted to X (post ${index + 1})`,
      tweet_id: tweetId,
    };
  } catch (error) {
    console.error(`X posting error for post ${index + 1}:`, error);
    return {
      success: false,
      error: `Internal server error for post ${index + 1}: ${(error as Error).message}`
    };
  }
}

export async function POST(request: Request) {
  try {
    const body: NewsApiResponse = await request.json();

    if (!body.success || !Array.isArray(body.posts) || body.posts.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Invalid payload: ${body.error || 'Expected a successful response with a non-empty posts array'}`
      }, { status: 400 });
    }

    const results: XPostResponse[] = [];

    for (const [index, post] of body.posts.entries()) {
      const xPost = post.postPayload?.instagram;
      if (!xPost) {
        results.push({
          success: false,
          error: `Missing instagram postPayload for post ${index + 1}`
        });
        continue;
      }

      const result = await postToX(xPost, index);
      results.push(result);

      // Add 10-second delay between posts, except for the last post
      if (index < body.posts.length - 1) {
        console.log(`Waiting 10 seconds before processing post ${index + 2}`);
        await delay(10000);
      }
    }

    const allSuccessful = results.every(result => result.success);
    return NextResponse.json({
      success: allSuccessful,
      results
    }, { status: allSuccessful ? 200 : 207 });
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to process request: ${(error as Error).message}`
    }, { status: 500 });
  }
}