import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getCldImageUrl } from 'next-cloudinary';
import { NewsApiResponse } from '../../types';

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail'],
  },
});

// Function to truncate headline if it's too long while preserving readability
function truncateHeadline(headline: string, maxLength: number = 100): string {
  if (headline.length <= maxLength) return headline;
  
  // Try to find a good breaking point (space, comma, period)
  const truncated = headline.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastComma = truncated.lastIndexOf(',');
  const lastPeriod = truncated.lastIndexOf('.');
  
  // Also look for question marks and exclamation marks for better breaks
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclamation = truncated.lastIndexOf('!');
  
  const breakPoint = Math.max(lastSpace, lastComma, lastPeriod, lastQuestion, lastExclamation);
  
  if (breakPoint > maxLength * 0.6) { // If we found a good break point
    return headline.substring(0, breakPoint + 1);
  }
  
  // If no good break point, try to break at a word boundary
  if (lastSpace > maxLength * 0.5) {
    return headline.substring(0, lastSpace + 1);
  }
  
  return truncated + '...';
}

// Function to generate platform-specific images with optimal aspect ratios
function generatePlatformSpecificImages(imageUrl: string, headline: string): { instagram: string; twitter: string; tiktok: string } {
  const platforms = {
    instagram: { width: 1080, height: 1080, crop: 'fill' as const }, // Square
    twitter: { width: 1200, height: 675, crop: 'fill' as const },    // 16:9
    tiktok: { width: 1080, height: 1920, crop: 'fill' as const }     // 9:16
  };
  
  const results: { instagram: string; twitter: string; tiktok: string } = {
    instagram: '',
    twitter: '',
    tiktok: ''
  };
  
  for (const [platform, platformConfig] of Object.entries(platforms)) {
    const options = {
      src: imageUrl,
      deliveryType: 'fetch' as const,
      width: platformConfig.width,
      height: platformConfig.height,
      crop: platformConfig.crop,
      gravity: 'center' as const,
      format: 'auto' as const,
      quality: 'auto' as const,
      overlays: [
        // Background overlay for text (like the black background in your template)
        {
          position: {
            gravity: 'south' as const,
            y: 0,
            x: 0,
          },
          overlay: {
            publicId: 'solid_black',
            width: platformConfig.width,
            height: Math.min(200, platformConfig.height * 0.3), // About 30% of image height
            crop: 'fill',
            color: 'black',
          },
        },
        // Separator line above text (like the thin white line in your template)
        {
          position: {
            gravity: 'south' as const,
            y: Math.min(200, platformConfig.height * 0.3) + 5, // Just above the background
            x: 0,
          },
          overlay: {
            publicId: 'separator_line',
            width: platformConfig.width - 100, // Slightly shorter than background
            height: 2, // Thin line
            crop: 'fill',
            color: 'white',
          },
        },
        // Magenta text (shadow effect)
        {
          position: {
            gravity: 'south' as const,
            y: 80, // Positioned above the background overlay
            x: 0, // Center horizontally
          },
          text: {
            color: 'magenta',
            fontFamily: 'Source Sans Pro',
            fontSize: Math.min(20, platformConfig.width / 60), // Slightly larger for better readability
            fontWeight: 'bold' as const,
            text: truncateHeadline(headline, 100), // Allow longer text since we have background
            textAlign: 'center' as const,
            stroke: 'black',
            strokeWidth: 2,
            lineSpacing: 5, // Better line spacing for wrapped text
            width: platformConfig.width - 80, // Smaller margins since we have background
            letterSpacing: 1, // Slight letter spacing for better readability
            textTransform: 'uppercase' as const, // Make text uppercase like your template
          },
        },
        // White text (main text)
        {
          position: {
            gravity: 'south' as const,
            y: 78, // Slightly offset for shadow effect
            x: 0, // Center horizontally
          },
          text: {
            color: 'white',
            fontFamily: 'Source Sans Pro',
            fontSize: Math.min(22, platformConfig.width / 55), // Slightly larger for better readability
            fontWeight: 'bold' as const,
            text: truncateHeadline(headline, 100), // Allow longer text since we have background
            textAlign: 'center' as const,
            stroke: 'black',
            strokeWidth: 1,
            lineSpacing: 5, // Better line spacing for wrapped text
            width: platformConfig.width - 80, // Smaller margins since we have background
            letterSpacing: 1, // Slight letter spacing for better readability
            textTransform: 'uppercase' as const, // Make text uppercase like your template
          },
        },
      ],
    };
    
    const cloudinaryConfig = {
      cloud: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      },
    };
    
    results[platform as keyof typeof results] = getCldImageUrl(options, cloudinaryConfig);
  }
  
  return results;
}

