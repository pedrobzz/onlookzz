import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
    server: {
        NODE_ENV: z.enum(['development', 'test', 'production']),
        MORPH_API_KEY: z.string().optional(),
        RELACE_API_KEY: z.string().optional(),
        FIRECRAWL_API_KEY: z.string().optional(),
        EXA_API_KEY: z.string().optional(),
    },
    client: {
        NEXT_PUBLIC_CONVEX_URL: z.string().default('http://127.0.0.1:3210'),
    },
    runtimeEnv: {
        NODE_ENV: process.env.NODE_ENV,
        MORPH_API_KEY: process.env.MORPH_API_KEY,
        RELACE_API_KEY: process.env.RELACE_API_KEY,
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
        EXA_API_KEY: process.env.EXA_API_KEY,
        NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    },
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,
    emptyStringAsUndefined: true,
});
