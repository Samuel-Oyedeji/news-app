import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getCldImageUrl } from 'next-cloudinary';
import { NewsApiResponse } from '../../types';

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail'],
  },
});

// Function to add line breaks at word boundaries for better text wrapping
function addLineBreaks(text: string, charsPerLine: number = 50): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length <= charsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  // Join lines with %0A (URL-encoded line break)
  return lines.join('%0A');
}

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
    const baseFontSize = 10;
    const textWidth = 1000; // 1080 - 80px margins
    // Use full headline for image text with automatic line breaks for better wrapping
    const imageHeadline = addLineBreaks(headline, 35); // Add line break every ~50 characters

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
            y: 5,
            x: 13,
          },
          text: {
            color: "white",
            fontFamily: "Source Sans Pro",
            fontSize: baseFontSize,
            fontWeight: "bold" as const,
            text: imageHeadline,
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

    // Create caption with full description truncated to 200 words + link
    const words = description.split(' ');
    const truncatedDescription = words.slice(0, 200).join(' ');
    const captionWithLink = link ? `${truncatedDescription}...\n\nRead more: ${link}\n\n#Celebs #Movies #Hollywood` : `${truncatedDescription}...\n\n#Celebs #Movies #Hollywood`;
    const presetCaption = captionWithLink.substring(0, 280);

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