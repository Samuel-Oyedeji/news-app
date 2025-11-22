import { GoogleGenerativeAI } from '@google/generative-ai';
import { Redis } from '@upstash/redis';
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

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

const USED_QUIZ_KEY = 'used_go_quizzes';

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
    Generate a unique and tricky Go (Golang) quiz question.
    The question should be a short snippet of Go code (max 10 lines).
    Provide 4 options (A, B, C, D) where one is correct and three are plausible distractors.
    Focus on concepts like goroutines, channels, defer, slices, maps, interfaces, pointers, or struct embedding.
    
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
        
        // Validate the parsed content
        if (!parsed.code || typeof parsed.code !== 'string' || parsed.code.trim().length === 0) {
            throw new Error('Invalid or empty code in quiz response');
        }
        
        if (!parsed.options || typeof parsed.options !== 'object') {
            throw new Error('Invalid or missing options in quiz response');
        }
        
        // Validate each option exists and is a string
        const requiredOptions = ['A', 'B', 'C', 'D'];
        for (const opt of requiredOptions) {
            if (!parsed.options[opt] || typeof parsed.options[opt] !== 'string' || parsed.options[opt].trim().length === 0) {
                throw new Error(`Invalid or missing option ${opt} in quiz response`);
            }
        }
        
        if (!parsed.answer || !requiredOptions.includes(parsed.answer)) {
            throw new Error('Invalid or missing answer in quiz response');
        }
        
        return parsed;
    } catch (error) {
        if (retryCount < 3) {
            console.warn(`Quiz generation attempt ${retryCount + 1} failed, retrying...`, error);
            return generateQuizContent(retryCount + 1);
        }
        throw error;
    }
}

