import {
    MessageContextType,
    type MessageContext,
    type FileMessageContext,
    type HighlightMessageContext,
    type ErrorMessageContext,
    type ImageMessageContext,
    type AgentRuleMessageContext,
} from '@onlook/models';
import { describe, expect, test } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import {
    getContextPrompt,
    getContextLabel,
    getContextClass,
    FileContext,
    HighlightContext,
    ErrorContext,
    ImageContext,
    AgentRuleContext,
} from '../../src/contexts';

describe('Context Index', () => {
    const createMockContexts = () => ({
        file: {
            type: MessageContextType.FILE,
            path: 'src/test.ts',
            content: 'console.log("test");',
            displayName: 'test.ts',
            projectId: 'project-123',
        } as FileMessageContext,
        
        highlight: {
            type: MessageContextType.HIGHLIGHT,
            path: 'src/test.ts',
            start: 1,
            end: 5,
            content: 'console.log("test");',
            displayName: 'test.ts',
            projectId: 'project-123',
        } as HighlightMessageContext,
        
        error: {
            type: MessageContextType.ERROR,
            content: 'TypeError: Cannot read property',
            displayName: 'Runtime Error',
            projectId: 'project-123',
        } as ErrorMessageContext,
        
        image: {
            type: MessageContextType.IMAGE,
            content: 'data:image/png;base64,test-data',
            displayName: 'screenshot.png',
            mimeType: 'image/png',
            id: uuidv4(),
        } as ImageMessageContext,
        
        agentRule: {
            type: MessageContextType.AGENT_RULE,
            content: '# Project Rules\nUse TypeScript',
            displayName: 'CLAUDE.md',
            path: '/project/CLAUDE.md',
        } as AgentRuleMessageContext,
    });

    describe('getContextPrompt', () => {
        test('should route to correct context class for FILE type', () => {
            const contexts = createMockContexts();
            const prompt = getContextPrompt(contexts.file);

            expect(prompt).toContain('<path>src/test.ts</path>');
            expect(prompt).toContain('<project>id: "project-123"</project>');
            expect(prompt).toContain('```ts');
            expect(prompt).toContain('console.log("test");');
        });

        test('should route to correct context class for HIGHLIGHT type', () => {
            const contexts = createMockContexts();
            const prompt = getContextPrompt(contexts.highlight);

            expect(prompt).toContain('<path>src/test.ts#L1:L5</path>');
            expect(prompt).toContain('<project>id: "project-123"</project>');
            expect(prompt).toContain('```');
            expect(prompt).toContain('console.log("test");');
        });

        test('should route to correct context class for ERROR type', () => {
            const contexts = createMockContexts();
            const prompt = getContextPrompt(contexts.error);

            expect(prompt).toContain('<project>id: "project-123"</project>');
            expect(prompt).toContain('<error>TypeError: Cannot read property</error>');
        });

        test('should route to correct context class for IMAGE type', () => {
            const contexts = createMockContexts();
            const prompt = getContextPrompt(contexts.image);

            expect(prompt).toBe('[Image: image/png]');
        });

        test('should route to correct context class for AGENT_RULE type', () => {
            const contexts = createMockContexts();
            const prompt = getContextPrompt(contexts.agentRule);

            expect(prompt).toContain('/project/CLAUDE.md');
            expect(prompt).toContain('# Project Rules');
            expect(prompt).toContain('Use TypeScript');
        });

        test('should handle mixed context types in sequence', () => {
            const contexts = createMockContexts();
            
            const filePrompt = getContextPrompt(contexts.file);
            const highlightPrompt = getContextPrompt(contexts.highlight);
            const errorPrompt = getContextPrompt(contexts.error);
            
            expect(filePrompt).toContain('```ts');
            expect(highlightPrompt).toContain('#L1:L5');
            expect(errorPrompt).toContain('<error>');
        });

        test('should produce same result as direct context class usage', () => {
            const contexts = createMockContexts();
            
            // Compare generic function with direct class usage
            expect(getContextPrompt(contexts.file))
                .toBe(FileContext.getPrompt(contexts.file));
            expect(getContextPrompt(contexts.highlight))
                .toBe(HighlightContext.getPrompt(contexts.highlight));
            expect(getContextPrompt(contexts.error))
                .toBe(ErrorContext.getPrompt(contexts.error));
            expect(getContextPrompt(contexts.image))
                .toBe(ImageContext.getPrompt(contexts.image));
            expect(getContextPrompt(contexts.agentRule))
                .toBe(AgentRuleContext.getPrompt(contexts.agentRule));
        });
    });

    describe('getContextLabel', () => {
        test('should route to correct context class for FILE type', () => {
            const contexts = createMockContexts();
            const label = getContextLabel(contexts.file);

            expect(label).toBe('test.ts');
        });

        test('should route to correct context class for HIGHLIGHT type', () => {
            const contexts = createMockContexts();
            const label = getContextLabel(contexts.highlight);

            expect(label).toBe('test.ts');
        });

        test('should route to correct context class for ERROR type', () => {
            const contexts = createMockContexts();
            const label = getContextLabel(contexts.error);

            expect(label).toBe('Runtime Error');
        });

        test('should route to correct context class for IMAGE type', () => {
            const contexts = createMockContexts();
            const label = getContextLabel(contexts.image);

            expect(label).toBe('screenshot.png');
        });

        test('should route to correct context class for AGENT_RULE type', () => {
            const contexts = createMockContexts();
            const label = getContextLabel(contexts.agentRule);

            expect(label).toBe('CLAUDE.md');
        });

        test('should produce same result as direct context class usage', () => {
            const contexts = createMockContexts();
            
            // Compare generic function with direct class usage
            expect(getContextLabel(contexts.file))
                .toBe(FileContext.getLabel(contexts.file));
            expect(getContextLabel(contexts.highlight))
                .toBe(HighlightContext.getLabel(contexts.highlight));
            expect(getContextLabel(contexts.error))
                .toBe(ErrorContext.getLabel(contexts.error));
            expect(getContextLabel(contexts.image))
                .toBe(ImageContext.getLabel(contexts.image));
            expect(getContextLabel(contexts.agentRule))
                .toBe(AgentRuleContext.getLabel(contexts.agentRule));
        });

        test('should handle fallback scenarios', () => {
            const contexts = createMockContexts();
            
            // Test with empty displayNames
            const fileWithoutLabel = { ...contexts.file, displayName: '' };
            const errorWithoutLabel = { ...contexts.error, displayName: '' };
            const imageWithoutLabel = { ...contexts.image, displayName: '' };
            
            expect(getContextLabel(fileWithoutLabel)).toBe('test.ts');
            expect(getContextLabel(errorWithoutLabel)).toBe('Error');
            expect(getContextLabel(imageWithoutLabel)).toBe('Image');
        });
    });

    describe('getContextClass', () => {
        test('should return FileContext for FILE type', () => {
            const contextClass = getContextClass(MessageContextType.FILE);
            expect(contextClass).toBe(FileContext);
        });

        test('should return HighlightContext for HIGHLIGHT type', () => {
            const contextClass = getContextClass(MessageContextType.HIGHLIGHT);
            expect(contextClass).toBe(HighlightContext);
        });

        test('should return ErrorContext for ERROR type', () => {
            const contextClass = getContextClass(MessageContextType.ERROR);
            expect(contextClass).toBe(ErrorContext);
        });

        test('should return ImageContext for IMAGE type', () => {
            const contextClass = getContextClass(MessageContextType.IMAGE);
            expect(contextClass).toBe(ImageContext);
        });

        test('should return AgentRuleContext for AGENT_RULE type', () => {
            const contextClass = getContextClass(MessageContextType.AGENT_RULE);
            expect(contextClass).toBe(AgentRuleContext);
        });

        test('should return classes with correct static properties', () => {
            const fileClass = getContextClass(MessageContextType.FILE);
            const highlightClass = getContextClass(MessageContextType.HIGHLIGHT);
            const errorClass = getContextClass(MessageContextType.ERROR);
            
            expect(fileClass.contextType).toBe(MessageContextType.FILE);
            expect(fileClass.displayName).toBe('File');
            expect(fileClass.icon).toBeDefined();
            
            expect(highlightClass.contextType).toBe(MessageContextType.HIGHLIGHT);
            expect(highlightClass.displayName).toBe('Code Selection');
            expect(highlightClass.icon).toBeDefined();
            
            expect(errorClass.contextType).toBe(MessageContextType.ERROR);
            expect(errorClass.displayName).toBe('Error');
            expect(errorClass.icon).toBeDefined();
        });
    });

    describe('context class exports', () => {
        test('should export all context classes', () => {
            expect(FileContext).toBeDefined();
            expect(HighlightContext).toBeDefined();
            expect(ErrorContext).toBeDefined();
            expect(ImageContext).toBeDefined();
            expect(AgentRuleContext).toBeDefined();
        });

        test('should have correct context types on exported classes', () => {
            expect(FileContext.contextType).toBe(MessageContextType.FILE);
            expect(HighlightContext.contextType).toBe(MessageContextType.HIGHLIGHT);
            expect(ErrorContext.contextType).toBe(MessageContextType.ERROR);
            expect(ImageContext.contextType).toBe(MessageContextType.IMAGE);
            expect(AgentRuleContext.contextType).toBe(MessageContextType.AGENT_RULE);
        });
    });

    describe('integration scenarios', () => {
        test('should handle context type switching in loop', () => {
            const contexts = createMockContexts();
            const contextArray = [
                contexts.file,
                contexts.highlight,
                contexts.error,
                contexts.image,
                contexts.agentRule,
            ];

            const prompts = contextArray.map(context => getContextPrompt(context));
            const labels = contextArray.map(context => getContextLabel(context));

            expect(prompts).toHaveLength(5);
            expect(labels).toHaveLength(5);
            
            expect(prompts[0]).toContain('```ts');
            expect(prompts[1]).toContain('#L1:L5');
            expect(prompts[2]).toContain('<error>');
            expect(prompts[3]).toBe('[Image: image/png]');
            expect(prompts[4]).toContain('# Project Rules');
        });

        test('should maintain context type consistency', () => {
            const contexts = createMockContexts();
            
            Object.entries(contexts).forEach(([key, context]) => {
                const contextClass = getContextClass(context.type);
                const genericPrompt = getContextPrompt(context);
                const directPrompt = contextClass.getPrompt(context as any);
                
                expect(genericPrompt).toBe(directPrompt);
            });
        });

        test('should handle malformed contexts gracefully', () => {
            // Test with minimal context objects
            const minimalFile = {
                type: MessageContextType.FILE,
                path: 'test.ts',
                content: '',
                displayName: 'test.ts',
                projectId: '',
            } as FileMessageContext;

            expect(() => getContextPrompt(minimalFile)).not.toThrow();
            expect(() => getContextLabel(minimalFile)).not.toThrow();
            expect(() => getContextClass(minimalFile.type)).not.toThrow();
        });

        test('should work with actual message context union type', () => {
            const contexts = createMockContexts();
            
            // Test that the functions work with the union type
            const messageContexts: MessageContext[] = [
                contexts.file,
                contexts.highlight,
                contexts.error,
                contexts.image,
                contexts.agentRule,
            ];

            messageContexts.forEach(context => {
                expect(() => getContextPrompt(context)).not.toThrow();
                expect(() => getContextLabel(context)).not.toThrow();
                expect(() => getContextClass(context.type)).not.toThrow();
            });
        });
    });

    describe('edge cases', () => {
        test('should handle context with missing optional properties', () => {
            const minimalContexts = {
                file: {
                    type: MessageContextType.FILE,
                    path: 'test.js',
                    content: 'test',
                    displayName: '',
                    projectId: '',
                } as FileMessageContext,
                
                error: {
                    type: MessageContextType.ERROR,
                    content: 'Error message',
                    displayName: '',
                    projectId: '',
                } as ErrorMessageContext,
            };

            expect(getContextPrompt(minimalContexts.file)).toContain('test.js');
            expect(getContextLabel(minimalContexts.file)).toBe('test.js');
            
            expect(getContextPrompt(minimalContexts.error)).toContain('Error message');
            expect(getContextLabel(minimalContexts.error)).toBe('Error');
        });

        test('should handle context switching performance', () => {
            const contexts = createMockContexts();
            const contextTypes = Object.values(MessageContextType);
            
            // Test multiple rapid context type switches
            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                contextTypes.forEach(type => {
                    getContextClass(type);
                });
            }
            const end = Date.now();
            
            // Should complete quickly (arbitrary threshold)
            expect(end - start).toBeLessThan(100);
        });
    });
});
