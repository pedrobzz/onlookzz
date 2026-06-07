export const inferPageFromUrl = (url: string): { name: string; path: string } => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        if (pathname === '/' || pathname === '') {
            return { name: 'Home', path: '/' };
        }

        const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        const pageName = lastSegment ? lastSegment.replace(/[-_]/g, ' ') : 'page';

        return { name: pageName, path: pathname };
    } catch (error) {
        console.error('Failed to parse URL:', error);
        return { name: 'Unknown Page', path: '/' };
    }
};
