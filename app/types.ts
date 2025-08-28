// // app/types.ts
// export interface NewsApiResponse {
//   success: boolean;
//   headline?: string;
//   description?: string;
//   originalImage?: string | null;
//   caption?: string;
//   editedImage?: string | null;
//   platformImages?: {
//     instagram: string;
//   };
//   link?: string | null;
//   postPayload?: {
//     instagram: { image_url: string | null; caption: string };
//   };
//   message?: string; // For error cases
//   error?: string; // Add this
// }

// app/types.ts
export interface NewsApiResponse {
  success: boolean;
  posts?: {
    headline: string; // Uses newHeadline from Gemini
    originalHeadline: string; // Original headline from Variety RSS
    description: string;
    originalImage: string | null;
    caption: string;
    editedImage: string;
    platformImages: {
      instagram: string;
    };
    link: string | null;
    postPayload: {
      instagram: { image_url: string; caption: string };
    };
  }[];
  message?: string; // For error cases
  error?: string; // For error cases
}