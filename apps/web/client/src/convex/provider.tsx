'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://127.0.0.1:3210';
export const localConvexClient = new ConvexReactClient(convexUrl);

export function LocalConvexProvider({ children }: { children: React.ReactNode }) {
    return <ConvexProvider client={localConvexClient}>{children}</ConvexProvider>;
}
