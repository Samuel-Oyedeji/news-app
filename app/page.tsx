'use client';
import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import { NewsApiResponse } from './types'; // Adjust path if needed

export default function Home() {
  const [data, setData] = useState<NewsApiResponse | null>(null);

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/fetch-news');
      const json: NewsApiResponse = await res.json();
      setData(json);
    } catch (error) {
      console.error('Fetch error:', error);
      setData({ success: false, message: 'Failed to fetch news' });
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={fetchNews}>Fetch BBC News POC</button>
      {data && (
        <div>
          {data.success ? (
            <>
              <h2>{data.headline || 'No headline'}</h2>
              <p>{data.caption || 'No caption'}</p>
              {data.editedImage && data.originalImage && (
                <CldImage
                  width={1080}
                  height={1080}
                  src={data.originalImage} // Use BBC image URL
                  sizes="50vw"
                  crop="fill"
                  gravity="center"
                  format="auto"
                  quality="auto"
                  overlays={[
                    {
                      position: { gravity: 'south', y: 20 },
                      text: {
                        color: 'white',
                        fontFamily: 'Arial',
                        fontSize: 40,
                        fontWeight: 'bold',
                        text: encodeURIComponent((data.headline || '').substring(0, 30)),
                      },
                    },
                  ]}
                  alt={`Edited image for ${data.headline || 'news'}`}
                />
              )}
              {(!data.editedImage || !data.originalImage) && (
                <p>No image available</p>
              )}
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </>
          ) : (
            <p>Error: {data.message || 'Unknown error'}</p>
          )}
        </div>
      )}
    </div>
  );
}