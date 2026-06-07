import { applyCodeChange } from '@onlook/ai';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const applyDiffInput = z.object({
    originalCode: z.string(),
    updateSnippet: z.string(),
    instruction: z.string(),
    metadata: z
        .object({
            projectId: z.string().optional(),
            conversationId: z.string().optional(),
        })
        .optional(),
});

type ApplyDiffResult = {
    result: string | null;
    error: string | null;
};

export async function POST(request: NextRequest) {
    try {
        const input = applyDiffInput.parse(await request.json());
        const result = await applyCodeChange(
            input.originalCode,
            input.updateSnippet,
            input.instruction,
            input.metadata,
        );

        if (!result) {
            throw new Error('Failed to apply code change. Please try again.');
        }

        return NextResponse.json<ApplyDiffResult>({
            result,
            error: null,
        });
    } catch (error) {
        console.error('Failed to apply code change', error);
        return NextResponse.json<ApplyDiffResult>(
            {
                result: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: error instanceof z.ZodError ? 400 : 200 },
        );
    }
}
