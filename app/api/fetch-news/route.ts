import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { NewsApiResponse } from '../../types';
import { Buffer } from "buffer";
import fetch from "node-fetch";
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Redis } from '@upstash/redis';
import sharp from 'sharp';
import { put } from '@vercel/blob';

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail'],
  },
});

const VARIETY_RSS_ENDPOINTS = [
  'https://variety.com/v/film/feed/',
  'https://variety.com/v/tv/feed/',
  'https://variety.com/v/music/feed/',
  'https://variety.com/v/awards/feed/',
  'https://variety.com/v/global/feed/',
  'https://variety.com/v/theater/feed/',
  'https://variety.com/v/digital/feed/',
];


// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Redis key for storing used headlines
const USED_HEADLINES_KEY = 'used_headlines';

// Function to read used headlines from Redis
async function readUsedHeadlines(): Promise<string[]> {
  try {
    console.log('Reading used headlines from Upstash Redis');
    const headlines = await redis.get<string[]>(USED_HEADLINES_KEY);
    const result = Array.isArray(headlines) ? headlines : [];
    console.log('Retrieved headlines from Redis:', result.length, 'items');
    return result;
  } catch (error) {
    console.error('Error reading used headlines from Redis:', error);
    // Return empty array if Redis is not available (fallback)
    return [];
  }
}

// Function to append headlines to Redis
async function appendUsedHeadlines(headlines: string[]): Promise<void> {
  try {
    console.log('Appending headlines to Upstash Redis:', headlines);
    if (!headlines || headlines.length === 0) {
      console.warn('No headlines to append');
      return;
    }
    
    const existingHeadlines = await readUsedHeadlines();
    const updatedHeadlines = [...new Set([...existingHeadlines, ...headlines])]; // Remove duplicates
    
    // Store in Redis with 7 days expiration
    await redis.setex(USED_HEADLINES_KEY, 7 * 24 * 60 * 60, updatedHeadlines);
    console.log('Successfully updated headlines in Redis:', updatedHeadlines.length, 'total items');
  } catch (error) {
    console.error('Error appending to Redis:', error);
    // Don't throw error to prevent API failure, just log it
    console.warn('Continuing without storing headlines due to Redis error');
  }
}
  

// Function to add line breaks at word boundaries for better text wrapping
function addLineBreaks(text: string, imageWidth: number, fontSize: number): string {
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
  return lines.join('\n');
}

// Function to truncate headline intelligently at word boundaries
function truncateHeadline(headline: string, maxLength: number = 70): string {
  if (headline.length <= maxLength) return headline;
  const truncated = headline.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + "...";
  }
  return truncated + "...";
}

// Function to sanitize headline by removing emojis and special characters
function sanitizeHeadline(headline: string): string {
  // Remove emojis (Unicode characters outside basic ASCII)
  let sanitized = headline.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
  
  // Remove or replace problematic characters
  sanitized = sanitized
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[&]/g, 'and') // Replace & with 'and'
    .replace(/[^\w\s\-.,!?]/g, '') // Keep only alphanumeric, spaces, hyphens, periods, commas, exclamation, question
    .trim();
  
  return sanitized;
}

