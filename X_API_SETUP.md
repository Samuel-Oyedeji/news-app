# X (Twitter) API Setup Guide

This guide will help you set up X API access to post content automatically.

## Prerequisites

1. **X Developer Account**: You need a verified X developer account
2. **X App**: You'll need to create an app in the X Developer Portal
3. **Elevated Access**: For posting tweets, you need Elevated access (free tier)

## Step-by-Step Setup

### 1. Apply for X Developer Access

1. Go to [X Developer Portal](https://developer.twitter.com/)
2. Sign in with your X account
3. Apply for a developer account (this can take 1-2 days for approval)
4. Complete the application form explaining your use case

### 2. Create an X App

1. Once approved, go to the [X Developer Portal](https://developer.twitter.com/)
2. Click "Create App" or "Create Project"
3. Fill in your app details:
   - App name: Your app name
   - Use case: Select appropriate category
   - Description: Brief description of what your app does
4. Create the app

### 3. Configure App Permissions

1. In your app dashboard, go to "Settings" → "User authentication settings"
2. Enable OAuth 1.0a
3. Set App permissions to "Read and Write"
4. Add callback URLs (can be localhost for development)
5. Save changes

### 4. Generate API Keys and Tokens

1. Go to "Keys and tokens" tab
2. Generate "Consumer Keys" (API Key and API Secret)
3. Generate "Authentication Tokens" (Access Token and Access Token Secret)
4. **Important**: Keep these secure and never share them

### 5. Set Environment Variables

Create or update your `.env.local` file and add:

```env
# X (Twitter) API Credentials
X_BEARER_TOKEN=your_bearer_token_here
X_API_KEY=your_api_key_here
X_API_SECRET=your_api_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_TOKEN_SECRET=your_access_token_secret_here

# Base URL for your app
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## API Endpoints

### 1. Post to X Only
- **POST** `/api/post-x`
- **Body**: `{ "image_url": "url", "caption": "text" }`

### 2. Post to All Social Media
- **POST** `/api/post-all-social`
- **Body**: `{ "image_url": "url", "caption": "text" }`

### 3. Fetch News and Post to All Social Media
- **GET** `/api/fetch-and-post-all`
- This combines news fetching and posting to all platforms

### 4. Existing Endpoints
- **GET** `/api/fetch-news-supa` - Fetch news only
- **GET** `/api/fetch-and-post` - Fetch news and post to Instagram only

## How X Posting Works

1. **Media Upload**: The API downloads your image and uploads it to X's media server
2. **Tweet Creation**: Creates a tweet with the uploaded media and your caption
3. **Character Limit**: Automatically truncates captions to fit X's 280 character limit

## Testing

1. Start your development server: `npm run dev`
2. Test X posting: `POST /api/post-x`
3. Test combined posting: `GET /api/fetch-and-post-all`
4. Check your X account for the new tweet

## Troubleshooting

### Common Issues

1. **"X API credentials not configured"**
   - Make sure you've set all 5 environment variables
   - Restart your development server after adding them

2. **"Failed to upload media to X"**
   - Check if your API keys are correct
   - Ensure your app has "Read and Write" permissions
   - Verify the image URL is accessible

3. **"Failed to create tweet"**
   - Check if your access tokens are valid
   - Ensure your app is approved and active
   - Check X's rate limits

### X API Limits

- **Rate Limits**: X has strict rate limits (300 tweets per 3 hours for free tier)
- **Media Limits**: Images up to 5MB, videos up to 512MB
- **Character Limit**: 280 characters per tweet
- **Media per Tweet**: Up to 4 images per tweet

## Security Notes

- Never commit your `.env.local` file to version control
- Keep your API keys and tokens secure
- Rotate your tokens regularly
- Monitor your API usage to stay within limits

## Production Considerations

For production deployment:
1. Use environment variables in your hosting platform
2. Implement proper error handling and logging
3. Add rate limiting to prevent abuse
4. Consider implementing retry logic for failed posts
5. Monitor API usage and implement webhook notifications

## Cost Information

- **Free Tier**: 1,500 tweets per month, 300 tweets per 3 hours
- **Basic Tier**: $100/month for higher limits
- **Enterprise**: Custom pricing for high-volume usage

## Best Practices

1. **Rate Limiting**: Don't exceed X's rate limits
2. **Content Quality**: Ensure your content follows X's guidelines
3. **Error Handling**: Implement proper error handling for failed posts
4. **Monitoring**: Keep track of your API usage
5. **Testing**: Always test in development before production
