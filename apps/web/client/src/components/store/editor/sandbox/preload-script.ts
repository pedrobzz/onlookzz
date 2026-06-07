import { NEXT_JS_FILE_EXTENSIONS, ONLOOK_DEV_PRELOAD_SCRIPT_PATH, ONLOOK_DEV_PRELOAD_SCRIPT_SRC } from '@onlook/constants';
import type { FileEntry } from '@onlook/file-system';
import { RouterType, type RouterConfig } from '@onlook/models';
import { getAstFromContent, getContentFromAst, injectPreloadScript } from '@onlook/parser';
import { isRootLayoutFile, normalizePath } from '@onlook/utility';
import path from 'path';

interface ProjectFiles {
    readDir(path: string): Promise<FileEntry[]>;
    readFile(path: string): Promise<string | Uint8Array>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;
}

export async function copyPreloadScriptToPublic(projectFiles: ProjectFiles, routerConfig: RouterConfig): Promise<void> {
    try {
        const scriptResponse = await fetch(ONLOOK_DEV_PRELOAD_SCRIPT_SRC);
        await projectFiles.writeFile(ONLOOK_DEV_PRELOAD_SCRIPT_PATH, await scriptResponse.text());

        await injectPreloadScriptIntoLayout(projectFiles, routerConfig);
    } catch (error) {
        console.error('[PreloadScript] Failed to copy preload script:', error);
    }
}

export async function injectPreloadScriptIntoLayout(projectFiles: ProjectFiles, routerConfig: RouterConfig): Promise<void> {
    if (!routerConfig) {
        throw new Error('Could not detect router type for script injection. This is required for iframe communication.');
    }

    const entries = await projectFiles.readDir(routerConfig.basePath);
    const [layoutFile] = entries.filter(file =>
        !file.isDirectory && isRootLayoutFile(`${routerConfig.basePath}/${file.name}`, routerConfig.type)
    );

    if (!layoutFile) {
        throw new Error(`No layout files found in ${routerConfig.basePath}`);
    }

    const layoutPath = `${routerConfig.basePath}/${layoutFile.name}`;

    const content = await projectFiles.readFile(layoutPath);
    if (typeof content !== 'string') {
        throw new Error(`Layout file ${layoutPath} is not a text file`);
    }

    const ast = getAstFromContent(content);
    if (!ast) {
        throw new Error(`Failed to parse layout file: ${layoutPath}`);
    }

    injectPreloadScript(ast);
    const modifiedContent = await getContentFromAst(ast, content);

    await projectFiles.writeFile(layoutPath, modifiedContent);
}

export async function getLayoutPath(routerConfig: RouterConfig, fileExists: (path: string) => Promise<boolean>): Promise<string | null> {
    if (!routerConfig) {
        console.log('Could not detect Next.js router type');
        return null;
    }

    let layoutFileName: string;

    if (routerConfig.type === RouterType.PAGES) {
        layoutFileName = '_app';
    } else {
        layoutFileName = 'layout';
    }

    for (const extension of NEXT_JS_FILE_EXTENSIONS) {
        const layoutPath = path.join(routerConfig.basePath, `${layoutFileName}${extension}`);
        if (await fileExists(layoutPath)) {
            return normalizePath(layoutPath);
        }
    }

    console.log('Could not find layout file');
    return null;
}
