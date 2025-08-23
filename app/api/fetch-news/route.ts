import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getCldImageUrl } from 'next-cloudinary';
import { NewsApiResponse } from '../../types';

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail'],
  },
});

// Function to truncate headline intelligently at word boundaries
function truncateHeadline(headline: string, maxLength: number = 200): string {
  if (headline.length <= maxLength) return headline;
  
  // Try to find a word boundary near the max length
  const truncated = headline.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) { // If we can find a space in the last 20%
    return truncated.substring(0, lastSpaceIndex) + "...";
  }
  
  return truncated + "...";
}

// Function to generate Instagram image with wrapped + scaled text
function generateInstagramImage(
  imageUrl: string,
  headline: string
): { instagram: string } {
  const platforms = {
    instagram: { width: 1080, height: 1080, crop: "fill" as const }, // Square
  };

  const results: { instagram: string } = {
    instagram: "",
  };

  for (const [platform, platformConfig] of Object.entries(platforms)) {
    // Hard-coded values for square format
    const baseFontSize = 24;
    const textWidth = 1000; // 1080 - 80px margins
    const truncatedHeadline = truncateHeadline(headline, 200);

    const options = {
      src: imageUrl,
      deliveryType: "fetch" as const,
      width: platformConfig.width,
      height: platformConfig.height,
      crop: platformConfig.crop,
      gravity: "center" as const,
      format: "auto" as const,
      quality: "auto" as const,
      overlays: [
        // White main text (auto-wrapping)
        {
          position: {
            gravity: "south" as const,
            y: 78,
            x: 0,
          },
          text: {
            color: "white",
            fontFamily: "Source Sans Pro",
            fontSize: baseFontSize,
            fontWeight: "bold" as const,
            text: truncatedHeadline,
            textAlign: "center" as const,
            width: textWidth, // Dynamic width based on platform
            crop: "fit",
          },
        },
      ],
    };

    const cloudinaryConfig = {
      cloud: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      },
    };

    results[platform as keyof typeof results] = getCldImageUrl(
      options,
      cloudinaryConfig
    );
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

    let platformImages: { instagram: string } | null = null;
    if (imageUrl) {
          try {
            const cleanBbcUrl = imageUrl.split('?')[0].replace(/\/$/, '');
            const needsEscaping = /[?=&#]/.test(cleanBbcUrl);
            const finalBbcUrl = needsEscaping ? encodeURIComponent(cleanBbcUrl) : cleanBbcUrl;
            
            // Generate Instagram image
            platformImages = generateInstagramImage(finalBbcUrl, headline);
            
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
            // Fallback to placeholder image
            platformImages = {
              instagram: 'https://placehold.co/1080x1080?text=Edit+Failed'
            };
        }
    } else {
      // No image available, use placeholder
      platformImages = {
        instagram: 'https://placehold.co/1080x1080?text=No+Image'
      };
    }

    const postPayload = {
      instagram: { image_url: platformImages.instagram, caption: presetCaption },
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