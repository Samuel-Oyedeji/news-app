'use client';
import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import { NewsApiResponse } from './types';

interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  newsData?: NewsApiResponse;
  instagramResults?: Array<{
    success: boolean;
    message?: string;
    post_id?: string;
    error?: string;
  }>;
  xResults?: Array<{
    success: boolean;
    message?: string;
    tweet_id?: string;
    error?: string;
  }>;
}

export default function Home() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [data, setData] = useState<NewsApiResponse | null>(null);

  const fetchNews = async () => {
    try {
      setLoading('fetch-news-supa');
      const res = await fetch('/api/fetch-news-supa');
      const json: NewsApiResponse = await res.json();
      setData(json);
      setResult(null);
    } catch (error) {
      console.error('Fetch error:', error);
      setData({ success: false, message: 'Failed to fetch news' });
    } finally {
      setLoading(null);
    }
  };

  const fetchAndPostInstagram = async () => {
    try {
      setLoading('fetch-and-post');
      const res = await fetch('/api/fetch-and-post');
      const json: ApiResponse = await res.json();
      setResult(json);
      setData(json.newsData || null);
    } catch (error) {
      console.error('Fetch and post error:', error);
      setResult({ success: false, error: 'Failed to fetch and post to Instagram' });
    } finally {
      setLoading(null);
    }
  };

  const fetchAndPostAll = async () => {
    try {
      setLoading('fetch-and-post-all');
      const res = await fetch('/api/fetch-and-post-all');
      const json: ApiResponse = await res.json();
      setResult(json);
      setData(json.newsData || null);
    } catch (error) {
      console.error('Fetch and post all error:', error);
      setResult({ success: false, error: 'Failed to fetch and post to all platforms' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-retro-darker via-retro-dark to-retro-darker">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-neon-pink/10 rounded-full blur-xl animate-pulse-slow"></div>
        <div className="absolute top-40 right-32 w-24 h-24 bg-neon-blue/10 rounded-full blur-xl animate-bounce-slow"></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-neon-green/10 rounded-full blur-xl animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 bg-neon-yellow/10 rounded-full blur-xl animate-bounce-slow"></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="retro-text text-6xl md:text-8xl font-black mb-6 retro-glow">
            RETRO NEWS
          </h1>
          <p className="text-retro-light text-xl md:text-2xl font-medium tracking-wider">
            SOCIAL MEDIA AUTOMATION SYSTEM
          </p>
          <div className="mt-8 w-32 h-1 bg-gradient-to-r from-neon-pink via-neon-blue to-neon-green mx-auto rounded-full"></div>
        </div>

        {/* Control Panel */}
        <div className="retro-card max-w-4xl mx-auto p-8 mb-12">
          <h2 className="retro-text text-3xl font-bold text-center mb-8">
            CONTROL PANEL
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Instagram Only Button */}
            <div className="text-center">
              <button
                onClick={fetchAndPostInstagram}
                disabled={loading !== null}
                className={`retro-button w-full mb-4 ${loading === 'fetch-and-post' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                {loading === 'fetch-and-post' ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    PROCESSING...
                  </div>
                ) : (
                  'INSTAGRAM ONLY'
                )}
              </button>
              <p className="text-retro-gray text-sm font-mono">
                fetch-and-post
              </p>
            </div>

            {/* Instagram and X Button */}
            <div className="text-center">
              <button
                onClick={fetchAndPostAll}
                disabled={loading !== null}
                className={`retro-button w-full mb-4 ${loading === 'fetch-and-post-all' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
              >
                {loading === 'fetch-and-post-all' ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    PROCESSING...
                  </div>
                ) : (
                  'INSTAGRAM & X'
                )}
              </button>
              <p className="text-retro-gray text-sm font-mono">
                fetch-and-post-all
              </p>
            </div>
          </div>

          {/* Legacy Button */}
          <div className="text-center mt-8">
            <button
              onClick={fetchNews}
              disabled={loading !== null}
              className={`retro-button w-full max-w-md mb-4 ${loading === 'fetch-news-supa' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {loading === 'fetch-news-supa' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  FETCHING...
                </div>
              ) : (
                'FETCH NEWS ONLY'
              )}
            </button>
            <p className="text-retro-gray text-sm font-mono">
              fetch-news-supa
            </p>
          </div>

          {/* Python Quiz Button */}
          <div className="text-center mt-8">
            <button
              onClick={async () => {
                try {
                  setLoading('generate-python-quiz');
                  const res = await fetch('/api/generate-python-quiz', { method: 'POST' });
                  const json = await res.json();

                  if (json.success) {
                    setResult({ success: true, message: 'Quiz generated successfully!' });
                    // Adapt the quiz response to fit the existing data structure for display
                    setData({
                      success: true,
                      posts: [{
                        headline: 'Python Quiz Generated',
                        originalHeadline: 'Python Quiz',
                        description: `Answer: ${json.quizData.answer}. Explanation: ${json.quizData.explanation}`,
                        originalImage: null,
                        caption: json.caption,
                        editedImage: json.imageUrl,
                        platformImages: { instagram: json.imageUrl },
                        link: null,
                        postPayload: { instagram: { image_url: json.imageUrl, caption: json.caption } }
                      }]
                    });
                  } else {
                    setResult({ success: false, error: json.error || 'Failed to generate quiz' });
                  }
                } catch (error) {
                  console.error('Quiz generation error:', error);
                  setResult({ success: false, error: 'Failed to generate quiz' });
                } finally {
                  setLoading(null);
                }
              }}
              disabled={loading !== null}
              className={`retro-button w-full max-w-md mb-4 ${loading === 'generate-python-quiz' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {loading === 'generate-python-quiz' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  GENERATING...
                </div>
              ) : (
                'GENERATE PYTHON QUIZ'
              )}
            </button>
            <p className="text-retro-gray text-sm font-mono">
              generate-python-quiz
            </p>
          </div>

          {/* JavaScript Quiz Button */}
          <div className="text-center mt-8">
            <button
              onClick={async () => {
                try {
                  setLoading('generate-javascript-quiz');
                  const res = await fetch('/api/generate-javascript-quiz', { method: 'POST' });
                  const json = await res.json();

                  if (json.success) {
                    setResult({ success: true, message: 'JS Quiz generated successfully!' });
                    setData({
                      success: true,
                      posts: [{
                        headline: 'JavaScript Quiz Generated',
                        originalHeadline: 'JavaScript Quiz',
                        description: `Answer: ${json.quizData.answer}. Explanation: ${json.quizData.explanation}`,
                        originalImage: null,
                        caption: json.caption,
                        editedImage: json.imageUrl,
                        platformImages: { instagram: json.imageUrl },
                        link: null,
                        postPayload: { instagram: { image_url: json.imageUrl, caption: json.caption } }
                      }]
                    });
                  } else {
                    setResult({ success: false, error: json.error || 'Failed to generate quiz' });
                  }
                } catch (error) {
                  console.error('JS Quiz generation error:', error);
                  setResult({ success: false, error: 'Failed to generate quiz' });
                } finally {
                  setLoading(null);
                }
              }}
              disabled={loading !== null}
              className={`retro-button w-full max-w-md mb-4 ${loading === 'generate-javascript-quiz' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {loading === 'generate-javascript-quiz' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  GENERATING...
                </div>
              ) : (
                'GENERATE JAVASCRIPT QUIZ'
              )}
            </button>
            <p className="text-retro-gray text-sm font-mono">
              generate-javascript-quiz
            </p>
          </div>

          {/* Go Quiz Button */}
          <div className="text-center mt-8">
            <button
              onClick={async () => {
                try {
                  setLoading('generate-go-quiz');
                  const res = await fetch('/api/generate-go-quiz', { method: 'POST' });
                  const json = await res.json();

                  if (json.success) {
                    setResult({ success: true, message: 'Go Quiz generated successfully!' });
                    setData({
                      success: true,
                      posts: [{
                        headline: 'Go Quiz Generated',
                        originalHeadline: 'Go Quiz',
                        description: `Answer: ${json.quizData.answer}. Explanation: ${json.quizData.explanation}`,
                        originalImage: null,
                        caption: json.caption,
                        editedImage: json.imageUrl,
                        platformImages: { instagram: json.imageUrl },
                        link: null,
                        postPayload: { instagram: { image_url: json.imageUrl, caption: json.caption } }
                      }]
                    });
                  } else {
                    setResult({ success: false, error: json.error || 'Failed to generate quiz' });
                  }
                } catch (error) {
                  console.error('Go Quiz generation error:', error);
                  setResult({ success: false, error: 'Failed to generate quiz' });
                } finally {
                  setLoading(null);
                }
              }}
              disabled={loading !== null}
              className={`retro-button w-full max-w-md mb-4 ${loading === 'generate-go-quiz' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {loading === 'generate-go-quiz' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  GENERATING...
                </div>
              ) : (
                'GENERATE GO QUIZ'
              )}
            </button>
            <p className="text-retro-gray text-sm font-mono">
              generate-go-quiz
            </p>
          </div>
        </div>

        {/* Status Display */}
        {result && (
          <div className="retro-card max-w-4xl mx-auto p-6 mb-8">
            <h3 className="retro-text text-2xl font-bold mb-4">STATUS REPORT</h3>
            <div className={`p-4 rounded-lg border-2 ${result.success
              ? 'border-neon-green bg-neon-green/10 text-neon-green'
              : 'border-neon-pink bg-neon-pink/10 text-neon-pink'
              }`}>
              <p className="font-mono text-sm">
                {result.success ? '✓ SUCCESS' : '✗ ERROR'}: {result.message || result.error}
              </p>
            </div>

            {result.instagramResults && result.instagramResults.length > 0 && (
              <div className="mt-4 p-4 bg-retro-dark/50 rounded-lg border border-neon-pink/30">
                <h4 className="text-neon-pink font-bold mb-2">INSTAGRAM RESULTS:</h4>
                {result.instagramResults.map((result, index) => (
                  <p key={index} className="font-mono text-sm text-retro-light">
                    Post {index + 1}: {result.success ? '✓ Posted' : '✗ Failed'}
                    {result.post_id && ` (ID: ${result.post_id})`}
                    {result.error && ` - ${result.error}`}
                  </p>
                ))}
              </div>
            )}

            {result.xResults && result.xResults.length > 0 && (
              <div className="mt-4 p-4 bg-retro-dark/50 rounded-lg border border-neon-blue/30">
                <h4 className="text-neon-blue font-bold mb-2">X (TWITTER) RESULTS:</h4>
                {result.xResults.map((result, index) => (
                  <p key={index} className="font-mono text-sm text-retro-light">
                    Tweet {index + 1}: {result.success ? '✓ Posted' : '✗ Failed'}
                    {result.tweet_id && ` (ID: ${result.tweet_id})`}
                    {result.error && ` - ${result.error}`}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* News Display */}
        {data && data.success && data.posts && data.posts.length > 0 && (
          <div className="retro-card max-w-4xl mx-auto p-6">
            <h3 className="retro-text text-2xl font-bold mb-6">LATEST NEWS</h3>

            {data.posts.map((post, index) => (
              <div key={index} className="mb-8 p-6 bg-retro-dark/50 rounded-lg border border-neon-pink/20">
                <h4 className="text-retro-light text-xl font-bold mb-3">
                  {post.headline || 'No headline'}
                </h4>
                <p className="text-retro-gray mb-4">
                  {post.caption || 'No caption'}
                </p>

                {post.editedImage && post.originalImage && (
                  <div className="relative">
                    <CldImage
                      width={1080}
                      height={1080}
                      src={post.originalImage}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      crop="fill"
                      gravity="center"
                      format="auto"
                      quality="auto"
                      overlays={[
                        {
                          position: { gravity: 'south', y: 20 },
                          text: {
                            color: 'white',
                            fontFamily: 'Orbitron',
                            fontSize: 40,
                            fontWeight: 'bold',
                            text: encodeURIComponent((post.headline || '').substring(0, 30)),
                          },
                        },
                      ]}
                      alt={`Edited image for ${post.headline || 'news'}`}
                      className="w-full max-w-md mx-auto rounded-lg border border-neon-pink/30"
                    />
                  </div>
                )}

                {post.link && (
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-neon-pink to-neon-blue text-white font-bold rounded-lg hover:scale-105 transition-transform"
                  >
                    READ MORE
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-retro-gray text-sm font-mono">
            RETRO NEWS SYSTEM v1.0 | POWERED BY NEON TECHNOLOGY
          </p>
        </div>
      </div>
    </div>
  );
}