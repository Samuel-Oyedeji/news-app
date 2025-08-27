import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getCldImageUrl } from 'next-cloudinary';
import { NewsApiResponse } from '../../types';
import sizeOf from "image-size";
import { Buffer } from "buffer";
import fetch from "node-fetch";

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail'],
  },
});

// Function to add line breaks at word boundaries for better text wrapping
function addLineBreaks(text: string, imageWidth: number, fontSize: number): string {
  // Estimate how many characters can fit per line based on image width and font size
  const charsPerLine = Math.floor(imageWidth / (fontSize * 0.6));

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

  return lines.join('%0A'); // URL-encoded line break
}


// Function to truncate headline intelligently at word boundaries
function truncateHeadline(headline: string, maxLength: number = 70): string {
  if (headline.length <= maxLength) return headline;
  
  // Try to find a word boundary near the max length
  const truncated = headline.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) { // If we can find a space in the last 20%
    return truncated.substring(0, lastSpaceIndex) + "...";
  }
  
  return truncated + "...";
}


function getRandomBackgroundColor() {
  const colors = [
    'rgb:0A0F1480',
    'rgb:140A0D80',
    'rgb:0D0C0A80'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Function to generate Instagram image with wrapped + scaled text
async function generateInstagramImage(
  imageUrl: string,
  headline: string
): Promise<{ instagram: string }> {
  const platforms = {
    instagram: { width: 1080, height: 1080, crop: "crop" as const }, // Square
  };

  const results: { instagram: string } = {
    instagram: "",
  };

  for (const [platform, platformConfig] of Object.entries(platforms)) {

    async function getImageWidth(url: string): Promise<number> {
      const res = await fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const { width } = sizeOf(buffer);
      if (!width) throw new Error("Could not determine image width");
      return width;
    }

    // Default values
    let baseFontSize = 80; 
    let baseimgwidth = 900;
    let realimgWidth = 1080;

    try {
      // Dynamically fetch image width
      const imgWidth = await getImageWidth(imageUrl);

      // Scale font size as ~5% of image width
      const dynamicSize = Math.round(imgWidth * 0.05); // 5% of width
      const txtbaseimgwidth = Math.round(imgWidth * 0.8);

      // Keep it within safe bounds
      realimgWidth = imgWidth;
      baseimgwidth = txtbaseimgwidth;
      baseFontSize = dynamicSize;
    } catch (err) {
      console.error("Font size fallback (could not fetch image size):", err);
    }

    // Use full headline for image text with automatic line breaks for better wrapping
    const truncatedHeadline = truncateHeadline(headline, 60);

    const imageHeadline = addLineBreaks(truncatedHeadline, realimgWidth, baseFontSize); // Increased for better readability
    // const imageHeadline = headline // Increased for better readability


    const options = {
      src: imageUrl,
      deliveryType: "fetch" as const,
      width: platformConfig.width,
      height: platformConfig.height,
      crop: platformConfig.crop,
      gravity: "auto:subject" as const,
      format: "auto" as const,
      quality: "auto" as const,
      fetchFormat: "auto" as const, // Auto-detect source format
      dpr: "2.0", // Key for improving clarity

      overlays: [
        // White main text (auto-wrapping)
        {
          position: { gravity: "south" as const, y: 40 },
          text: {
            color: "white",
            fontFamily: "arial",
            fontSize: baseFontSize,
            fontWeight: "bold" as const,
            stroke: "stroke_black",
            text: imageHeadline,
            width: baseimgwidth,
          },

          // These apply to the text layer itself and will appear in the URL
          effects: [
            // Semi-transparent black box behind the text (b_rgb:000000CC)
            // { background: "rgb:00000080" },
            { background: getRandomBackgroundColor() },
            { border: `${Math.round(baseFontSize * 0.35)}px_solid_rgb:00000000` },
            { padding: Math.round(baseFontSize * 0.6) }, // makes box bigger around text
            // Optional: rounded corners on that box (r_ value)
            { radius: Math.round(baseFontSize * 0.4) },
          ],
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
    const feed = await parser.parseURL('https://variety.com/v/film/feed/');
    const latestItem = feed.items[0];
    if (!latestItem) throw new Error('No items found');

    const headline = latestItem.title ?? '';
    const description = latestItem.contentSnippet || (latestItem as any).description || '';
    const imageUrl = latestItem['media:thumbnail']?.$?.url ?? null;
    const link = latestItem.guid ?? null;

    // const keywords = ['actor', 'movie', 'musician', 'celebrity', 'LA', 'arrested', 'masterpieces', 'charged', 'filming', 'star', 'stars', 'director', 'plays', 'marvel', 'mcu', 'DCU', 'DC', 'spiderman', 'Hollywood'];
    // const isRelevant = keywords.some(keyword =>
    //   headline.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword)
    // );
    // if (!isRelevant) {
    //   return NextResponse.json<NewsApiResponse>({
    //     success: false,
    //     message: 'No relevant entertainment news found',
    //   });
    // }

    // Create caption with full description truncated to fit Instagram's limit
    const words = description.split(' ');
    
    // Popular hashtags for entertainment news
    const hashtags = '#Entertainment #News #Celebs #Movies #Hollywood #Film #TV #Celebrity #Showbiz #Trending';
    
    // Calculate space needed for link and hashtags
    const linkSection = link ? `\n\nRead more: ${link}` : '';
    const hashtagSection = `\n\n${hashtags}`;
    const reservedSpace = linkSection.length + hashtagSection.length + 10; // +10 for safety
    
    // Truncate description to leave space for link and hashtags
    const maxDescriptionLength = 2200 - reservedSpace; // Instagram caption limit is 2200 characters
    const truncatedDescription = words.slice(0, Math.floor(maxDescriptionLength / 6)).join(' '); // ~6 chars per word average
    
    const captionWithLink = link 
      ? `${truncatedDescription}...${linkSection}${hashtagSection}` 
      : `${truncatedDescription}...${hashtagSection}`;
    
    const presetCaption = captionWithLink;

    let platformImages: { instagram: string } | null = null;
    if (imageUrl) {
          try {
            const cleanBbcUrl = imageUrl.split('?')[0].replace(/\/$/, '');
            const needsEscaping = /[?=&#]/.test(cleanBbcUrl);
            const finalBbcUrl = needsEscaping ? encodeURIComponent(cleanBbcUrl) : cleanBbcUrl;
            
            // Generate Instagram image
            platformImages = await generateInstagramImage(finalBbcUrl, headline);
            
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