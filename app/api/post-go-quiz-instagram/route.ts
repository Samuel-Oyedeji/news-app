import { NextResponse } from 'next/server';
import { generateGoQuizLogic } from '../generate-go-quiz/route';
import { postToInstagram } from '@/lib/instagram';

export const runtime = 'nodejs';

export async function POST() {
    try {
        // 1. Generate the quiz
        console.log('Generating Go quiz...');
        const quizResult = await generateGoQuizLogic();

        if (!quizResult.success || !quizResult.imageUrl) {
            throw new Error('Failed to generate quiz content');
        }

        // 2. Post to Instagram
        console.log('Posting to Instagram...');
        const instagramResult = await postToInstagram({
            image_url: quizResult.imageUrl,
            caption: quizResult.caption
        });

        if (!instagramResult.success) {
            throw new Error(instagramResult.error || 'Failed to post to Instagram');
        }

        return NextResponse.json({
            success: true,
            message: 'Go Quiz generated and posted to Instagram successfully!',
            quizData: quizResult.quizData,
            imageUrl: quizResult.imageUrl,
            instagramPostId: instagramResult.post_id
        });

    } catch (error) {
        console.error('Error in post-go-quiz-instagram:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
