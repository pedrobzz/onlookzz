import normalizeUrl from 'normalize-url';

/**
 * Creates a secure URL from a given URL string
 * @param url - The URL string to create a secure URL from
 * @returns The secure URL string
 */
export const createSecureUrl = (url: string | undefined | null): string => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return '';
    }

    try {
        const normalizedUrl = normalizeUrl(url, {
            forceHttps: true,
            stripAuthentication: true,
            removeTrailingSlash: true,
            stripWWW: false,
            defaultProtocol: 'https',
        });

        // For single-word strings like 'test', normalize-url returns 'https://test',
        // which is not what we want. A valid domain should have at least one dot.
        const { protocol, hostname, pathname } = new URL(normalizedUrl);
        if (!hostname.includes('.') && pathname === '/') {
            return '';
        }

        if (protocol !== 'https:' && protocol !== 'http:') {
            const urlObject = new URL(normalizedUrl);
            urlObject.protocol = 'https:';
            return urlObject.toString().replace(/\/$/, '');
        }

        return normalizedUrl;
    } catch (error) {
        // Invalid URL format
        console.error(
            `Invalid URL format. Input: "${url}", Error: ${error instanceof Error ? error.message : error}`,
        );
        return '';
    }
};