// Simple syntax highlighting helper for Go
function getSyntaxColor(word: string): string {
    const keywords = ['break', 'default', 'func', 'interface', 'select', 'case', 'defer', 'go', 'map', 'struct', 'chan', 'else', 'goto', 'package', 'switch', 'const', 'fallthrough', 'if', 'range', 'type', 'continue', 'for', 'import', 'return', 'var'];
    const builtins = ['append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len', 'make', 'new', 'panic', 'print', 'println', 'real', 'recover', 'main', 'fmt', 'Println', 'Printf', 'Sprintf'];
    const types = ['bool', 'byte', 'complex64', 'complex128', 'error', 'float32', 'float64', 'int', 'int8', 'int16', 'int32', 'int64', 'rune', 'string', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr'];
    const constants = ['true', 'false', 'iota', 'nil'];

    if (keywords.includes(word)) return '#ff79c6'; // Pink
    if (builtins.includes(word)) return '#8be9fd'; // Cyan
    if (types.includes(word)) return '#8be9fd'; // Cyan (types often same as builtins in simple themes)
    if (constants.includes(word)) return '#bd93f9'; // Purple
    if (!isNaN(Number(word))) return '#bd93f9'; // Purple (numbers)
    if (word.startsWith('"') || word.startsWith("'") || word.startsWith('`')) return '#f1fa8c'; // Yellow (strings)
    return '#f8f8f2'; // White (default)
}

async function generateQuizImage(quizData: { code: string; options: { A: string; B: string; C: string; D: string } }) {
    // Validate input data
    if (!quizData || !quizData.code || typeof quizData.code !== 'string') {
        throw new Error('Invalid quiz data: code is missing or invalid');
    }
    
    if (!quizData.options || typeof quizData.options !== 'object') {
        throw new Error('Invalid quiz data: options are missing or invalid');
    }
    
    // Ensure all options exist with fallback values
    const options = {
        A: quizData.options.A || 'Option A',
        B: quizData.options.B || 'Option B',
        C: quizData.options.C || 'Option C',
        D: quizData.options.D || 'Option D'
    };
    
    // Log for debugging
    console.log('Generating quiz image with:', {
        codeLength: quizData.code.length,
        codeLines: quizData.code.split('\n').length,
        options: Object.keys(options).map(k => `${k}: ${options[k as keyof typeof options].substring(0, 30)}...`)
    });
    
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#ffffff'; // White background
    ctx.fillRect(0, 0, width, height);

    // 1.5 Draw Go Logo Badge
    try {
        const logoPath = path.resolve(process.cwd(), 'public', 'go-logo.jpg');
        const logoImage = await loadImage(logoPath);

        ctx.save();
        ctx.globalAlpha = 1.0; // Full opacity
        // Position at top right
        const logoSize = 150;
        const padding = 40;
        const logoX = width - logoSize - padding;
        const logoY = padding;

        // Optional: Add a circular clip or shadow for "badge" look
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
        ctx.restore();
    } catch {
        console.warn('Failed to load go logo');
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

    // 2. Title "Go Quiz"
    ctx.font = 'bold 80px ArialBlack, sans-serif';
    ctx.fillStyle = '#00ADD8'; // Go Cyan
    ctx.textAlign = 'center';
    ctx.fillText('Go Quiz', width / 2, 130);

    // 3. Code Block Container
    const codeBoxX = 100;
    const codeBoxY = 200;
    const codeBoxW = width - 200;

    // Dynamic Height Calculation
    const lines = quizData.code.split('\n').filter(line => line.trim().length > 0); // Filter empty lines
    const lineHeight = 45;
    const paddingTop = 70;
    const paddingBottom = 70;
    const maxCodeLines = 8; // Limit code lines to prevent overflow
    const displayLines = lines.slice(0, maxCodeLines);
    const calculatedHeight = paddingTop + (displayLines.length * lineHeight) + paddingBottom;
    const codeBoxH = Math.max(calculatedHeight, 300); // Minimum height of 300
    const borderRadius = 20;
    
    // Ensure code box doesn't take too much space (leave room for options)
    const maxCodeBoxHeight = height - 400; // Leave 400px for title, separator, and options
    const finalCodeBoxH = Math.min(codeBoxH, maxCodeBoxHeight);

    ctx.fillStyle = '#1e1e3f'; // Dark Blue/Grey for code background
    ctx.beginPath();
    ctx.roundRect(codeBoxX, codeBoxY, codeBoxW, finalCodeBoxH, borderRadius);
    ctx.fill();

    // 4. Draw Code with basic syntax highlighting
    // Use a more reliable font stack that works on serverless environments
    ctx.font = '35px "Courier New", Courier, "Liberation Mono", "DejaVu Sans Mono", monospace';
    ctx.textAlign = 'left';
    // Ensure text baseline is set correctly
    ctx.textBaseline = 'top';

    let currentY = codeBoxY + paddingTop;
    const startX = codeBoxX + 40;
    const maxLineWidth = codeBoxW - 80; // Leave padding on both sides

    displayLines.forEach((line, index) => {
        // Truncate long lines to prevent overflow
        let displayLine = line;
        const metrics = ctx.measureText(displayLine);
        if (metrics.width > maxLineWidth) {
            // Truncate line to fit
            while (ctx.measureText(displayLine + '...').width > maxLineWidth && displayLine.length > 0) {
                displayLine = displayLine.slice(0, -1);
            }
            displayLine = displayLine + '...';
        }
        
        const words = displayLine.split(/(\s+|[(),:\[\]{}])/);
        let currentX = startX;

        words.forEach(word => {
            // Render all words including spaces - don't skip spaces
            if (word.length > 0) {
                // Get color for the word (trimmed for color lookup, but render the full word including spaces)
                const trimmedWord = word.trim();
                ctx.fillStyle = trimmedWord.length > 0 ? getSyntaxColor(trimmedWord) : '#f8f8f2'; // Default color for spaces
                
                // Always ensure we have a visible color
                if (!ctx.fillStyle || ctx.fillStyle === 'transparent') {
                    ctx.fillStyle = '#f8f8f2'; // Fallback to white/light color
                }
                
                ctx.fillText(word, currentX, currentY);
                currentX += ctx.measureText(word).width;
            }
        });
        currentY += lineHeight;
    });

    // 5. Options Separator
    const separatorY = codeBoxY + finalCodeBoxH + 50;
    
    // Ensure separator and options are within canvas bounds
    if (separatorY > height - 200) {
        console.warn('Code box too tall, adjusting layout');
        // Adjust separator position to fit
    }

    ctx.strokeStyle = '#00ADD8'; // Go Cyan
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
    
    // Ensure options are rendered within canvas bounds
    if (optY2 + 50 > height) {
        console.warn('Options would overflow canvas, adjusting positions');
        // Could adjust font size or positions here if needed
    }

    // Use validated options with fallbacks
    ctx.fillText(`A. ${truncateOption(options.A || 'Option A', maxChars)}`, col1X, optY1);
    ctx.fillText(`B. ${truncateOption(options.B || 'Option B', maxChars)}`, col2X, optY1);
    ctx.fillText(`C. ${truncateOption(options.C || 'Option C', maxChars)}`, col1X, optY2);
    ctx.fillText(`D. ${truncateOption(options.D || 'Option D', maxChars)}`, col2X, optY2);

    return canvas.toBuffer('image/jpeg');
}

export async function generateGoQuizLogic() {
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
    const fileName = `go-images/go-quiz-${Date.now()}.jpg`;
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
        caption: "Go (Golang) Question / Quiz; What is the output of the following Go code, and why? Comment your answers below!",
        quizData: quizContent
    };
}