export async function GET() {
  try {
    const feed = await parser.parseURL('https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml');
    const latestItem = feed.items[0];
    if (!latestItem) throw new Error('No items found');

    const headline = latestItem.title ?? '';
    const description = latestItem.contentSnippet || (latestItem as any).description || '';
    const imageUrl = latestItem['media:thumbnail']?.$?.url ?? null;
    const link = latestItem.guid ?? null;

    const keywords = ['actor', 'movie', 'musician', 'celebrity', 'LA', 'arrested', 'charged', 'filming', 'star', 'stars', 'director', 'plays', 'marvel', 'mcu', 'DCU', 'DC', 'spiderman', 'Hollywood'];
    const isRelevant = keywords.some(keyword =>
      headline.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword)
    );
    if (!isRelevant) {
      return NextResponse.json<NewsApiResponse>({
        success: false,
        message: 'No relevant entertainment news found',
      });
    }

    const presetCaption = `🌟 Hollywood Buzz: ${headline}\n${description.substring(0, 100)}...\n#Celebs #Movies via BBC`.substring(0, 280);

    let platformImages: { instagram: string; twitter: string; tiktok: string } | null = null;
    if (imageUrl) {
          try {
            const cleanBbcUrl = imageUrl.split('?')[0].replace(/\/$/, '');
            const needsEscaping = /[?=&#]/.test(cleanBbcUrl);
            const finalBbcUrl = needsEscaping ? encodeURIComponent(cleanBbcUrl) : cleanBbcUrl;
            
            // Generate platform-specific images
            platformImages = generatePlatformSpecificImages(finalBbcUrl, headline);
            
            console.log('BBC Input Image URL:', cleanBbcUrl);
            console.log('BBC Final Image URL (escaped or normal):', finalBbcUrl);
            console.log('BBC Generated Platform Images:', platformImages);
            
            // Test one of the generated URLs to ensure they work
            const testResponse = await fetch(platformImages.instagram, { method: 'HEAD' });
            if (!testResponse.ok) {
              const errorText = await testResponse.text();
              throw new Error(`BBC URL failed: ${testResponse.status} ${testResponse.statusText} - ${errorText}`);
            }
          } catch (bbcError) {
            console.error('BBC fetch error:', bbcError);
            // Fallback to placeholder images for each platform
            platformImages = {
              instagram: 'https://placehold.co/1080x1080?text=Edit+Failed',
              twitter: 'https://placehold.co/1200x675?text=Edit+Failed',
              tiktok: 'https://placehold.co/1080x1920?text=Edit+Failed'
            };
        }
    } else {
      // No image available, use placeholders
      platformImages = {
        instagram: 'https://placehold.co/1080x1080?text=No+Image',
        twitter: 'https://placehold.co/1200x675?text=No+Image',
        tiktok: 'https://placehold.co/1080x1920?text=No+Image'
      };
    }

    const postPayload = {
      instagram: { image_url: platformImages.instagram, caption: presetCaption },
      twitter: { text: presetCaption, media: { media_urls: [platformImages.twitter] } },
      tiktok: { description: presetCaption, video: platformImages.tiktok },
    };
    console.log('Simulated post:', JSON.stringify(postPayload, null, 2));

    return NextResponse.json<NewsApiResponse>({
      success: true,
      headline,
      description: description.substring(0, 100),
      originalImage: imageUrl,
      caption: presetCaption,
      editedImage: platformImages.instagram, // Keep for backward compatibility
      platformImages, // Add new field for all platform images
      link,
      postPayload,
    });
  } catch (error) {
    return NextResponse.json<NewsApiResponse>(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}