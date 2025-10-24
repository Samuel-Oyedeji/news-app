# Supabase Storage Setup Guide

## What Changed
- Replaced Vercel Blob with Supabase Storage
- Updated both `fetch-news-supa` API routes
- Images are now stored in Supabase Storage bucket called `news-images`

## Required Environment Variables
Add these to your `.env.local` file:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Important**: Use the `SERVICE_ROLE_KEY` (not the anon key) to bypass Row Level Security policies for server-side uploads.

## How to Get Supabase Credentials

1. **Create a Supabase Account**
   - Go to [supabase.com](https://supabase.com)
   - Sign up for a free account

2. **Create a New Project**
   - Click "New Project"
   - Choose your organization
   - Enter project name (e.g., "news-app")
   - Set a database password
   - Choose a region close to you

3. **Get Your Credentials**
   - Go to Settings → API
   - Copy the "Project URL" → this is your `SUPABASE_URL`
   - Copy the "service_role secret" key → this is your `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **Important**: Use the service_role key, not the anon key!

4. **Create Storage Bucket**
   - Go to Storage in your Supabase dashboard
   - Click "Create a new bucket"
   - Name it: `news-images`
   - Make it **public** (so images can be accessed via URL)
   - Click "Create bucket"

## Supabase Storage Benefits
- **Free Tier**: 1GB storage + 5GB bandwidth/month
- **No time limits** on free tier
- **Built-in CDN** for fast image delivery
- **Easy to manage** via Supabase dashboard
- **RESTful API** similar to Vercel Blob

## Testing
Once you've set up the environment variables and created the bucket, your API should work exactly the same as before, but now using Supabase Storage instead of Vercel Blob.

## Monitoring Usage
- Check your storage usage in Supabase Dashboard → Storage
- Monitor bandwidth usage in Supabase Dashboard → Settings → Usage
