export enum MessageContextType {
    FILE = 'file',
    HIGHLIGHT = 'highlight',
    IMAGE = 'image',
    ERROR = 'error',
    AGENT_RULE = 'agent_rule',
}

type BaseMessageContext = {
    type: MessageContextType;
    content: string;
    displayName: string;
};

export type FileMessageContext = BaseMessageContext & {
    type: MessageContextType.FILE;
    path: string;
    projectId: string;
};

export type HighlightMessageContext = BaseMessageContext & {
    type: MessageContextType.HIGHLIGHT;
    path: string;
    start: number;
    end: number;
    oid?: string;
    projectId: string;
};

export type ImageMessageContext = BaseMessageContext & {
    type: MessageContextType.IMAGE;
    mimeType: string;
    id?: string;
    source: 'external' | 'local';
    path?: string;
    projectId?: string;
};

export type ErrorMessageContext = BaseMessageContext & {
    type: MessageContextType.ERROR;
    projectId: string;
};

export type AgentRuleMessageContext = BaseMessageContext & {
    type: MessageContextType.AGENT_RULE;
    path: string;
};

export type MessageContext =
    | HighlightMessageContext
    | ImageMessageContext
    | ErrorMessageContext
    | AgentRuleMessageContext
    | FileMessageContext;
