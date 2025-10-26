import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Initialize Supabase client with service role key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ReelPostRequest {
  caption: string;
  share_to_feed?: boolean;
}

interface ReelPostResponse {
  success: boolean;
  message?: string;
  reel_id?: string;
  video_url?: string;
  error?: string;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRandomVideoFromReels(): Promise<string | null> {
  try {
    console.log('Fetching videos from reels folder...');
    
    // List all files in the reels folder
    const { data: files, error } = await supabase.storage
      .from('news-images')
      .list('reels', {
        limit: 100,
        offset: 0,
      });

    if (error) {
      console.error('Error listing files from reels folder:', error);
      return null;
    }

    if (!files || files.length === 0) {
      console.log('No videos found in reels folder');
      return null;
    }

    // Filter for video files (common video extensions)
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const videoFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      return videoExtensions.some(ext => fileName.endsWith(ext));
    });

    if (videoFiles.length === 0) {
      console.log('No video files found in reels folder');
      return null;
    }

    // Randomly select a video
    const randomIndex = Math.floor(Math.random() * videoFiles.length);
    const selectedVideo = videoFiles[randomIndex];
    
    console.log(`Selected video: ${selectedVideo.name} (${randomIndex + 1}/${videoFiles.length})`);

    // Get the public URL for the selected video
    const { data: urlData } = supabase.storage
      .from('news-images')
      .getPublicUrl(`reels/${selectedVideo.name}`);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error getting random video from reels:', error);
    return null;
  }
}

async function postReelToInstagram(videoUrl: string, caption: string, shareToFeed: boolean = false): Promise<ReelPostResponse> {
  try {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramUserId = process.env.INSTAGRAM_USER_ID;

    if (!accessToken || !instagramUserId) {
      return {
        success: false,
        error: 'Instagram credentials not configured. Please set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID environment variables.'
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
        video_url: videoUrl,
        caption: caption,
        share_to_feed: shareToFeed,
      }),
    });

    if (!createMediaResponse.ok) {
      const errorData = await createMediaResponse.text();
      console.error('Instagram Reels API error:', errorData);
      return {
        success: false,
        error: `Failed to create Instagram reel: ${createMediaResponse.status} ${createMediaResponse.statusText}`
      };
    }

    const mediaData = await createMediaResponse.json();
    const mediaId = mediaData.id;

    if (!mediaId) {
      return {
        success: false,
        error: 'No media ID returned from Instagram Reels API'
      };
    }

    // Step 2: Publish the reel with retry mechanism
    const publishUrl = `https://graph.instagram.com/me/media_publish`;
    
    let attempts = 0;
    const maxAttempts = 5;
    let publishResponse: Response | undefined;
    let errorData: string | undefined;

    while (attempts < maxAttempts) {
      console.log(`Attempting to publish reel (attempt ${attempts + 1}/${maxAttempts})...`);
      
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
      console.error(`Instagram Reels publish error (attempt ${attempts + 1}):`, errorData);

      // Check if it's a "media not ready" error (code 9007 or 100)
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
    }

    if (!publishResponse || !publishResponse.ok) {
      return {
        success: false,
        error: `Failed to publish Instagram reel after ${maxAttempts} attempts: ${publishResponse?.status || 'Unknown'} ${publishResponse?.statusText || 'Unknown error'}`
      };
    }

    const publishData = await publishResponse.json();
    const reelId = publishData.id;

    console.log('Successfully posted reel to Instagram:', {
      mediaId,
      reelId,
      caption: caption.substring(0, 100) + '...',
      videoUrl: videoUrl,
      shareToFeed: shareToFeed
    });

    return {
      success: true,
      message: 'Successfully posted reel to Instagram',
      reel_id: reelId,
      video_url: videoUrl
    };
  } catch (error) {
    console.error('Instagram Reels posting error:', error);
    return {
      success: false,
      error: `Internal server error: ${(error as Error).message}`
    };
  }
}

export async function POST(request: Request) {
  try {
    const body: ReelPostRequest = await request.json();

    // Set default values
    const caption = body.caption || '#fyp #funny #viral #trending #reels #comedy #entertainment #foryou #foryoupage #funnyvideos #viralvideo #trendingnow #reelsinstagram #comedyreels #funnyreels #viralreels #fypシ #funnyvideos #comedyvideos #entertainment #laugh #humor #meme #funny #viral #trending';
    const shareToFeed = body.share_to_feed !== undefined ? body.share_to_feed : true;

    // Step 1: Get a random video from the reels folder
    const videoUrl = await getRandomVideoFromReels();
    
    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'No videos found in the reels folder. Please upload some videos to the reels folder in your Supabase news-images bucket.'
      }, { status: 404 });
    }

    // Step 2: Post the reel to Instagram
    const result = await postReelToInstagram(videoUrl, caption, shareToFeed);

    return NextResponse.json(result, { 
      status: result.success ? 200 : 500 
    });
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to process request: ${(error as Error).message}`
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // List available videos in the reels folder
    const { data: files, error } = await supabase.storage
      .from('news-images')
      .list('reels', {
        limit: 100,
        offset: 0,
      });

    if (error) {
      return NextResponse.json({
        success: false,
        error: `Failed to list files: ${error.message}`
      }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No files found in reels folder',
        videos: [],
        defaults: {
          caption: '#fyp #funny #viral #trending #reels #comedy #entertainment #foryou #foryoupage #funnyvideos #viralvideo #trendingnow #reelsinstagram #comedyreels #funnyreels #viralreels #fypシ #funnyvideos #comedyvideos #entertainment #laugh #humor #meme #funny #viral #trending',
          share_to_feed: true
        }
      });
    }

    // Filter for video files and get their URLs
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
    const videoFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      return videoExtensions.some(ext => fileName.endsWith(ext));
    });

    const videos = videoFiles.map(file => {
      const { data: urlData } = supabase.storage
        .from('news-images')
        .getPublicUrl(`reels/${file.name}`);
      
      return {
        name: file.name,
        url: urlData.publicUrl,
        size: file.metadata?.size,
        lastModified: file.updated_at
      };
    });

    return NextResponse.json({
      success: true,
      message: `Found ${videos.length} videos in reels folder`,
      videos,
      defaults: {
        caption: '#fyp #funny #viral #trending #reels #comedy #entertainment #foryou #foryoupage #funnyvideos #viralvideo #trendingnow #reelsinstagram #comedyreels #funnyreels #viralreels #fypシ #funnyvideos #comedyvideos #entertainment #laugh #humor #meme #funny #viral #trending',
        share_to_feed: true
      }
    });
  } catch (error) {
    console.error('Error listing reels:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to list reels: ${(error as Error).message}`
    }, { status: 500 });
  }
}
