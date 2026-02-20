/**
 * TemplateEditor Component
 * Migrated from components/YouTubeAnalytics/Templates/TemplateEditor.tsx
 * 
 * Rich template editor for content templates with variable insertion and preview.
 */
import React, { useState, useEffect, useRef } from 'react';

interface Template {
    id: string;
    name: string;
    type: 'title' | 'description' | 'tags' | 'comment';
    category: string;
    content: string;
    variables: string[];
    createdAt: string;
    updatedAt: string;
}

interface TemplateEditorProps {
    onSave?: (template: Template) => void;
    initialTemplate?: Template | null;
    availableVariables?: string[];
}

const DEFAULT_VARIABLES = [
    '{{title}}', '{{date}}', '{{time}}', '{{channel}}',
    '{{views}}', '{{likes}}', '{{category}}', '{{tags}}',
    '{{description}}', '{{url}}', '{{thumbnail}}', '{{duration}}',
];

const TEMPLATE_TYPES: Array<{ value: Template['type']; label: string; icon: string }> = [
    { value: 'title', label: '标题', icon: '📝' },
    { value: 'description', label: '描述', icon: '📄' },
    { value: 'tags', label: '标签', icon: '🏷️' },
    { value: 'comment', label: '评论', icon: '💬' },
];

const CATEGORIES = ['Default', 'Karen', 'Cat', 'Dog', 'Tech', 'Scammer', 'Custom'];

const STORAGE_KEY = 'yt_analytics_templates';

const loadTemplates = (): Template[] => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

const saveTemplates = (templates: Template[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
};

// Extract variables from content
const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches)] : [];
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
    onSave,
    initialTemplate,
    availableVariables = DEFAULT_VARIABLES,
}) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [editing, setEditing] = useState<Template | null>(null);
    const [name, setName] = useState('');
    const [type, setType] = useState<Template['type']>('title');
    const [category, setCategory] = useState('Default');
    const [content, setContent] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { setTemplates(loadTemplates()); }, []);
    useEffect(() => {
        if (initialTemplate) {
            setEditing(initialTemplate);
            setName(initialTemplate.name);
            setType(initialTemplate.type);
            setCategory(initialTemplate.category);
            setContent(initialTemplate.content);
        }
    }, [initialTemplate]);

    const handleNew = () => {
        setEditing(null);
        setName(''); setType('title'); setCategory('Default'); setContent('');
    };

    const handleSave = () => {
        if (!name.trim() || !content.trim()) return;
        const now = new Date().toISOString();
        const template: Template = {
            id: editing?.id || `tmpl_${Date.now()}`,
            name: name.trim(), type, category, content,
            variables: extractVariables(content),
            createdAt: editing?.createdAt || now,
            updatedAt: now,
        };
        const updated = editing
            ? templates.map(t => t.id === editing.id ? template : t)
            : [...templates, template];
        setTemplates(updated);
        saveTemplates(updated);
        onSave?.(template);
        handleNew();
    };

    const handleDelete = (id: string) => {
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        saveTemplates(updated);
        if (editing?.id === id) handleNew();
    };

    const handleEdit = (template: Template) => {
        setEditing(template);
        setName(template.name); setType(template.type);
        setCategory(template.category); setContent(template.content);
    };

    const insertVariable = (variable: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + variable + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        }, 0);
    };

    const previewContent = content
        .replace(/\{\{title\}\}/g, 'Sample Video Title')
        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString())
        .replace(/\{\{channel\}\}/g, 'MyChannel')
        .replace(/\{\{views\}\}/g, '10,234')
        .replace(/\{\{likes\}\}/g, '523')
        .replace(/\{\{category\}\}/g, category)
        .replace(/\{\{tags\}\}/g, '#shorts #viral')
        .replace(/\{\{description\}\}/g, 'Amazing content...')
        .replace(/\{\{url\}\}/g, 'https://youtube.com/shorts/abc123')
        .replace(/\{\{thumbnail\}\}/g, '🖼️')
        .replace(/\{\{duration\}\}/g, '0:59');

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">📝 模板编辑器</h3>
                <button onClick={handleNew} className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30">+ 新建</button>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* Template List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">已保存模板</h4>
                    {templates.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">暂无模板</p>
                    ) : templates.map(t => (
                        <div key={t.id} onClick={() => handleEdit(t)}
                            className={`p-2 rounded cursor-pointer transition-colors ${editing?.id === t.id ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-white truncate">{t.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                                    className="text-xs text-red-400 hover:text-red-300">🗑</button>
                            </div>
                            <div className="flex gap-1 mt-1">
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-600 rounded">{TEMPLATE_TYPES.find(tt => tt.value === t.type)?.icon} {t.type}</span>
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-600 rounded">{t.category}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Editor */}
                <div className="col-span-2 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="模板名称"
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none" />
                        <select value={type} onChange={(e) => setType(e.target.value as Template['type'])}
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm">
                            {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                        </select>
                        <select value={category} onChange={(e) => setCategory(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Variable Buttons */}
                    <div className="flex flex-wrap gap-1">
                        {availableVariables.map(v => (
                            <button key={v} onClick={() => insertVariable(v)}
                                className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs hover:bg-blue-500/30 transition-colors">
                                {v}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400">内容 ({content.length} chars, {extractVariables(content).length} vars)</span>
                            <button onClick={() => setShowPreview(!showPreview)}
                                className="text-xs text-blue-400 hover:text-blue-300">
                                {showPreview ? '📝 编辑' : '👁️ 预览'}
                            </button>
                        </div>
                        {showPreview ? (
                            <div className="bg-slate-700/50 rounded p-3 min-h-[150px] text-sm text-white whitespace-pre-wrap">{previewContent}</div>
                        ) : (
                            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)}
                                placeholder="输入模板内容... 使用 {{variable}} 插入变量"
                                className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white text-sm min-h-[150px] resize-y focus:border-blue-500 focus:outline-none font-mono" />
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={!name.trim() || !content.trim()}
                            className={`px-4 py-2 rounded font-medium text-sm ${!name.trim() || !content.trim()
                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                            💾 {editing ? '更新模板' : '保存模板'}
                        </button>
                        {editing && (
                            <button onClick={handleNew} className="px-4 py-2 rounded bg-slate-600 text-slate-300 text-sm hover:bg-slate-500">
                                取消
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditor;
export type { TemplateEditorProps, Template };
