import '@/styles/globals.css';
import '@onlook/ui/globals.css';

import { LocalConvexProvider } from '@/convex/provider';
import { Toaster } from '@onlook/ui/sonner';
import { type Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Inter } from 'next/font/google';
import { ThemeProvider } from './_components/theme';

export const metadata: Metadata = {
    title: 'Onlook',
    description: 'Local visual editor for React projects.',
    icons: [{ rel: 'icon', url: '/favicon.ico' }],
};

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();

    return (
        <html lang={locale} className={inter.variable} suppressHydrationWarning>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body>
                <ThemeProvider
                    attribute="class"
                    forcedTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <LocalConvexProvider>
                        <NextIntlClientProvider>
                            {children}
                            <Toaster />
                        </NextIntlClientProvider>
                    </LocalConvexProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
