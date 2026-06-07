'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useState } from 'react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://127.0.0.1:3210';

export function LocalConvexProvider({ children }: { children: React.ReactNode }) {
    const [client] = useState(() => new ConvexReactClient(convexUrl));
    return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
