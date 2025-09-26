import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getCldImageUrl } from 'next-cloudinary';
import { NewsApiResponse } from '../../types';
import sizeOf from "image-size";
import { Buffer } from "buffer";
import fetch from "node-fetch";
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Set file path to app/data/
const HEADLINES_FILE_PATH = path.resolve(process.cwd(), 'app', 'data', 'used_headlines.json');

// Function to ensure file and directory exist
async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const dirPath = path.dirname(filePath);
      console.log('Creating directory if not exists:', dirPath);
      await fs.mkdir(dirPath, { recursive: true });
      console.log('Creating used_headlines.json at:', filePath);
      await fs.writeFile(filePath, JSON.stringify([], null, 2));
    } else {
      throw error;
    }
  }
}

// Function to read used headlines from file
async function readUsedHeadlines(): Promise<string[]> {
  try {
    console.log('Reading from:', HEADLINES_FILE_PATH); // Debug log
    await ensureFileExists(HEADLINES_FILE_PATH);
    const data = await fs.readFile(HEADLINES_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid used_headlines.json format, initializing empty array');
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('Error reading used_headlines.json:', error);
    throw new Error(`Failed to read headlines: ${(error as Error).message}`);
  }
}

// Function to append headlines to file
async function appendUsedHeadlines(headlines: string[]): Promise<void> {
  try {
    console.log('Appending headlines:', headlines); // Debug log
    if (!headlines || headlines.length === 0) {
      console.warn('No headlines to append');
      return;
    }
    const existingHeadlines = await readUsedHeadlines();
    const updatedHeadlines = [...new Set([...existingHeadlines, ...headlines])]; // Remove duplicates
    await fs.writeFile(HEADLINES_FILE_PATH, JSON.stringify(updatedHeadlines, null, 2));
    console.log('Successfully wrote to used_headlines.json:', updatedHeadlines);
  } catch (error) {
    console.error('Error appending to used_headlines.json:', error);
    throw new Error(`Failed to append headlines: ${(error as Error).message}`);
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
  return lines.join('%0A');
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
  return headline.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

function getRandomBackgroundColor() {
  const colors = [
    'rgb:0A0F1480',
    'rgb:140A0D80',
    'rgb:0D0C0A80',
    'rgb:1A0D1180',
    'rgb:01140080'
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

// Function to generate Instagram image with wrapped + scaled text
async function generateInstagramImage(
  imageUrl: string,
  headline: string
): Promise<{ instagram: string }> {
  const platforms = {
    instagram: { width: 1080, height: 1080, crop: "crop" as const },
  };

  const results: { instagram: string } = { instagram: "" };

  // Sanitize headline to remove emojis
  const sanitizedHeadline = sanitizeHeadline(headline);
  console.log('Sanitized headline:', sanitizedHeadline); // Debug log

  for (const [platform, platformConfig] of Object.entries(platforms)) {
    async function getImageWidth(url: string): Promise<number> {
      const res = await fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const { width } = sizeOf(buffer);
      if (!width) throw new Error("Could not determine image width");
      return width;
    }

    let baseFontSize = 80;
    let baseimgwidth = 900;
    let realimgWidth = 1080;

    try {
      const imgWidth = await getImageWidth(imageUrl);
      const dynamicSize = Math.round(imgWidth * 0.05);
      const txtbaseimgwidth = Math.round(imgWidth * 0.8);
      realimgWidth = imgWidth;
      baseimgwidth = txtbaseimgwidth;
      baseFontSize = dynamicSize;
      console.log('Calculated font size:', baseFontSize); // Debug log
    } catch (err) {
      console.error("Font size fallback (could not fetch image size):", err);
    }

    const truncatedHeadline = truncateHeadline(sanitizedHeadline, 60);
    const imageHeadline = addLineBreaks(truncatedHeadline, realimgWidth, baseFontSize);

    const options = {
      src: imageUrl,
      deliveryType: "fetch" as const,
      width: platformConfig.width,
      height: platformConfig.height,
      crop: platformConfig.crop,
      gravity: "auto:subject" as const,
      format: "auto" as const,
      quality: "auto" as const,
      fetchFormat: "auto" as const,
      dpr: "2.0",
      overlays: [
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
          effects: [
            { background: getRandomBackgroundColor() },
            { border: `${Math.round(baseFontSize * 0.35)}px_solid_rgb:00000000` },
            { padding: Math.round(baseFontSize * 0.6) },
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

    results[platform as keyof typeof results] = getCldImageUrl(options, cloudinaryConfig);
  }

  return results;
}

async function callGemini(posts: { headline: string; description: string; imageUrl: string | null; link: string | null }[]): Promise<
  { originalHeadline: string; newHeadline: string; description: string; imageUrl: string | null; link: string | null }[]
> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  console.log('API Key:', apiKey ? 'Set' : 'Undefined'); // Debug log
  if (!apiKey) throw new Error('Google Gemini API key not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
    Here is a JSON array of the latest entertainment news items from Variety: ${JSON.stringify(posts)}.

    Select up to 6 of the most engaging and relevant posts (prioritizing topics like movies, TV, celebrities, music, awards, Hollywood events, and avoiding low-interest items). For each selected post, return the original headline, a new attention-grabbing headline (optimized for social media, concise, and engaging), description, imageUrl, and link. Return only a JSON array of the selected objects, each with the keys: originalHeadline, newHeadline, description, imageUrl, link. Do not include any other text.
  `;

  try {
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log('Raw Gemini response:', content); // Debug log
    // Remove markdown code fences and trim whitespace
    content = content.replace(/```json\n|\n```/g, '').trim();
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
    // Fetch posts from all endpoints
    const postsPromises = VARIETY_RSS_ENDPOINTS.map(async (url) => {
      try {
        const feed = await parser.parseURL(url);
        const latestItem = feed.items[0];
        if (!latestItem) return null;
        return {
          headline: latestItem.title ?? '',
          description: latestItem.contentSnippet || (latestItem as any).description || '',
          imageUrl: latestItem['media:thumbnail']?.$?.url ?? null,
          link: latestItem.guid ?? null,
        };
      } catch (error) {
        console.error(`Error fetching from ${url}:`, error);
        return null;
      }
    });

    const posts = (await Promise.all(postsPromises)).filter((post): post is NonNullable<typeof post> => post !== null);

    // Filter out duplicates
    const usedHeadlines = await readUsedHeadlines();
    const uniquePosts = posts.filter((post) => !usedHeadlines.includes(post.headline));

    if (uniquePosts.length === 0) {
      return NextResponse.json<NewsApiResponse>(
        { success: false, message: 'No new entertainment news found after duplicate filtering' },
        { status: 404 }
      );
    }

    // Call Gemini to select up to 6 posts
    let selectedPosts: { originalHeadline: string; newHeadline: string; description: string; imageUrl: string | null; link: string | null }[];
    try {
      selectedPosts = await callGemini(uniquePosts);
      if (selectedPosts.length === 0) {
        throw new Error('Gemini returned no posts');
      }
    } catch (error) {
      console.error('Gemini error:', error);
      return NextResponse.json<NewsApiResponse>(
        { success: false, error: `Failed to select posts via LLM: ${(error as Error).message}` },
        { status: 500 }
      );
    }

    // Process posts and filter for valid Cloudinary URLs
    const validPostPayloads = [];
    const processedHeadlines = new Set<string>();

    for (const post of selectedPosts) {
      if (validPostPayloads.length >= 3) break; // Stop once we have 3 valid posts

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
          const needsEscaping = /[?=&#]/.test(cleanUrl);
          const finalUrl = needsEscaping ? encodeURIComponent(cleanUrl) : cleanUrl;
          console.log('Generating image for URL:', imageUrl); // Debug log
          console.log('Cleaned URL:', cleanUrl); // Debug log
          console.log('Final URL:', finalUrl); // Debug log
          platformImages = await generateInstagramImage(finalUrl, newHeadline);
          console.log('Generated Cloudinary URL:', platformImages.instagram); // Debug log
          const testResponse = await fetch(platformImages.instagram, { method: 'HEAD' });
          if (testResponse.ok) {
            postPayload = { instagram: { image_url: platformImages.instagram, caption: presetCaption } };
            isValidImage = true;
          } else {
            console.warn(`Skipping post due to invalid Cloudinary URL: ${testResponse.statusText} (URL: ${platformImages.instagram})`);
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

    // Check if we have exactly 3 valid posts
    if (validPostPayloads.length < 3) {
      return NextResponse.json<NewsApiResponse>(
        { success: false, message: `Could not find 3 posts with valid image URLs, found ${validPostPayloads.length}` },
        { status: 404 }
      );
    }

    // Take the first 3 valid posts
    const finalPostPayloads = validPostPayloads.slice(0, 3);

    // Append original headlines to file
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