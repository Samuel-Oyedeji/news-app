import { NextResponse } from 'next/server';

interface InstagramPostRequest {
  image_url: string;
  caption: string;
}

interface InstagramPostResponse {
  success: boolean;
  message?: string;
  post_id?: string;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const body: InstagramPostRequest = await request.json();
    const { image_url, caption } = body;

    if (!image_url || !caption) {
      return NextResponse.json<InstagramPostResponse>({
        success: false,
        error: 'Missing required fields: image_url and caption'
      }, { status: 400 });
    }

    // Instagram Basic Display API endpoint
    const instagramApiUrl = `https://graph.instagram.com/me/media`;
    
    // You'll need to set these environment variables
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramUserId = process.env.INSTAGRAM_USER_ID;

    if (!accessToken || !instagramUserId) {
      return NextResponse.json<InstagramPostResponse>({
        success: false,
        error: 'Instagram credentials not configured. Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID environment variables.'
      }, { status: 500 });
    }

    // Step 1: Create a media container (upload the image)
    const createMediaResponse = await fetch(instagramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        image_url: image_url,
        caption: caption,
        // Optional: you can add location, user tags, etc.
      }),
    });

    if (!createMediaResponse.ok) {
      const errorData = await createMediaResponse.text();
      console.error('Instagram API error:', errorData);
      return NextResponse.json<InstagramPostResponse>({
        success: false,
        error: `Failed to create Instagram post: ${createMediaResponse.status} ${createMediaResponse.statusText}`
      }, { status: createMediaResponse.status });
    }

    const mediaData = await createMediaResponse.json();
    const mediaId = mediaData.id;

    if (!mediaId) {
      return NextResponse.json<InstagramPostResponse>({
        success: false,
        error: 'No media ID returned from Instagram API'
      }, { status: 500 });
    }

    // Step 2: Publish the media
    const publishUrl = `https://graph.instagram.com/me/media_publish`;
    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        creation_id: mediaId,
      }),
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.text();
      console.error('Instagram publish error:', errorData);
      return NextResponse.json<InstagramPostResponse>({
        success: false,
        error: `Failed to publish Instagram post: ${publishResponse.status} ${publishResponse.statusText}`
      }, { status: publishResponse.status });
    }

    const publishData = await publishResponse.json();
    const postId = publishData.id;

    console.log('Successfully posted to Instagram:', {
      mediaId,
      postId,
      caption: caption.substring(0, 100) + '...', // Log first 100 chars
      imageUrl: image_url
    });

    return NextResponse.json<InstagramPostResponse>({
      success: true,
      message: 'Successfully posted to Instagram',
      post_id: postId
    });

  } catch (error) {
    console.error('Instagram posting error:', error);
    return NextResponse.json<InstagramPostResponse>({
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    }, { status: 500 });
  }
}
