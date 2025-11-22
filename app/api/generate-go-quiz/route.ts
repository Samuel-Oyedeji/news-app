import { NextResponse } from 'next/server';
import { generateGoQuizLogic } from '../../lib/go-quiz';

export const runtime = 'nodejs';

export async function POST() {
    try {
        const result = await generateGoQuizLogic();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error generating Go quiz:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
