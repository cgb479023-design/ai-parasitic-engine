// NotebookLM Content Script
// Note: Full automation is limited by Google's Content Security Policy
// This script provides helper logging only

console.log('📚 [NotebookLM] Content Script Loaded');

if (window.location.href.includes('notebooklm.google.com')) {
    console.log('📚 [NotebookLM] Detected NotebookLM page');
    console.log('');
    console.log('💡 手动上传知识库文件:');
    console.log('   1. 点击 "+ Add sources"');
    console.log('   2. 选择 "Upload files"');
    console.log('   3. 从 knowledge_export 文件夹选择 KB_*.md 文件');
    console.log('');
    console.log('📁 文件位置: e:\\ai-内容创作智能化平台\\.gemini\\knowledge_export\\');
}
