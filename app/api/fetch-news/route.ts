import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { getCldImageUrl } from 'next-cloudinary';
import { NewsApiResponse } from '../../types';

const parser = new Parser({
  customFields: {
    item: ['media:thumbnail'],
  },
});

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

    let editedImageUrl = null;
    if (imageUrl) {
      try {
        // Test with Unsplash URL
        const testImageUrl = 'https://images.unsplash.com/photo-1575936123452-b67c3203c357';
        const cleanImageUrl = imageUrl.split('?')[0].replace(/\/$/, '');
        // Check for special characters (e.g., ?, =, &)
        const needsEscaping = /[?=&#]/.test(cleanImageUrl);
        const finalImageUrl = needsEscaping ? encodeURIComponent(cleanImageUrl) : cleanImageUrl;
        const options = {
          src: finalImageUrl,
          deliveryType: 'fetch' as const,
          width: 1080,
          height: 1080,
          crop: 'fill' as const,
          gravity: 'center' as const,
          format: 'auto' as const,
          quality: 'auto' as const,
        };
        const config = {
          cloud: {
            cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
          },
        };
        editedImageUrl = getCldImageUrl(options, config);
        console.log('Input Image URL:', cleanImageUrl);
        console.log('Final Image URL (escaped or normal):', finalImageUrl);
        console.log('Generated Cloudinary URL:', editedImageUrl);
        const response = await fetch(editedImageUrl, { method: 'HEAD' });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Test URL failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
      } catch (error) {
        console.error('Test URL error:', error);
        // Fallback to BBC URL
        try {
          const cleanBbcUrl = imageUrl.split('?')[0].replace(/\/$/, '');
          const needsEscaping = /[?=&#]/.test(cleanBbcUrl);
          const finalBbcUrl = needsEscaping ? encodeURIComponent(cleanBbcUrl) : cleanBbcUrl;
          const options = {
            src: finalBbcUrl,
            deliveryType: 'fetch' as const,
            width: 1080,
            height: 1080,
            crop: 'fill' as const,
            gravity: 'center' as const,
            format: 'auto' as const,
            quality: 'auto' as const,
          };
          const config = {
            cloud: {
              cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            },
          };
          editedImageUrl = getCldImageUrl(options, config);
          console.log('BBC Input Image URL:', cleanBbcUrl);
          console.log('BBC Final Image URL (escaped or normal):', finalBbcUrl);
          console.log('BBC Generated Cloudinary URL:', editedImageUrl);
          const testResponse = await fetch(editedImageUrl, { method: 'HEAD' });
          if (!testResponse.ok) {
            const errorText = await testResponse.text();
            throw new Error(`BBC URL failed: ${testResponse.status} ${testResponse.statusText} - ${errorText}`);
          }
        } catch (bbcError) {
          console.error('BBC fetch error:', bbcError);
          editedImageUrl = 'https://placehold.co/1080x1080?text=Edit+Failed';
        }
      }
    } else {
      editedImageUrl = 'https://placehold.co/1080x1080?text=No+Image';
    }

    const postPayload = {
      instagram: { image_url: editedImageUrl, caption: presetCaption },
      twitter: { text: presetCaption, media: { media_urls: [editedImageUrl] } },
      tiktok: { description: presetCaption, video: editedImageUrl },
    };
    console.log('Simulated post:', JSON.stringify(postPayload, null, 2));

    return NextResponse.json<NewsApiResponse>({
      success: true,
      headline,
      description: description.substring(0, 100),
      originalImage: imageUrl,
      caption: presetCaption,
      editedImage: editedImageUrl,
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