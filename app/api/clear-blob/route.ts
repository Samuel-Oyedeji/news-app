import { NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

interface ClearBlobResponse {
  success: boolean;
  deletedCount?: number;
  message?: string;
  error?: string;
}

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json<ClearBlobResponse>(
      {
        success: false,
        error: 'BLOB_READ_WRITE_TOKEN is not configured',
      },
      { status: 500 },
    );
  }

  try {
    let deletedCount = 0;
    let cursor: string | undefined;

    console.log('Starting Vercel Blob cleanup');

    do {
      const { blobs, cursor: nextCursor } = await list({
        cursor,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      if (blobs.length > 0) {
        for (const blob of blobs) {
          try {
            console.log(`Deleting blob: ${blob.pathname} (${blob.url})`);
            await del(blob.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
            deletedCount += 1;
          } catch (deleteError) {
            console.error('Failed to delete blob:', blob.url, deleteError);
          }
        }
      }

      cursor = nextCursor ?? undefined;
    } while (cursor);

    return NextResponse.json<ClearBlobResponse>({
      success: true,
      deletedCount,
      message: deletedCount === 0 ? 'No blobs found to delete' : `Deleted ${deletedCount} blobs`,
    });
  } catch (error) {
    console.error('Error clearing Vercel Blob store:', error);
    return NextResponse.json<ClearBlobResponse>(
      {
        success: false,
        error: `Failed to clear blobs: ${(error as Error).message}`,
      },
      { status: 500 },
    );
  }
}

