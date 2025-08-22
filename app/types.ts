// app/types.ts
export interface NewsApiResponse {
  success: boolean;
  headline?: string;
  description?: string;
  originalImage?: string | null;
  caption?: string;
  editedImage?: string | null;
  link?: string | null;
  postPayload?: {
    instagram: { image_url: string | null; caption: string };
    twitter: { text: string; media: { media_urls: (string | null)[] } };
    tiktok: { description: string; video: string | null };
  };
  message?: string; // For error cases
  error?: string; // Add this
}