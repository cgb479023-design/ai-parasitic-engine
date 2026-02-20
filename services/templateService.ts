/**
 * Template Service
 * 
 * Provides template management for video titles, descriptions, and tags.
 * Allows users to save and reuse common patterns.
 * 
 * @module services/templateService
 * @version 1.0.0
 * @date 2026-01-03
 */

/**
 * Template types
 */
export type TemplateType = 'title' | 'description' | 'tags' | 'promptBlock' | 'comment';

/**
 * Template variable
 */
export interface TemplateVariable {
    name: string;
    description: string;
    defaultValue?: string;
}

/**
 * Template definition
 */
export interface Template {
    id: string;
    name: string;
    type: TemplateType;
    content: string;
    variables: TemplateVariable[];
    category?: string;
    createdAt: Date;
    updatedAt: Date;
    usageCount: number;
}

/**
 * Storage key
 */
const STORAGE_KEY = 'ypp_templates';

/**
 * Load templates from localStorage
 */
export function loadTemplates(): Template[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const templates = JSON.parse(saved);
            return templates.map((t: any) => ({
                ...t,
                createdAt: new Date(t.createdAt),
                updatedAt: new Date(t.updatedAt)
            }));
        }
    } catch (e) {
        console.error('❌ [Templates] Failed to load:', e);
    }
    return getDefaultTemplates();
}

/**
 * Save templates to localStorage
 */
export function saveTemplates(templates: Template[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
        console.error('❌ [Templates] Failed to save:', e);
    }
}

/**
 * Generate unique ID
 */
function generateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new template
 */
export function createTemplate(
    name: string,
    type: TemplateType,
    content: string,
    options: {
        variables?: TemplateVariable[];
        category?: string;
    } = {}
): Template {
    const template: Template = {
        id: generateId(),
        name,
        type,
        content,
        variables: options.variables || extractVariables(content),
        category: options.category,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
    };

    const templates = loadTemplates();
    templates.push(template);
    saveTemplates(templates);

    return template;
}

/**
 * Update a template
 */
export function updateTemplate(id: string, updates: Partial<Template>): Template | null {
    const templates = loadTemplates();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) return null;

    templates[index] = {
        ...templates[index],
        ...updates,
        updatedAt: new Date()
    };

    saveTemplates(templates);
    return templates[index];
}

/**
 * Delete a template
 */
export function deleteTemplate(id: string): boolean {
    const templates = loadTemplates();
    const filtered = templates.filter(t => t.id !== id);

    if (filtered.length === templates.length) return false;

    saveTemplates(filtered);
    return true;
}

/**
 * Get template by ID
 */
export function getTemplate(id: string): Template | null {
    const templates = loadTemplates();
    return templates.find(t => t.id === id) || null;
}

/**
 * Get templates by type
 */
export function getTemplatesByType(type: TemplateType): Template[] {
    const templates = loadTemplates();
    return templates.filter(t => t.type === type);
}

/**
 * Extract variables from template content
 * Variables are in format: {{variableName}}
 */
export function extractVariables(content: string): TemplateVariable[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: TemplateVariable[] = [];
    const seen = new Set<string>();

    let match;
    while ((match = regex.exec(content)) !== null) {
        const name = match[1];
        if (!seen.has(name)) {
            seen.add(name);
            variables.push({
                name,
                description: `Value for ${name}`,
                defaultValue: ''
            });
        }
    }

    return variables;
}

/**
 * Apply template with variables
 */
export function applyTemplate(
    template: Template,
    values: Record<string, string>
): string {
    let result = template.content;

    for (const variable of template.variables) {
        const value = values[variable.name] || variable.defaultValue || '';
        const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
        result = result.replace(regex, value);
    }

    // Increment usage count
    updateTemplate(template.id, { usageCount: template.usageCount + 1 });

    return result;
}

/**
 * Default templates
 */
