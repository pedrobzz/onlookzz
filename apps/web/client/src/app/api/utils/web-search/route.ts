import { env } from '@/env';
import type { WebSearchResult } from '@onlook/models';
import Exa from 'exa-js';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const webSearchInput = z.object({
    query: z.string().min(2),
    allowed_domains: z.array(z.string()).optional(),
    blocked_domains: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const input = webSearchInput.parse(await request.json());
        if (!env.EXA_API_KEY) {
            throw new Error('EXA_API_KEY is not configured');
        }

        const exa = new Exa(env.EXA_API_KEY);
        const searchOptions: Record<string, unknown> = {
            type: 'auto',
            numResults: 10,
            contents: {
                text: true,
            },
        };

        if (input.allowed_domains && input.allowed_domains.length > 0) {
            searchOptions.includeDomains = input.allowed_domains;
        }

        if (input.blocked_domains && input.blocked_domains.length > 0) {
            searchOptions.excludeDomains = input.blocked_domains;
        }

        const result = await exa.searchAndContents(input.query, searchOptions);

        return NextResponse.json<WebSearchResult>({
            result: result.results.map((item) => ({
                title: item.title ?? '',
                url: item.url ?? '',
                text: item.text ?? '',
                publishedDate: item.publishedDate ?? null,
                author: item.author ?? null,
            })),
            error: null,
        });
    } catch (error) {
        console.error('Error searching web:', error);
        return NextResponse.json<WebSearchResult>(
            {
                result: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: error instanceof z.ZodError ? 400 : 200 },
        );
    }
}
