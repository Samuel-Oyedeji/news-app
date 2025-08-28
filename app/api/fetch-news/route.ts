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

const HEADLINES_FILE_PATH = path.join(__dirname, '..', '..', '..', 'used_headlines.json');

// Function to read used headlines from file
async function readUsedHeadlines(): Promise<string[]> {
  try {
    const data = await fs.readFile(HEADLINES_FILE_PATH, 'utf-8');
    return JSON.parse(data) as string[];
  } catch (error) {
    // If file doesn't exist or is invalid, return empty array
    return [];
  }
}

// Function to append headlines to file
async function appendUsedHeadlines(headlines: string[]): Promise<void> {
  const existingHeadlines = await readUsedHeadlines();
  const updatedHeadlines = [...new Set([...existingHeadlines, ...headlines])]; // Remove duplicates
  await fs.writeFile(HEADLINES_FILE_PATH, JSON.stringify(updatedHeadlines, null, 2));
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

// Function to generate Instagram image with wrapped + scaled text
async function generateInstagramImage(
  imageUrl: string,
  headline: string
): Promise<{ instagram: string }> {
  const platforms = {
    instagram: { width: 1080, height: 1080, crop: "crop" as const },
  };

  const results: { instagram: string } = { instagram: "" };

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
    } catch (err) {
      console.error("Font size fallback (could not fetch image size):", err);
    }

    const truncatedHeadline = truncateHeadline(headline, 60);
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

// Function to call Google Gemini API using SDK
async function callGemini(posts: { headline: string; description: string; imageUrl: string | null; link: string | null }[]): Promise<
  { originalHeadline: string; newHeadline: string; description: string; imageUrl: string | null; link: string | null }[]
> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  console.log('API Key:', apiKey ? 'Set' : 'Undefined'); // Debug log
  if (!apiKey) throw new Error('Google Gemini API key not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
    Here is a JSON array of the latest entertainment news items from Variety: ${JSON.stringify(posts)}.

    Select exactly 4 of the most engaging and relevant posts (prioritizing topics like movies, TV, celebrities, music, awards, Hollywood events, and avoiding low-interest items). For each selected post, return the original headline, a new attention-grabbing headline (optimized for social media, concise, and engaging), description, imageUrl, and link. Return only a JSON array of the 4 selected objects, each with the keys: originalHeadline, newHeadline, description, imageUrl, link. Do not include any other text.
  `;

  try {
    const result = await model.generateContent(prompt);
    let content = result.response.text();
    console.log('Raw Gemini response:', content); // Debug log
    // Remove markdown code fences and trim whitespace
    content = content.replace(/```json\n|\n```/g, '').trim();
    const parsedContent = JSON.parse(content);
    if (!Array.isArray(parsedContent) || parsedContent.length !== 4) {
      throw new Error(`Gemini did not return exactly 4 posts, got ${parsedContent.length}`);
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

    // Call Gemini to select 4 posts
    let selectedPosts: { originalHeadline: string; newHeadline: string; description: string; imageUrl: string | null; link: string | null }[];
    try {
      selectedPosts = await callGemini(uniquePosts);
      if (selectedPosts.length !== 4) {
        throw new Error(`Gemini did not return exactly 4 posts, got ${selectedPosts.length}`);
      }
    } catch (error) {
      console.error('Gemini error:', error);
      return NextResponse.json<NewsApiResponse>(
        { success: false, error: `Failed to select posts via LLM: ${(error as Error).message}` },
        { status: 500 }
      );
    }

    // Process the 4 selected posts
    const postPayloads = await Promise.all(
      selectedPosts.map(async (post) => {
        const { newHeadline, description, imageUrl, link } = post;

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
        if (imageUrl) {
          try {
            const cleanUrl = imageUrl.split('?')[0].replace(/\/$/, '');
            const needsEscaping = /[?=&#]/.test(cleanUrl);
            const finalUrl = needsEscaping ? encodeURIComponent(cleanUrl) : cleanUrl;
            platformImages = await generateInstagramImage(finalUrl, newHeadline);
            postPayload = { instagram: { image_url: platformImages.instagram, caption: presetCaption } };
            const testResponse = await fetch(platformImages.instagram, { method: 'HEAD' });
            if (!testResponse.ok) {
              throw new Error(`Image URL failed: ${testResponse.statusText}`);
            }
          } catch (error) {
            console.error('Image generation error:', error);
            platformImages = { instagram: 'https://placehold.co/1080x1080?text=Edit+Failed' };
            postPayload = { instagram: { image_url: platformImages.instagram, caption: presetCaption } };
          }
        }

        return {
          headline: newHeadline,
          description: description.substring(0, 100),
          originalImage: imageUrl,
          caption: presetCaption,
          editedImage: platformImages.instagram,
          platformImages,
          link,
          originalHeadline: post.originalHeadline,
          postPayload,
        };
      })
    );

    // Append original headlines to file
    await appendUsedHeadlines(selectedPosts.map((post) => post.originalHeadline));

    return NextResponse.json<NewsApiResponse>({
      success: true,
      posts: postPayloads,
    });
  } catch (error) {
    return NextResponse.json<NewsApiResponse>(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}