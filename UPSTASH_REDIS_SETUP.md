# Upstash Redis Setup Guide

## Overview
This application uses Upstash Redis for persistent storage of used headlines, replacing the file-based storage that caused issues on Vercel's serverless environment.

## Why Upstash Redis?

**Vercel KV is no longer available** as a native Vercel storage product. The current Vercel storage options are:
- ✅ **Vercel Blob**: For file storage
- ✅ **Edge Config**: For read-only configuration data (not suitable for frequent writes)

**Our Solution**: Upstash Redis (via Vercel Marketplace)
- ✅ **Read/Write Operations**: Supports frequent writes (needed for tracking used headlines)
- ✅ **Persistent Storage**: Data survives function restarts
- ✅ **High Performance**: Redis-based, sub-millisecond access
- ✅ **Perfect for Dynamic Data**: Ideal for data that changes frequently
- ✅ **No File System**: Completely eliminates read-only file system errors

## Setup Steps

### 1. Create Upstash Redis Database
1. Go to your Vercel dashboard
2. Navigate to your project
3. Go to the "Storage" tab
4. Click "Create Database"
5. Select "Upstash Redis" (from Marketplace)
6. Choose a name (e.g., "news-app-redis")
7. Select a region close to your users
8. Click "Create"

### 2. Environment Variables (Already Set!)
Vercel automatically provides these environment variables when you create an Upstash Redis database:

- `KV_REST_API_URL` - Redis REST API URL
- `KV_REST_API_TOKEN` - Redis REST API token
- `KV_REST_API_READ_ONLY_TOKEN` - Read-only token (optional)
- `REDIS_URL` - Standard Redis connection URL
- `KV_URL` - Alternative Redis URL

**No manual setup needed!** These are automatically available in your Vercel environment.

### 3. Deploy Your Application
1. Push your changes to your Git repository
2. Vercel will automatically redeploy
3. The application will now use Upstash Redis for persistent storage

## How It Works

- **Persistent Storage**: Used headlines are stored in Upstash Redis and persist across function restarts
- **Automatic Expiration**: Headlines expire after 7 days to prevent unlimited growth
- **Fallback Handling**: If Redis is unavailable, the app continues to work (just won't filter duplicates)
- **No File System**: Completely eliminates the read-only file system error

## Benefits

✅ **Persistent**: Data survives function restarts  
✅ **Fast**: Redis-based, very low latency  
✅ **Scalable**: Handles high traffic  
✅ **Reliable**: Built-in redundancy  
✅ **Cost-effective**: Pay only for what you use  

## Troubleshooting

If you encounter issues:

1. **Check Environment Variables**: Ensure `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
2. **Verify Redis Database**: Make sure your Upstash Redis database is active in Vercel dashboard
3. **Check Logs**: Look for Redis-related errors in Vercel function logs
4. **Test Connection**: The app will log Redis operations for debugging

## Cost

Upstash Redis pricing:
- **Free Tier**: 10,000 requests/day, 256MB storage
- **Pay-as-you-go**: $0.2 per 100K requests, $0.2 per GB storage

For a news app calling every 40 minutes, the free tier should be more than sufficient.
