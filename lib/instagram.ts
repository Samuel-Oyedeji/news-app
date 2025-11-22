export interface InstagramPostRequest {
    image_url: string;
    caption: string;
}

export interface InstagramPostResponse {
    success: boolean;
    message?: string;
    post_id?: string;
    error?: string;
}

export async function postToInstagram(post: InstagramPostRequest): Promise<InstagramPostResponse> {
    try {
        const { image_url, caption } = post;

        if (!image_url || !caption) {
            return {
                success: false,
                error: `Missing required fields: image_url and caption`
            };
        }

        const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
        const instagramUserId = process.env.INSTAGRAM_USER_ID;

        if (!accessToken || !instagramUserId) {
            return {
                success: false,
                error: `Instagram credentials not configured. Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID environment variables.`
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
            console.error(`Instagram API error:`, errorData);
            return {
                success: false,
                error: `Failed to create Instagram post: ${createMediaResponse.status} ${createMediaResponse.statusText}`
            };
        }

        const mediaData = await createMediaResponse.json();
        const mediaId = mediaData.id;

        if (!mediaId) {
            return {
                success: false,
                error: `No media ID returned from Instagram API`
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
            console.error(`Instagram publish error:`, errorData);
            return {
                success: false,
                error: `Failed to publish Instagram post: ${publishResponse.status} ${publishResponse.statusText}`
            };
        }

        const publishData = await publishResponse.json();
        const postId = publishData.id;

        console.log(`Successfully posted to Instagram:`, {
            mediaId,
            postId,
            caption: caption.substring(0, 100) + '...',
            imageUrl: image_url
        });

        return {
            success: true,
            message: `Successfully posted to Instagram`,
            post_id: postId
        };
    } catch (error) {
        console.error(`Instagram posting error:`, error);
        return {
            success: false,
            error: `Internal server error: ${(error as Error).message}`
        };
    }
}