export function getDefaultTemplates(): Template[] {
    const now = new Date();

    return [
        // Title templates
        {
            id: 'default_title_1',
            name: 'Viral Pet Title',
            type: 'title' as TemplateType,
            content: '{{animal}} Does {{action}}—{{reaction}}! 🐱',
            variables: [
                { name: 'animal', description: 'Animal type', defaultValue: 'Cat' },
                { name: 'action', description: 'What the animal does', defaultValue: 'Something Unexpected' },
                { name: 'reaction', description: 'Human reaction', defaultValue: 'INSTANT PANIC' }
            ],
            category: 'Pets',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        },
        {
            id: 'default_title_2',
            name: 'Fail Compilation Title',
            type: 'title' as TemplateType,
            content: '{{subject}} Had OTHER Plans—This is NOT fine! 😂',
            variables: [
                { name: 'subject', description: 'Subject of the fail', defaultValue: 'Shopping Cart' }
            ],
            category: 'Fails',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        },

        // Description templates
        {
            id: 'default_desc_1',
            name: 'Standard Shorts Description',
            type: 'description' as TemplateType,
            content: '{{hook}}\n\n{{callToAction}}\n\n#Shorts #{{tag1}} #{{tag2}} #{{tag3}}',
            variables: [
                { name: 'hook', description: 'Opening hook', defaultValue: 'You won\'t believe what happens next!' },
                { name: 'callToAction', description: 'Call to action', defaultValue: 'Follow for more!' },
                { name: 'tag1', description: 'Hashtag 1', defaultValue: 'Viral' },
                { name: 'tag2', description: 'Hashtag 2', defaultValue: 'Funny' },
                { name: 'tag3', description: 'Hashtag 3', defaultValue: 'Trending' }
            ],
            category: 'General',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        },

        // Comment templates
        {
            id: 'default_comment_1',
            name: 'Engagement Question',
            type: 'comment' as TemplateType,
            content: '{{question}} 👇\n\n(Pin this comment if you agree!)',
            variables: [
                { name: 'question', description: 'Engagement question', defaultValue: 'Did anyone else notice this?' }
            ],
            category: 'Engagement',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        },
        {
            id: 'default_comment_2',
            name: 'Timestamp Teaser',
            type: 'comment' as TemplateType,
            content: 'Wait for {{timestamp}}... {{teaser}} 😱',
            variables: [
                { name: 'timestamp', description: 'Time in video', defaultValue: '0:04' },
                { name: 'teaser', description: 'Teaser text', defaultValue: 'you\'ll see it' }
            ],
            category: 'Engagement',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        },

        // Tags templates
        {
            id: 'default_tags_1',
            name: 'Pet Video Tags',
            type: 'tags' as TemplateType,
            content: 'cat,cats,funny cats,cat videos,cute cats,pet,pets,funny pets,viral,shorts,{{customTag}}',
            variables: [
                { name: 'customTag', description: 'Custom tag', defaultValue: 'catsoftiktok' }
            ],
            category: 'Pets',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        },
        {
            id: 'default_tags_2',
            name: 'Fail Video Tags',
            type: 'tags' as TemplateType,
            content: 'fail,fails,funny fails,epic fail,fail compilation,funny,comedy,viral,shorts,{{customTag}}',
            variables: [
                { name: 'customTag', description: 'Custom tag', defaultValue: 'instantregret' }
            ],
            category: 'Fails',
            createdAt: now,
            updatedAt: now,
            usageCount: 0
        }
    ];
}

/**
 * Search templates
 */
export function searchTemplates(query: string): Template[] {
    const templates = loadTemplates();
    const lowerQuery = query.toLowerCase();

    return templates.filter(t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.content.toLowerCase().includes(lowerQuery) ||
        t.category?.toLowerCase().includes(lowerQuery)
    );
}

/**
 * Get most used templates
 */
export function getMostUsedTemplates(limit: number = 5): Template[] {
    const templates = loadTemplates();
    return templates
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
}

/**
 * Export templates as JSON
 */
export function exportTemplates(): string {
    const templates = loadTemplates();
    return JSON.stringify(templates, null, 2);
}

/**
 * Import templates from JSON
 */
export function importTemplates(json: string, overwrite: boolean = false): number {
    try {
        const imported = JSON.parse(json) as Template[];

        if (!Array.isArray(imported)) {
            throw new Error('Invalid template format');
        }

        const existing = overwrite ? [] : loadTemplates();
        const merged = [...existing, ...imported.map(t => ({
            ...t,
            id: generateId(), // Generate new IDs to avoid conflicts
            createdAt: new Date(),
            updatedAt: new Date()
        }))];

        saveTemplates(merged);
        return imported.length;
    } catch (e) {
        console.error('❌ [Templates] Failed to import:', e);
        return 0;
    }
}