function getRandomBackgroundColor() {
  const colors = [
    'rgba(10, 15, 20, 0.8)',
    'rgba(20, 10, 13, 0.8)',
    'rgba(13, 12, 10, 0.8)',
    'rgba(26, 13, 17, 0.8)',
    'rgba(1, 20, 0, 0.8)'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Function to validate URL
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function generateInstagramImage(
  imageUrl: string,
  headline: string
): Promise<{ instagram: string }> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    const sanitizedHeadline = sanitizeHeadline(headline);
    const truncatedHeadline = truncateHeadline(sanitizedHeadline, 60);
    const imageHeadline = addLineBreaks(truncatedHeadline, 900, 60);

    const width = 1080;
    const height = 1080;

    // Create a simple text overlay using basic SVG without font dependencies
    const lines = imageHeadline.split('\n');
    const svgText = lines.map((line, index) => 
      `<tspan x="50%" dy="${index === 0 ? 0 : '1.2em'}" text-anchor="middle">${line}</tspan>`
    ).join('');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="80%" text-anchor="middle" 
              fill="white" 
              stroke="black" 
              stroke-width="1" 
              font-size="60" 
              font-family="monospace"
              font-weight="bold">
          ${svgText}
        </text>
      </svg>
    `;

    const imageWithText = await sharp(Buffer.from(imageBuffer))
      .resize(width, height, { fit: 'cover', position: 'center' })
      .composite([{
        input: Buffer.from(svg),
        gravity: 'south',
      }])
      .toBuffer();

    const blob = await put(`${sanitizedHeadline.replace(/\s/g, '-')}.jpg`, imageWithText, {
      access: 'public',
    });
    
    return { instagram: blob.url };
  } catch (error) {
    console.error('Error generating image with sharp:', error);
    return { instagram: 'https://placehold.co/1080x1080?text=No+Image' };
  }
}


async function callGemini(posts: { headline: string; description: string; imageUrl: string | null; link: string | null }[]): Promise<
  { originalHeadline: string; newHeadline: string; description: string; imageUrl: string | null; link: string | null }[]
> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  console.log('API Key:', apiKey ? 'Set' : 'Undefined'); // Debug log
  if (!apiKey) throw new Error('Google Gemini API key not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
    Here is a JSON array of entertainment news items from Variety: ${JSON.stringify(posts)}.

    Select 1-3 of the most engaging and relevant posts (prioritizing topics like movies, TV, celebrities, music, awards, Hollywood events, and avoiding low-interest items). Choose the best posts available - if there are 3 great posts, select 3; if only 1-2 are good, select those. For each selected post, return the original headline, a new attention-grabbing headline (optimized for social media, concise, and engaging), description, imageUrl, and link. Return only a JSON array of 1-3 objects, each with the keys: originalHeadline, newHeadline, description, imageUrl, link. Do not include any other text.
  `;

  try {
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log('Raw Gemini response:', content); // Debug log
    // Remove markdown code fences and trim whitespace
    content = content.replace(/\`\`\`json\n|\n\`\`\`/g, '').trim();
    const parsedContent = JSON.parse(content);
    if (!Array.isArray(parsedContent)) {
      throw new Error('Gemini did not return an array of posts');
    }
    return parsedContent;
  } catch (error) {
    console.error('Gemini SDK error:', error);
    throw new Error(`Failed to select posts via Gemini: ${(error as Error).message}`);
  }
}

export async function GET() {
  try {
    // Fetch posts from all endpoints - get multiple posts per feed for better randomization
    const postsPromises = VARIETY_RSS_ENDPOINTS.map(async (url) => {
      try {
        const feed = await parser.parseURL(url);
        // Fetch up to 8 items per feed for better variety
        const items = feed.items?.slice(0, 8) || [];
        if (items.length === 0) return [];
        
        return items.map(item => ({
          headline: item.title ?? '',
          description: item.contentSnippet || (item as { description?: string }).description || '',
          imageUrl: item['media:thumbnail']?.$?.url ?? null,
          link: item.guid ?? null,
        }));
      } catch (error) {
        console.error(`Error fetching from ${url}:`, error);
        return [];
      }
    });

    const postsArrays = await Promise.all(postsPromises);
    const posts = postsArrays.flat().filter((post): post is NonNullable<typeof post> => post !== null);

    // Filter out duplicates using Redis storage
    const usedHeadlines = await readUsedHeadlines();
    const uniquePosts = posts.filter((post) => !usedHeadlines.includes(post.headline));
    // const uniquePosts = posts;

    if (uniquePosts.length === 0) {
      return NextResponse.json<NewsApiResponse>(
        { success: false, message: 'No new entertainment news found after duplicate filtering' },
        { status: 404 }
      );
    }

    // Shuffle posts for better randomization before sending to Gemini
    const shuffledPosts = uniquePosts.sort(() => Math.random() - 0.5);
    
    // Pre-filter posts to reduce Gemini load - prioritize posts with images and good descriptions
    const qualityPosts = shuffledPosts
      .filter(post => post.imageUrl && post.description && post.description.length > 50)
      .slice(0, 20); // Limit to top 20 posts for Gemini processing
    
    console.log(`Found ${shuffledPosts.length} unique posts, filtered to ${qualityPosts.length} quality posts for Gemini`);

    // Call Gemini to select 1-3 posts
    let selectedPosts: { originalHeadline: string; newHeadline: string; description: string; imageUrl: string | null; link: string | null }[];
    try {
      selectedPosts = await callGemini(qualityPosts);
      if (selectedPosts.length === 0) {
        throw new Error('Gemini returned no posts');
      }
      console.log(`Gemini selected ${selectedPosts.length} posts for processing`);
    } catch (error) {
      console.error('Gemini error:', error);
      return NextResponse.json<NewsApiResponse>(
        { success: false, error: `Failed to select posts via LLM: ${(error as Error).message}` },
        { status: 500 }
      );
    }

    // Process posts and filter for valid posts
    const validPostPayloads = [];
    const processedHeadlines = new Set<string>();

    for (const post of selectedPosts) {
      // Process all selected posts (no limit)

      const { newHeadline, description, imageUrl, link, originalHeadline } = post;

      // Skip if headline was already processed
      if (processedHeadlines.has(originalHeadline)) continue;
      processedHeadlines.add(originalHeadline);

      // Create caption
      const words = description.split(' ');
      const hashtags = '#Entertainment #News #Celebs #Movies #Hollywood #Film #TV #Celebrity #Showbiz #Trending';
      const linkSection = link ? `\n\nRead more: ${link}` : '';
      const hashtagSection = `\n\n${hashtags}`;
      const reservedSpace = linkSection.length + hashtagSection.length + 10;
      const maxDescriptionLength = 2200 - reservedSpace;
      const truncatedDescription = words.slice(0, Math.floor(maxDescriptionLength / 6)).join(' ');
      const presetCaption = link
        ? `${truncatedDescription}...${linkSection}${hashtagSection}`
        : `${truncatedDescription}...${hashtagSection}`;

      // Generate Instagram image
      let platformImages: { instagram: string } = { instagram: 'https://placehold.co/1080x1080?text=No+Image' };
      let postPayload = { instagram: { image_url: platformImages.instagram, caption: presetCaption } };
      let isValidImage = false;

      if (imageUrl && isValidUrl(imageUrl)) {
        try {
          const cleanUrl = imageUrl.split('?')[0].replace(/\/$/, '');
          console.log('Generating image for URL:', imageUrl);
          console.log('Cleaned URL:', cleanUrl);
          
          platformImages = await generateInstagramImage(cleanUrl, newHeadline);
          
          if (platformImages.instagram && platformImages.instagram.startsWith('https')) {
            postPayload = { instagram: { image_url: platformImages.instagram, caption: presetCaption } };
            isValidImage = true;
            console.log('Successfully generated image and uploaded to Vercel Blob');
          } else {
            console.warn(`Skipping post due to invalid image generated by Vercel Blob`);
          }
        } catch (error) {
          console.error('Image generation error for URL:', imageUrl, error);
        }
      } else {
        console.warn('Invalid or missing image URL:', imageUrl);
      }

      if (isValidImage) {
        validPostPayloads.push({
          headline: newHeadline,
          description: description.substring(0, 100),
          originalImage: imageUrl,
          caption: presetCaption,
          editedImage: platformImages.instagram,
          platformImages,
          link,
          originalHeadline,
          postPayload,
        });
      }
    }

    // Check if we have at least 1 valid post
    if (validPostPayloads.length === 0) {
      return NextResponse.json<NewsApiResponse>(
        { success: false, message: 'Could not find any posts with valid image URLs' },
        { status: 404 }
      );
    }

    // Take all valid posts (1, 2, or 3)
    const finalPostPayloads = validPostPayloads;
    console.log(`Successfully processed ${finalPostPayloads.length} valid posts for posting`);

    
    // Append original headlines to Redis
    try {
      await appendUsedHeadlines(finalPostPayloads.map((post) => post.originalHeadline));
    } catch (error) {
      console.error('Failed to append headlines, continuing with response:', error);
      // Continue to return response even if headline append fails
    }
    

    return NextResponse.json<NewsApiResponse>({
      success: true,
      posts: finalPostPayloads,
    });
  } catch (error) {
    return NextResponse.json<NewsApiResponse>(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
