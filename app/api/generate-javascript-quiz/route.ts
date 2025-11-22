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

const USED_QUIZ_KEY = 'used_javascript_quizzes';

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
    Generate a unique and tricky JavaScript quiz question.
    The question should be a short snippet of JavaScript code (max 10 lines).
    Provide 4 options (A, B, C, D) where one is correct and three are plausible distractors.
    Focus on concepts like closures, promises, event loop, hoisting, 'this' keyword, type coercion, or ES6+ features.
    
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

// Simple syntax highlighting helper for JavaScript
function getSyntaxColor(word: string): string {
    const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'class', 'extends', 'super', 'import', 'export', 'default', 'async', 'await', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of'];
    const builtins = ['console', 'log', 'Promise', 'setTimeout', 'setInterval', 'map', 'filter', 'reduce', 'forEach', 'push', 'pop', 'length', 'toString', 'JSON', 'parse', 'stringify', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean'];
    const booleans = ['true', 'false', 'null', 'undefined', 'NaN'];

    if (keywords.includes(word)) return '#ff79c6'; // Pink
    if (builtins.includes(word)) return '#8be9fd'; // Cyan
    if (booleans.includes(word)) return '#bd93f9'; // Purple
    if (!isNaN(Number(word))) return '#bd93f9'; // Purple (numbers)
    if (word.startsWith('"') || word.startsWith("'") || word.startsWith('`')) return '#f1fa8c'; // Yellow (strings)
    return '#f8f8f2'; // White (default)
}

async function generateQuizImage(quizData: { code: string; options: { A: string; B: string; C: string; D: string } }) {
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#ffffff'; // White background
    ctx.fillRect(0, 0, width, height);

    // 1.5 Draw JavaScript Logo Watermark
    try {
        const logoPath = path.resolve(process.cwd(), 'public', 'javascript-logo.png');
        const logoImage = await loadImage(logoPath);

        ctx.save();
        ctx.globalAlpha = 0.1; // Low opacity
        // Center the logo
        const logoSize = 800;
        const logoX = (width - logoSize) / 2;
        const logoY = (height - logoSize) / 2;
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
        ctx.restore();
    } catch (e) {
        console.warn('Failed to load javascript logo:', e);
    }

    // Register fonts
    try {
        const fontPath = path.resolve(process.cwd(), 'public', 'fonts', 'ARIBLK.TTF');
        if (!GlobalFonts.has('ArialBlack')) {
            GlobalFonts.registerFromPath(fontPath, 'ArialBlack');
        }
    } catch {
        console.warn('Font registration failed, using default');
    }

    // 2. Title "JavaScript Quiz"
    ctx.font = 'bold 80px ArialBlack, sans-serif';
    ctx.fillStyle = '#F7DF1E'; // JS Yellow (darker shade for visibility on white? No, standard JS yellow is light. Let's use a darker gold/orange or black for contrast on white, OR stick to the branding. JS logo is yellow background with black text. Let's use Black for text to match JS logo style, or a dark yellow/gold)
    // Actually, on white background, pure JS yellow #F7DF1E is hard to read. 
    // Let's use a darker shade or Black with Yellow highlight? 
    // Let's try Black color for title to match the "JS" text color in the logo, maybe with a yellow underline or accent.
    // Or use a dark grey like #323330 (JS dark grey).
    ctx.fillStyle = '#323330'; // JS Dark Grey
    ctx.textAlign = 'center';
    ctx.fillText('JavaScript Quiz', width / 2, 130);

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

    ctx.fillStyle = '#1e1e3f'; // Dark Blue/Grey for code background
    ctx.beginPath();
    ctx.roundRect(codeBoxX, codeBoxY, codeBoxW, codeBoxH, borderRadius);
    ctx.fill();

    // 4. Draw Code with basic syntax highlighting
    ctx.font = '35px monospace';
    ctx.textAlign = 'left';

    let currentY = codeBoxY + paddingTop;
    const startX = codeBoxX + 40;

    lines.forEach(line => {
        const words = line.split(/(\s+|[(),:\[\]{}])/);
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

    ctx.strokeStyle = '#F7DF1E'; // JS Yellow
    ctx.lineWidth = 3;
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(100, separatorY);
    ctx.lineTo(width - 100, separatorY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Draw Options
    ctx.font = 'bold 35px ArialBlack, sans-serif';
    ctx.fillStyle = '#000000'; // Black text
    ctx.textAlign = 'left';

    const optY1 = separatorY + 70;
    const optY2 = optY1 + 80;
    const col1X = 80;
    const col2X = 560;

    // Helper to truncate text
    const truncateOption = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    };

    const maxChars = 25;

    ctx.fillText(`A. ${truncateOption(quizData.options.A, maxChars)}`, col1X, optY1);
    ctx.fillText(`B. ${truncateOption(quizData.options.B, maxChars)}`, col2X, optY1);
    ctx.fillText(`C. ${truncateOption(quizData.options.C, maxChars)}`, col1X, optY2);
    ctx.fillText(`D. ${truncateOption(quizData.options.D, maxChars)}`, col2X, optY2);

    return canvas.toBuffer('image/jpeg');
}

export async function generateJavascriptQuizLogic() {
    // 1. Generate Content
    let quizContent;
    let isUnique = false;
    let attempts = 0;
    const usedQuizzes = await readUsedQuizzes();

    while (!isUnique && attempts < 3) {
        quizContent = await generateQuizContent();
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
    const fileName = `javascript-images/javascript-quiz-${Date.now()}.jpg`;
    console.log('Starting Supabase upload for:', fileName);

    let uploadSuccess = false;
    let uploadError: unknown = null;
    let retryCount = 0;
    const maxRetries = 3;
    let publicUrl = '';

    while (!uploadSuccess && retryCount < maxRetries) {
        try {
            if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }

            const { error } = await supabase.storage
                .from('news-images')
                .upload(fileName, imageBuffer, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: true,
                });

            if (error) throw error;

            uploadSuccess = true;
        } catch (err) {
            console.error(`Upload attempt ${retryCount + 1} failed:`, err);
            uploadError = err;
            retryCount++;
        }
    }

    if (!uploadSuccess) {
        throw new Error(`Failed to upload image to Supabase: ${(uploadError as Error)?.message}`);
    }

    const { data: urlData } = supabase.storage
        .from('news-images')
        .getPublicUrl(fileName);

    publicUrl = urlData.publicUrl;

    return {
        success: true,
        imageUrl: publicUrl,
        caption: "JavaScript Question / Quiz; What is the output of the following JavaScript code, and why? Comment your answers below!",
        quizData: quizContent
    };
}

export async function POST() {
    try {
        const result = await generateJavascriptQuizLogic();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error generating JavaScript quiz:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
