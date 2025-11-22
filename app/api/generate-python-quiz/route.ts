import { NextResponse } from 'next/server';
import { generatePythonQuizLogic } from '../../lib/python-quiz';

export const runtime = 'nodejs';

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
