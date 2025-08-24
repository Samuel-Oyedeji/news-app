# Instagram API Setup Guide

This guide will help you set up Instagram API access to post content automatically.

## Prerequisites

1. **Instagram Business or Creator Account**: You need a business or creator Instagram account
2. **Facebook Developer Account**: You'll need to create a Facebook app
3. **Instagram Basic Display API**: This is the API we're using for posting

## Step-by-Step Setup

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App"
3. Choose "Consumer" as the app type
4. Fill in your app details and create the app

### 2. Add Instagram Basic Display

1. In your Facebook app dashboard, click "Add Product"
2. Find and add "Instagram Basic Display"
3. Complete the setup process

### 3. Configure Instagram Basic Display

1. Go to "Instagram Basic Display" in your app dashboard
2. Add your Instagram account as a test user
3. Generate a long-lived access token

### 4. Set Environment Variables

Create a `.env.local` file in your project root and add:

```env
INSTAGRAM_ACCESS_TOKEN=your_long_lived_access_token_here
INSTAGRAM_USER_ID=your_instagram_user_id_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 5. Get Your Instagram User ID

You can get your Instagram user ID by:
1. Going to your Instagram profile
2. Right-clicking and viewing page source
3. Searching for "profilePage_" 
4. The number after it is your user ID

## API Endpoints

### 1. Post to Instagram Only
- **POST** `/api/post-instagram`
- **Body**: `{ "image_url": "url", "caption": "text" }`

### 2. Fetch News and Post to Instagram
- **GET** `/api/fetch-and-post`
- This combines both operations in one call

### 3. Fetch News Only (existing)
- **GET** `/api/fetch-news`

## Testing

1. Start your development server: `npm run dev`
2. Test the Instagram posting: `GET /api/fetch-and-post`
3. Check your Instagram account for the new post

## Troubleshooting

### Common Issues

1. **"Instagram credentials not configured"**
   - Make sure you've set the environment variables
   - Restart your development server after adding them

2. **"Failed to create Instagram post"**
   - Check if your access token is valid
   - Ensure your Instagram account is connected to the Facebook app
   - Verify the image URL is accessible

3. **"Failed to publish Instagram post"**
   - This usually means the media was created but couldn't be published
   - Check Instagram's content policies
   - Ensure the image meets Instagram's requirements

### Instagram API Limits

- **Rate Limits**: Instagram has strict rate limits
- **Content Restrictions**: Follow Instagram's community guidelines
- **Image Requirements**: Images must be accessible via public URL

## Security Notes

- Never commit your `.env.local` file to version control
- Keep your access tokens secure
- Consider implementing token refresh logic for production use
- Monitor your API usage to stay within Instagram's limits

## Production Considerations

For production deployment:
1. Use environment variables in your hosting platform
2. Implement proper error handling and logging
3. Add rate limiting to prevent abuse
4. Consider using Instagram's webhook for real-time updates
5. Implement token refresh logic for long-term use
