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

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

        // Wait a bit before attempting to publish (Instagram needs time to process the media)
        console.log('Waiting 3 seconds for media to be ready...');
        await delay(3000);

        // Step 2: Publish the media with retry mechanism
        const publishUrl = `https://graph.instagram.com/me/media_publish`;
        
        let attempts = 0;
        const maxAttempts = 5;
        let publishResponse: Response | undefined;
        let errorData: string | undefined;

        while (attempts < maxAttempts) {
            console.log(`Attempting to publish Instagram post (attempt ${attempts + 1}/${maxAttempts})...`);
            
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
            console.error(`Instagram publish error (attempt ${attempts + 1}):`, errorData);

            // Check if it's a "media not ready" error (code 9007 or 100)
            try {
                const errorObj = JSON.parse(errorData);
                if (errorObj.error && (errorObj.error.code === 9007 || errorObj.error.code === 100)) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        const waitTime = Math.min(5000 * attempts, 30000); // Progressive delay: 5s, 10s, 15s, 20s, 25s, max 30s
                        console.log(`Media not ready, waiting ${waitTime/1000} seconds before retry...`);
                        await delay(waitTime);
                    }
                } else {
                    // Different error, don't retry
                    break;
                }
            } catch (parseError) {
                // If we can't parse the error, don't retry
                break;
            }
        }

        if (!publishResponse || !publishResponse.ok) {
            return {
                success: false,
                error: `Failed to publish Instagram post after ${maxAttempts} attempts: ${publishResponse?.status || 'Unknown'} ${publishResponse?.statusText || 'Unknown error'}`
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
