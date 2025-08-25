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

export async function POST(request: Request) {
  try {
    const body: XPostRequest = await request.json();
    const { image_url, caption } = body;

    if (!image_url || !caption) {
      return NextResponse.json<XPostResponse>({
        success: false,
        error: 'Missing required fields: image_url and caption'
      }, { status: 400 });
    }

    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json<XPostResponse>({
        success: false,
        error: 'X API credentials not configured. Please set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET environment variables.'
      }, { status: 500 });
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
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    // Detect MIME type dynamically
    const type = await fileTypeFromBuffer(imageBuffer);
    if (!type) {
      return NextResponse.json<XPostResponse>({
        success: false,
        error: 'Unsupported or unknown file type for provided image_url'
      }, { status: 400 });
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
      return NextResponse.json<XPostResponse>({
        success: false,
        error: 'Tweet posted but no tweet ID was returned'
      }, { status: 500 });
    }

    return NextResponse.json<XPostResponse>({
      success: true,
      message: 'Successfully posted to X',
      tweet_id: tweetId,
    });
  } catch (error) {
    console.error('X posting error:', error);
    return NextResponse.json<XPostResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}
