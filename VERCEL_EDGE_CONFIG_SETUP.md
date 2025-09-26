# Vercel Edge Config Setup Guide

## Overview
This application uses Vercel Edge Config with an intelligent caching strategy for duplicate headline prevention, replacing the file-based storage that caused issues on Vercel's serverless environment.

## Why Edge Config + Smart Caching?

**Vercel KV is no longer available** as a native Vercel storage product. The current Vercel storage options are:
- ✅ **Vercel Blob**: For file storage
- ✅ **Edge Config**: For read-only configuration data

**Our Solution**: Edge Config + In-Memory Caching
- ✅ **Read-Only Edge Config**: Stores recent headlines (updated via Vercel dashboard)
- ✅ **In-Memory Cache**: 1-hour cache for immediate duplicate prevention
- ✅ **Fallback Strategy**: Works even without Edge Config configured
- ✅ **No File System**: Completely eliminates read-only file system errors

## Setup Steps

### 1. Create Edge Config Store (Optional)
1. Go to your Vercel dashboard
2. Navigate to your project
3. Go to the "Storage" tab
4. Click "Create Database"
5. Select "Edge Config"
6. Choose a name (e.g., "news-app-config")
7. Click "Create"

### 2. Add Recent Headlines to Edge Config (Optional)
1. In your Edge Config dashboard, go to "Items"
2. Add a key-value pair:
   ```json
   {
     "recent_headlines": []
   }
   ```
3. Click "Save Items"

### 3. Get Connection Details (Automatic)
1. Vercel automatically creates the `EDGE_CONFIG` environment variable
2. This contains the connection string for your Edge Config
3. No manual configuration needed!

### 4. Deploy Your Application
1. Push your changes to your Git repository
2. Vercel will automatically redeploy
3. The application will work with or without Edge Config configured

## How It Works

### Smart Caching Strategy
1. **In-Memory Cache**: Stores recent headlines for 1 hour
2. **Edge Config Fallback**: Reads from Edge Config if cache is empty
3. **Automatic Updates**: Cache updates with each API call
4. **Graceful Degradation**: Works even without Edge Config

### Duplicate Prevention
- **Immediate**: In-memory cache prevents duplicates within 1 hour
- **Persistent**: Edge Config provides longer-term duplicate prevention
- **Smart**: Only checks recent headlines, not all-time history

## Benefits

✅ **No Setup Required**: Works out of the box  
✅ **Ultra-Fast**: In-memory cache provides instant responses  
✅ **Reliable**: Graceful fallback if Edge Config unavailable  
✅ **Cost-Effective**: Uses free Edge Config tier  
✅ **No File System**: Eliminates read-only file system errors  

## Troubleshooting

If you encounter issues:

1. **Check Logs**: Look for Edge Config connection errors in Vercel function logs
2. **Verify Edge Config**: Make sure your Edge Config store is active (optional)
3. **Cache Behavior**: The app will log cache operations for debugging
4. **Fallback Mode**: App works even without Edge Config configured

## Cost

Edge Config pricing:
- **Free Tier**: 100,000 reads/month, 256KB storage
- **Pro**: $0.20 per 100,000 reads, $0.20 per MB storage

For a news app, the free tier is more than sufficient.
