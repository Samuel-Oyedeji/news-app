import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Redis } from '@upstash/redis';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

export const runtime = 'nodejs';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Upstash Redis client
const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const USED_QUIZ_KEY = 'used_python_quizzes';

// Function to read used quizzes from Redis
async function readUsedQuizzes(): Promise<string[]> {
    try {
        const quizzes = await redis.get<string[]>(USED_QUIZ_KEY);
        return Array.isArray(quizzes) ? quizzes : [];
    } catch (error) {
        console.error('Error reading used quizzes from Redis:', error);
        return [];
    }
}

// Function to append quiz hash to Redis
async function appendUsedQuiz(quizHash: string): Promise<void> {
    try {
        const existing = await readUsedQuizzes();
        const updated = [...new Set([...existing, quizHash])];
        await redis.setex(USED_QUIZ_KEY, 30 * 24 * 60 * 60, updated); // 30 days expiration
    } catch (error) {
        console.error('Error appending to Redis:', error);
    }
}

async function generateQuizContent(retryCount = 0): Promise<{ code: string; options: { A: string; B: string; C: string; D: string }; answer: string; explanation: string }> {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Google Gemini API key not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
    Generate a unique and tricky Python quiz question.
    The question should be a short snippet of Python code (max 10 lines).
    Provide 4 options (A, B, C, D) where one is correct and three are plausible distractors.
    Focus on concepts like loops, list comprehensions, string manipulation, scope, or operator precedence.
    
    Return ONLY a JSON object with this structure:
    {
      "code": "string with \\n for newlines",
      "options": {
        "A": "option 1",
        "B": "option 2",
        "C": "option 3",
        "D": "option 4"
      },
      "answer": "A",
      "explanation": "Brief explanation of why"
    }
  `;

    try {
        const result = await model.generateContent(prompt);
        let content = result.response.text();
        content = content.replace(/\`\`\`json\n|\n\`\`\`/g, '').trim();
        const parsed = JSON.parse(content);
        return parsed;
    } catch (error) {
        if (retryCount < 3) {
            return generateQuizContent(retryCount + 1);
        }
        throw error;
    }
}

// Simple syntax highlighting helper
function getSyntaxColor(word: string): string {
    const keywords = ['def', 'return', 'if', 'else', 'elif', 'for', 'while', 'break', 'continue', 'import', 'from', 'class', 'try', 'except', 'finally', 'with', 'as', 'pass', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'del', 'raise', 'in', 'is', 'not', 'and', 'or'];
    const builtins = ['print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'list', 'dict', 'set', 'tuple', 'int', 'str', 'float', 'bool', 'super', 'type', 'id', 'input', 'open'];
    const booleans = ['True', 'False', 'None'];

    if (keywords.includes(word)) return '#ff79c6'; // Pink
    if (builtins.includes(word)) return '#8be9fd'; // Cyan
    if (booleans.includes(word)) return '#bd93f9'; // Purple
    if (!isNaN(Number(word))) return '#bd93f9'; // Purple (numbers)
    if (word.startsWith('"') || word.startsWith("'")) return '#f1fa8c'; // Yellow (strings - basic check)
    return '#f8f8f2'; // White (default)
}

async function generateQuizImage(quizData: { code: string; options: { A: string; B: string; C: string; D: string } }) {
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    //  ctx.fillStyle = '#111111'; // Dark background
    ctx.fillStyle = '#ffffff'; // Revert to White
    ctx.fillRect(0, 0, width, height);

    // 1.5 Draw Python Logo Watermark
    try {
        const logoPath = path.resolve(process.cwd(), 'public', 'python-logo.png');
        const logoImage = await loadImage(logoPath);

        ctx.save();
        ctx.globalAlpha = 0.3; // Low opacity
        // Center the logo
        const logoSize = 800;
        const logoX = (width - logoSize) / 2;
        const logoY = (height - logoSize) / 2;
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
        ctx.restore();
    } catch (e) {
        console.warn('Failed to load python logo:', e);
    }

    // Register fonts (try to reuse existing or fallback)
    try {
        const fontPath = path.resolve(process.cwd(), 'public', 'fonts', 'ARIBLK.TTF');
        if (!GlobalFonts.has('ArialBlack')) {
            GlobalFonts.registerFromPath(fontPath, 'ArialBlack');
        }
    } catch {
        console.warn('Font registration failed, using default');
    }

    // 2. Title "Python Quiz"
    ctx.font = 'bold 80px ArialBlack, sans-serif';
    ctx.fillStyle = '#6200ea'; // Revert to Deep Purple
    ctx.textAlign = 'center';
    ctx.fillText('Python Quiz', width / 2, 130);

    // 3. Code Block Container
    const codeBoxX = 100;
    const codeBoxY = 200;
    const codeBoxW = width - 200;

    // Dynamic Height Calculation
    const lines = quizData.code.split('\n');
    const lineHeight = 45;
    const paddingTop = 70;
    const paddingBottom = 70;
    const calculatedHeight = paddingTop + (lines.length * lineHeight) + paddingBottom;
    const codeBoxH = Math.max(calculatedHeight, 300); // Minimum height of 300
    const borderRadius = 20;

    // Code box glow effect (Optional: kept subtle or removed, let's keep it subtle or remove for clean light look. Removing for clean look as per "back to light mode")
    ctx.shadowColor = '#6200ea';
    ctx.shadowBlur = 0; // No glow for clean light mode
    ctx.fillStyle = '#1e1e3f'; // Dark Blue/Grey (Keep this dark for code contrast)
    ctx.beginPath();
    ctx.roundRect(codeBoxX, codeBoxY, codeBoxW, codeBoxH, borderRadius);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow

    // 4. Draw Code with basic syntax highlighting
    ctx.font = '35px monospace';
    ctx.textAlign = 'left';

    let currentY = codeBoxY + paddingTop;
    const startX = codeBoxX + 40;

    lines.forEach(line => {
        // Very basic tokenizer: split by space but keep delimiters (simplified)
        const words = line.split(/(\s+|[(),:\[\]])/);
        let currentX = startX;

        words.forEach(word => {
            ctx.fillStyle = getSyntaxColor(word.trim());
            ctx.fillText(word, currentX, currentY);
            currentX += ctx.measureText(word).width;
        });
        currentY += lineHeight;
    });

    // 5. Options Separator
    const separatorY = codeBoxY + codeBoxH + 50;

    ctx.strokeStyle = '#6200ea'; // Revert to Deep Purple
    ctx.lineWidth = 2; // Revert to 2
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(100, separatorY);
    ctx.lineTo(width - 100, separatorY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Draw Options
    ctx.font = 'bold 35px ArialBlack, sans-serif';
    ctx.fillStyle = '#000000'; // Revert to Black
    ctx.textAlign = 'left';

    const optY1 = separatorY + 70;
    const optY2 = optY1 + 80;
    const col1X = 80;
    const col2X = 560;

    // Helper to truncate text to fit width (approximate)
    const truncateOption = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    };

    const maxChars = 25; // Approximate max chars per column

    ctx.fillText(`A. ${truncateOption(quizData.options.A, maxChars)}`, col1X, optY1);
    ctx.fillText(`B. ${truncateOption(quizData.options.B, maxChars)}`, col2X, optY1);
    ctx.fillText(`C. ${truncateOption(quizData.options.C, maxChars)}`, col1X, optY2);
    ctx.fillText(`D. ${truncateOption(quizData.options.D, maxChars)}`, col2X, optY2);

    return canvas.toBuffer('image/jpeg');
}

export async function generatePythonQuizLogic() {
    // 1. Generate Content
    let quizContent;
    let isUnique = false;
    let attempts = 0;
    const usedQuizzes = await readUsedQuizzes();

    while (!isUnique && attempts < 3) {
        quizContent = await generateQuizContent();
        // Simple hash based on code content to check uniqueness
        const hash = Buffer.from(quizContent.code).toString('base64');

        if (!usedQuizzes.includes(hash)) {
            isUnique = true;
            await appendUsedQuiz(hash);
        } else {
            attempts++;
        }
    }

    if (!quizContent) {
        throw new Error('Failed to generate unique quiz content');
    }

    // 2. Generate Image
    const imageBuffer = await generateQuizImage(quizContent);

    // 3. Upload to Supabase
    const fileName = `python-images/python-quiz-${Date.now()}.jpg`;
    console.log('Starting Supabase upload for:', fileName);
    console.log('Supabase URL configured:', !!process.env.SUPABASE_URL);

    let uploadSuccess = false;
    let uploadError: unknown = null;
    let retryCount = 0;
    const maxRetries = 3;
    let publicUrl = '';

    while (!uploadSuccess && retryCount < maxRetries) {
        try {
            if (retryCount > 0) {
                console.log(`Retrying upload (attempt ${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }

            const { error } = await supabase.storage
                .from('news-images')
                .upload(fileName, imageBuffer, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: true,
                });

            if (error) {
                throw error;
            }

            uploadSuccess = true;
            console.log('Upload successful!');
        } catch (err) {
            console.error(`Upload attempt ${retryCount + 1} failed:`, err);
            uploadError = err;
            retryCount++;
        }
    }

    if (!uploadSuccess) {
        throw new Error(`Failed to upload image to Supabase after ${maxRetries} attempts: ${(uploadError as Error)?.message || 'Unknown error'}`);
    }

    const { data: urlData } = supabase.storage
        .from('news-images')
        .getPublicUrl(fileName);

    publicUrl = urlData.publicUrl;

    return {
        success: true,
        imageUrl: publicUrl,
        caption: "Python Question / Quiz; What is the output of the following Python code, and why? Comment your answers below!",
        quizData: quizContent
    };
}

export async function POST() {
    try {
        const result = await generatePythonQuizLogic();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error generating Python quiz:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
