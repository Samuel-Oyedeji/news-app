import { NextResponse } from 'next/server';
import crypto from 'crypto';

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

// OAuth 1.0a signature generation
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
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

    // X API v2 credentials - we need OAuth 1.0a credentials
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

    // Step 1: Upload media to X using OAuth 1.0a
    const mediaUploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    
    // Download the image and convert to base64
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // OAuth 1.0a parameters for media upload
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const oauthParams = {
      oauth_consumer_key: apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0'
    };

    // Add media_data to signature calculation
    const allParams = { ...oauthParams, media_data: base64Image };
    
    // Generate OAuth signature
    const signature = generateOAuthSignature('POST', mediaUploadUrl, allParams, apiSecret, accessTokenSecret);
    
    // Create OAuth header
    const oauthHeader = 'OAuth ' + Object.entries(oauthParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .concat(`oauth_signature="${encodeURIComponent(signature)}"`)
      .join(', ');

    // Debug logging for OAuth parameters
    console.log('=== OAuth 1.0a Media Upload Debug ===');
    console.log('API Key:', apiKey);
    console.log('API Secret:', apiSecret ? '***' + apiSecret.slice(-4) : 'NOT SET');
    console.log('Access Token:', accessToken ? '***' + accessToken.slice(-4) : 'NOT SET');
    console.log('Access Token Secret:', accessTokenSecret ? '***' + accessTokenSecret.slice(-4) : 'NOT SET');
    console.log('Timestamp:', timestamp);
    console.log('Nonce:', nonce);
    console.log('Generated Signature:', signature);
    console.log('Full OAuth Header:', oauthHeader);
    console.log('=====================================');

    // Create form data for media upload
    const mediaFormData = new FormData();
    mediaFormData.append('media_data', base64Image);

    const mediaUploadResponse = await fetch(mediaUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': oauthHeader,
      },
      body: mediaFormData,
    });

    if (!mediaUploadResponse.ok) {
      const errorData = await mediaUploadResponse.text();
      console.error('X media upload error:', errorData);
      return NextResponse.json<XPostResponse>({
        success: false,
        error: `Failed to upload media to X: ${mediaUploadResponse.status} ${mediaUploadResponse.statusText}. Details: ${errorData}`
      }, { status: mediaUploadResponse.status });
    }

    const mediaData = await mediaUploadResponse.json();
    const mediaId = mediaData.media_id_string;

    if (!mediaId) {
      return NextResponse.json<XPostResponse>({
        success: false,
        error: 'No media ID returned from X API'
      }, { status: 500 });
    }

    // Step 2: Create tweet with media using OAuth 1.0a
    const tweetUrl = 'https://api.twitter.com/2/tweets';
    
    // Truncate caption to fit X's character limit (280 characters)
    const truncatedCaption = caption.length > 280 ? caption.substring(0, 277) + '...' : caption;
    
    const tweetData = {
      text: truncatedCaption,
      media: {
        media_ids: [mediaId]
      }
    };

    // OAuth 1.0a parameters for tweet creation
    const tweetTimestamp = Math.floor(Date.now() / 1000).toString();
    const tweetNonce = crypto.randomBytes(16).toString('hex');
    
    const tweetOauthParams = {
      oauth_consumer_key: apiKey,
      oauth_nonce: tweetNonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: tweetTimestamp,
      oauth_token: accessToken,
      oauth_version: '1.0'
    };

    // Generate OAuth signature for tweet creation
    const tweetSignature = generateOAuthSignature('POST', tweetUrl, tweetOauthParams, apiSecret, accessTokenSecret);
    
    // Create OAuth header for tweet
    const tweetOauthHeader = 'OAuth ' + Object.entries(tweetOauthParams)
      .map(([key, value]) => `${key}="${encodeURIComponent(value)}"`)
      .concat(`oauth_signature="${encodeURIComponent(tweetSignature)}"`)
      .join(', ');

    // Debug logging for tweet OAuth parameters
    console.log('=== OAuth 1.0a Tweet Creation Debug ===');
    console.log('Tweet Timestamp:', tweetTimestamp);
    console.log('Tweet Nonce:', tweetNonce);
    console.log('Generated Tweet Signature:', tweetSignature);
    console.log('Full Tweet OAuth Header:', tweetOauthHeader);
    console.log('========================================');

    const tweetResponse = await fetch(tweetUrl, {
      method: 'POST',
      headers: {
        'Authorization': tweetOauthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    });

    if (!tweetResponse.ok) {
      const errorData = await tweetResponse.text();
      console.error('X tweet creation error:', errorData);
      return NextResponse.json<XPostResponse>({
        success: false,
        error: `Failed to create tweet: ${tweetResponse.status} ${tweetResponse.statusText}. Details: ${errorData}`
      }, { status: tweetResponse.status });
    }

    const tweetResult = await tweetResponse.json();
    const tweetId = tweetResult.data?.id;

    if (!tweetId) {
      return NextResponse.json<XPostResponse>({
        success: false,
        error: 'No tweet ID returned from X API'
      }, { status: 500 });
    }

    console.log('Successfully posted to X:', {
      mediaId,
      tweetId,
      caption: truncatedCaption.substring(0, 100) + '...', // Log first 100 chars
      imageUrl: image_url
    });

    return NextResponse.json<XPostResponse>({
      success: true,
      message: 'Successfully posted to X',
      tweet_id: tweetId
    });

  } catch (error) {
    console.error('X posting error:', error);
    return NextResponse.json<XPostResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}
