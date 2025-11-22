import { NextResponse } from 'next/server';
import { generateJavascriptQuizLogic } from '../../lib/js-quiz';

export const runtime = 'nodejs';

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
