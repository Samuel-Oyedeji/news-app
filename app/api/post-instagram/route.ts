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

interface NewsApiResponse {
  success: boolean;
  posts: {
    postPayload: {
      instagram: InstagramPostRequest;
    };
  }[];
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postToInstagram(post: InstagramPostRequest, index: number): Promise<InstagramPostResponse> {
  try {
    const { image_url, caption } = post;

    if (!image_url || !caption) {
      return {
        success: false,
        error: `Missing required fields for post ${index + 1}: image_url and caption`
      };
    }

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramUserId = process.env.INSTAGRAM_USER_ID;

    if (!accessToken || !instagramUserId) {
      return {
        success: false,
        error: `Instagram credentials not configured for post ${index + 1}. Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID environment variables.`
      };
    }

    // Step 1: Create a media container
    const instagramApiUrl = `https://graph.instagram.com/me/media`;
    const createMediaResponse = await fetch(instagramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        image_url: image_url,
        caption: caption,
      }),
    });

    if (!createMediaResponse.ok) {
      const errorData = await createMediaResponse.text();
      console.error(`Instagram API error for post ${index + 1}:`, errorData);
      return {
        success: false,
        error: `Failed to create Instagram post ${index + 1}: ${createMediaResponse.status} ${createMediaResponse.statusText}`
      };
    }

    const mediaData = await createMediaResponse.json();
    const mediaId = mediaData.id;

    if (!mediaId) {
      return {
        success: false,
        error: `No media ID returned from Instagram API for post ${index + 1}`
      };
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
      console.error(`Instagram publish error for post ${index + 1}:`, errorData);
      return {
        success: false,
        error: `Failed to publish Instagram post ${index + 1}: ${publishResponse.status} ${publishResponse.statusText}`
      };
    }

    const publishData = await publishResponse.json();
    const postId = publishData.id;

    console.log(`Successfully posted to Instagram (post ${index + 1}):`, {
      mediaId,
      postId,
      caption: caption.substring(0, 100) + '...',
      imageUrl: image_url
    });

    return {
      success: true,
      message: `Successfully posted to Instagram (post ${index + 1})`,
      post_id: postId
    };
  } catch (error) {
    console.error(`Instagram posting error for post ${index + 1}:`, error);
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
        error: 'Invalid payload: Expected a successful response with a non-empty posts array'
      }, { status: 400 });
    }

    const results: InstagramPostResponse[] = [];

    for (const [index, post] of body.posts.entries()) {
      const instagramPost = post.postPayload?.instagram;
      if (!instagramPost) {
        results.push({
          success: false,
          error: `Missing instagram postPayload for post ${index + 1}`
        });
        continue;
      }

      const result = await postToInstagram(instagramPost, index);
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
    }, { status: allSuccessful ? 200 : 207 }); // 207 Multi-Status for partial success
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to process request: ${(error as Error).message}`
    }, { status: 500 });
  }
}