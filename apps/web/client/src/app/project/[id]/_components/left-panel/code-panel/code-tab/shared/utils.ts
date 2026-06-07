import type { EditorFile, TextEditorFile } from './types';

export async function hashContent(content: string | Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const data = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Check if file content differs from original
export async function isDirty(file: EditorFile): Promise<boolean> {
    if (file.type === 'binary') {
        return false; // Binary files are never considered dirty
    }

    if (file.type === 'text') {
        const textFile = file as TextEditorFile;
        const currentHash = await hashContent(textFile.content);
        return currentHash !== textFile.originalHash;
    }

    return false;
}
