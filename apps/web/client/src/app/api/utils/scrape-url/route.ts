import { env } from '@/env';
import FirecrawlApp from '@mendable/firecrawl-js';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const scrapeUrlInput = z.object({
    url: z.string().url(),
    formats: z.array(z.enum(['markdown', 'html', 'json', 'branding'])).default(['markdown']),
    onlyMainContent: z.boolean().default(true),
    includeTags: z.array(z.string()).optional(),
    excludeTags: z.array(z.string()).optional(),
    waitFor: z.number().min(0).optional(),
});

type ScrapeUrlResult = {
    result: string | null;
    error: string | null;
};

export async function POST(request: NextRequest) {
    try {
        const input = scrapeUrlInput.parse(await request.json());
        if (!env.FIRECRAWL_API_KEY) {
            throw new Error('FIRECRAWL_API_KEY is not configured');
        }

        const app = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
        const result = await app.scrapeUrl(input.url, {
            formats: input.formats as unknown as NonNullable<Parameters<FirecrawlApp['scrapeUrl']>[1]>['formats'],
            onlyMainContent: input.onlyMainContent,
            ...(input.includeTags && { includeTags: input.includeTags }),
            ...(input.excludeTags && { excludeTags: input.excludeTags }),
            ...(input.waitFor !== undefined && { waitFor: input.waitFor }),
        });

        if (!result.success) {
            throw new Error(`Failed to scrape URL: ${result.error || 'Unknown error'}`);
        }

        const hasBranding = input.formats.includes('branding');
        const hasContentFormats = input.formats.some((format) =>
            ['markdown', 'html', 'json'].includes(format),
        );
        const resultWithBranding = result as typeof result & { branding?: unknown };
        const brandingData =
            hasBranding && resultWithBranding.branding
                ? JSON.stringify(resultWithBranding.branding, null, 2)
                : null;
        const content = result.markdown ?? result.html ?? JSON.stringify(result.json, null, 2);

        if (hasBranding && hasContentFormats) {
            if (!content && !brandingData) {
                throw new Error('No content or branding data was extracted from the URL');
            }

            const parts: string[] = [];
            if (content) {
                parts.push(content);
            }
            if (brandingData) {
                if (content) {
                    parts.push('\n\n=== Brand Identity ===\n');
                    parts.push('The following brand identity information was extracted from the website:\n');
                }
                parts.push(brandingData);
            }

            return NextResponse.json<ScrapeUrlResult>({
                result: parts.join('\n'),
                error: null,
            });
        }

        if (hasBranding && !hasContentFormats) {
            if (!brandingData) {
                throw new Error('No branding data was extracted from the URL');
            }

            return NextResponse.json<ScrapeUrlResult>({
                result: brandingData,
                error: null,
            });
        }

        if (!content) {
            throw new Error('No content was scraped from the URL');
        }

        return NextResponse.json<ScrapeUrlResult>({
            result: content,
            error: null,
        });
    } catch (error) {
        console.error('Error scraping URL:', error);
        return NextResponse.json<ScrapeUrlResult>(
            {
                result: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: error instanceof z.ZodError ? 400 : 200 },
        );
    }
}
