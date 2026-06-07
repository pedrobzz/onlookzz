import { convexApi } from "@/convex/api";
import { localConvexClient } from "@/convex/provider";
import { fromConvexMessage, type ConvexMessageRow } from "@/utils/chat/convex-message";
import type { ChatMessage, WebSearchResult } from "@onlook/models";
import { makeAutoObservable } from "mobx";
import type { EditorEngine } from "../engine";

type ApplyDiffResult = {
    result: string | null;
    error: string | null;
};

type ScrapeUrlResult = {
    result: string | null;
    error: string | null;
};

async function postJson<Input, Output>(url: string, input: Input): Promise<Output> {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(input),
    });
    const body = await response.json() as Output & { error?: string | null };

    if (!response.ok) {
        throw new Error(body.error ?? `Request failed with status ${response.status}`);
    }

    return body;
}

export class ApiManager {
    constructor(private editorEngine: EditorEngine) {
        makeAutoObservable(this);
    }

    async webSearch(input: {
        query: string,
        allowed_domains: string[] | undefined,
        blocked_domains: string[] | undefined
    }): Promise<WebSearchResult> {
        return postJson('/api/utils/web-search', input);
    }

    async applyDiff(input: {
        originalCode: string,
        updateSnippet: string,
        instruction: string,
        metadata: {
            projectId: string;
            conversationId: string | undefined;
        }
    }): Promise<ApplyDiffResult> {
        return postJson('/api/utils/apply-diff', input);
    }

    async scrapeUrl(input: {
        url: string;
        formats?: ("json" | "markdown" | "html" | "branding")[] | undefined;
        onlyMainContent?: boolean | undefined;
        includeTags?: string[] | undefined;
        excludeTags?: string[] | undefined;
        waitFor?: number | undefined;
    }): Promise<ScrapeUrlResult> {
        return postJson('/api/utils/scrape-url', input);
    }

    async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
        const rows = await localConvexClient.query(convexApi.messages.list, { conversationId }) as ConvexMessageRow[];
        return rows.map(fromConvexMessage);
    }
}
