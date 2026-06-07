import { BashEditTool, BashReadTool, CheckErrorsTool, FuzzyEditFileTool, GlobTool, GrepTool, ListFilesTool, OnlookInstructionsTool, ReadFileTool, ReadStyleGuideTool, SandboxTool, ScrapeUrlTool, SearchReplaceEditTool, SearchReplaceMultiEditFileTool, TerminalCommandTool, TypecheckTool, WebSearchTool, WriteFileTool } from "../tools";

export const allTools = [
    ListFilesTool,
    ReadFileTool,
    BashReadTool,
    OnlookInstructionsTool,
    ReadStyleGuideTool,
    ScrapeUrlTool,
    WebSearchTool,
    GlobTool,
    GrepTool,
    TypecheckTool,
    CheckErrorsTool,
    SearchReplaceEditTool,
    SearchReplaceMultiEditFileTool,
    FuzzyEditFileTool,
    WriteFileTool,
    BashEditTool,
    SandboxTool,
    TerminalCommandTool,
];

export const readOnlyRootTools = [
    ListFilesTool,
    ReadFileTool,
    BashReadTool,
    OnlookInstructionsTool,
    ReadStyleGuideTool,
    ScrapeUrlTool,
    WebSearchTool,
    GlobTool,
    GrepTool,
    TypecheckTool,
    CheckErrorsTool,
]
const editOnlyRootTools = [
    SearchReplaceEditTool,
    SearchReplaceMultiEditFileTool,
    FuzzyEditFileTool,
    WriteFileTool,
    BashEditTool,
    SandboxTool,
    TerminalCommandTool,
]

export const rootTools = [...readOnlyRootTools, ...editOnlyRootTools];

export const userTools = [
    ListFilesTool,
]
