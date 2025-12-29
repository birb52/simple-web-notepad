const googleFonts = ["Inter", "JetBrains Mono", "Roboto", "Fira Code", "Noto Sans", "Lato", "Montserrat", "Open Sans", "Source Sans Pro", "Roboto Mono", "PT Mono", "Merriweather", "Playfair Display", "Oswald", "Raleway", "Ubuntu", "Poppins", "Dancing Script", "Pacifico", "Indie Flower", "Caveat"];

// DOM Elements
const el = id => document.getElementById(id);
const editor = el('editor');
const markdownPreview = el('markdownPreview');
const toggleMarkdownBtn = el('toggleMarkdownBtn');
const markdownStatus = el('markdownStatus');
const markdownIcon = el('markdownIcon');
const modeIndicator = el('modeIndicator');
const fileInput = el('fileInput');
const filenameDisplay = el('filenameDisplay');

// Settings elements
const uiFontInput = el('uiFontInput');
const noteFontInput = el('noteFontInput');
const themeSelect = el('themeSelect');
const wrapToggle = el('wrapToggle');
const fontSizeInput = el('fontSize');
const lineHeightInput = el('lineHeight');
const tabSizeSelect = el('tabSize');
const markdownThemeSelect = el('markdownTheme');
const syntaxHighlighting = el('syntaxHighlighting');
const autoPreviewMd = el('autoPreviewMd');
const previewFontSize = el('previewFontSize');

// Default settings
let settings = {
    uiFont: 'Inter',
    noteFont: 'JetBrains Mono',
    fontSize: 16,
    lineHeight: 1.5,
    wrap: 'soft',
    theme: 'light',
    bgColor: '',
    textColor: '',
    tabSize: '4',
    markdownTheme: 'light',
    syntaxHighlighting: true,
    autoPreviewMd: true,
    previewFontSize: 16,
    markdownEnabled: false
};

// State
let isMarkdownPreviewActive = false;
let isUpdatingPreview = false;
let lastCursorPosition = 0;
let lastEditorScrollTop = 0;
let currentFilename = 'Untitled.txt';

function updateFilenameDisplay() {
    if (filenameDisplay) filenameDisplay.textContent = currentFilename || 'Untitled.txt';
}

// Initialize
function init() {
    loadSettings();
    setupEventListeners();
    loadContent();
    updateUI();
}

// Tab functionality
function handleTabKey(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        
        const start = editor.selectionStart;
        const end = editor.selectionStart;
        let insertText;
        
        if (settings.tabSize === 'tab') {
            insertText = '\t';
        } else {
            insertText = ' '.repeat(parseInt(settings.tabSize));
        }
        
        editor.value = editor.value.substring(0, start) + insertText + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + insertText.length;
        editor.dispatchEvent(new Event('input'));
    }
}

// Save cursor position in preview
function saveCursorPosition() {
    if (isMarkdownPreviewActive && markdownPreview.contains(document.activeElement)) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preSelectionRange = range.cloneRange();
            preSelectionRange.selectNodeContents(markdownPreview);
            preSelectionRange.setEnd(range.startContainer, range.startOffset);
            lastCursorPosition = preSelectionRange.toString().length;
        }
    }
}

// Restore cursor position in preview
function restoreCursorPosition() {
    if (lastCursorPosition > 0 && isMarkdownPreviewActive) {
        const selection = window.getSelection();
        const range = document.createRange();
        
        // Find the text node and position
        let charIndex = 0;
        let foundNode = null;
        let foundOffset = 0;
        
        function traverse(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nextCharIndex = charIndex + node.textContent.length;
                if (!foundNode && lastCursorPosition >= charIndex && lastCursorPosition <= nextCharIndex) {
                    foundNode = node;
                    foundOffset = lastCursorPosition - charIndex;
                }
                charIndex = nextCharIndex;
            } else {
                for (let child of node.childNodes) {
                    traverse(child);
                    if (foundNode) break;
                }
            }
        }
        
        traverse(markdownPreview);
        
        if (foundNode) {
            range.setStart(foundNode, foundOffset);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // If no text node found, place cursor at end
            range.selectNodeContents(markdownPreview);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
}

// Markdown rendering
function renderMarkdown(text, preserveCursor = false) {
    if (isUpdatingPreview) return;
    isUpdatingPreview = true;
    
    // Save cursor position before updating
    if (preserveCursor && isMarkdownPreviewActive) {
        saveCursorPosition();
    }
    
    // Save scroll position
    const previousScrollTop = markdownPreview.scrollTop;
    
    // Simple Markdown parser
    let html = text
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        
        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/__(.*?)__/gim, '<strong>$1</strong>')
        
        // Italic
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/_(.*?)_/gim, '<em>$1</em>')
        
        // Strikethrough
        .replace(/~~(.*?)~~/gim, '<del>$1</del>')
        
        // Code blocks with syntax highlighting
        .replace(/```(\w+)?\n([\s\S]*?)\n```/gim, (match, lang, code) => {
            if (settings.syntaxHighlighting && lang) {
                return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
            }
            return `<pre><code>${escapeHtml(code)}</code></pre>`;
        })
        
        // Inline code
        .replace(/`(.*?)`/gim, '<code>$1</code>')
        
        // Blockquotes
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        
        // Horizontal rule
        .replace(/^\-\-\-$/gim, '<hr>')
        
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>')
        
        // Images
        .replace(/!\[([^\]]+)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1">')
        
        // Lists
        .replace(/^\s*\n\* (.*)/gim, '<ul>\n<li>$1</li>\n</ul>')
        .replace(/^\s*\n- (.*)/gim, '<ul>\n<li>$1</li>\n</ul>')
        .replace(/^\s*\n\d+\. (.*)/gim, '<ol>\n<li>$1</li>\n</ul>')
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/<\/ol>\s*<ol>/g, '')
        
        // Paragraphs (handle line breaks)
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap in paragraph if not already in block element
    if (!html.startsWith('<') || html.startsWith('<p>')) {
        html = '<p>' + html + '</p>';
    }
    
    // Apply theme class
    markdownPreview.className = `markdown-preview ${getMarkdownThemeClass()}`;
    
    // Set preview font size
    markdownPreview.style.fontSize = settings.previewFontSize + 'px';
    
    // Update preview
    markdownPreview.innerHTML = html;
    
    // Apply syntax highlighting if enabled
    if (settings.syntaxHighlighting) {
        highlightCodeBlocks();
    }
    
    // Restore cursor and scroll position
    if (preserveCursor) {
        restoreCursorPosition();
        markdownPreview.scrollTop = previousScrollTop;
    }
    
    isUpdatingPreview = false;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getMarkdownThemeClass() {
    switch(settings.markdownTheme) {
        case 'dark': return 'dark-theme';
        case 'github': return 'github-theme';
        case 'solarized': return 'solarized-theme';
        default: return '';
    }
}

function highlightCodeBlocks() {
    const codeBlocks = markdownPreview.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const lang = block.className.replace('language-', '');
        if (lang && window.hljs) {
            block.innerHTML = window.hljs.highlight(block.textContent, { language: lang }).value;
        }
    });
}

// Toggle markdown preview
function toggleMarkdownPreview() {
    isMarkdownPreviewActive = !isMarkdownPreviewActive;
    
    if (isMarkdownPreviewActive) {
        // Switch to preview mode
        editor.style.display = 'none';
        markdownPreview.style.display = 'block';
        markdownStatus.textContent = 'On';
        markdownIcon.textContent = 'PRE';
        toggleMarkdownBtn.style.background = 'rgba(59, 130, 246, 0.2)';
        modeIndicator.textContent = 'Preview';
        
        // Render markdown
        renderMarkdown(editor.value);
        
        // Focus the preview for editing
        setTimeout(() => {
            // Place cursor at end of content
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(markdownPreview);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            markdownPreview.focus();
        }, 10);
    } else {
        // Switch to editor mode
        editor.style.display = 'block';
        markdownPreview.style.display = 'none';
        markdownStatus.textContent = 'Off';
        markdownIcon.textContent = 'MD';
        toggleMarkdownBtn.style.background = '';
        modeIndicator.textContent = 'Plain Text';
        
        // Focus the editor
        editor.focus();
    }
    
    settings.markdownEnabled = isMarkdownPreviewActive;
    saveSettings();
    updateCounts();
}

// Handle editing in preview mode
function handlePreviewEdit() {
    if (!isMarkdownPreviewActive || isUpdatingPreview) return;
    
    // Get the HTML content from preview
    const html = markdownPreview.innerHTML;
    
    // Convert HTML back to markdown (simplified)
    let markdown = html
        .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em>(.*?)<\/em>/gi, '*$1*')
        .replace(/<code>(.*?)<\/code>/gi, '`$1`')
        .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```')
        .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<img src="([^"]+)" alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
        .replace(/<ul>\s*<li>(.*?)<\/li>\s*<\/ul>/gi, '- $1\n')
        .replace(/<ol>\s*<li>(.*?)<\/li>\s*<\/ul>/gi, '1. $1\n')
        .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n')
        .replace(/<hr>/gi, '---\n')
        .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br>/gi, '\n')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    
    // Update editor with converted markdown
    editor.value = markdown.trim();
    saveContent();
    
    // Re-render preview with cursor preservation
    renderMarkdown(editor.value, true);
}

// Update UI based on mode
function updateUI() {
    if (editor.value.includes('#') || editor.value.includes('**') || editor.value.includes('`')) {
        modeIndicator.textContent = 'Markdown';
        modeIndicator.style.background = 'rgba(59, 130, 246, 0.1)';
        modeIndicator.style.color = '#3b82f6';
    } else {
        modeIndicator.textContent = 'Plain Text';
        modeIndicator.style.background = 'rgba(100, 116, 139, 0.1)';
        modeIndicator.style.color = 'var(--muted)';
    }
}

// Settings
function applySettings() {
    document.documentElement.style.setProperty('--ui-font', settings.uiFont);
    document.documentElement.style.setProperty('--note-font', settings.noteFont);
    document.documentElement.style.setProperty('--font-size', settings.fontSize + 'px');
    document.documentElement.style.setProperty('--line-height', settings.lineHeight);
    editor.style.whiteSpace = (settings.wrap === 'off' ? 'pre' : 'pre-wrap');

    // Theme
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else if (settings.theme === 'light') document.documentElement.classList.remove('dark');
    else {
        const darkMatch = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', darkMatch);
    }

    // Custom colors
    if (settings.bgColor) document.body.style.background = settings.bgColor;
    else document.body.style.background = '';
    if (settings.textColor) editor.style.color = settings.textColor;
    else editor.style.color = '';
    
    // Update preview if active
    if (isMarkdownPreviewActive) {
        renderMarkdown(editor.value);
    }
    
    updateUI();
}

function saveSettings() {
    localStorage.setItem('zephyrNotepad.settings', JSON.stringify(settings));
}

function loadSettings() {
    const s = JSON.parse(localStorage.getItem('zephyrNotepad.settings') || '{}');
    settings = { ...settings, ...s };
    
    // Update UI elements
    uiFontInput.value = settings.uiFont;
    noteFontInput.value = settings.noteFont;
    fontSizeInput.value = settings.fontSize;
    lineHeightInput.value = settings.lineHeight;
    wrapToggle.value = settings.wrap;
    themeSelect.value = settings.theme;
    tabSizeSelect.value = settings.tabSize;
    markdownThemeSelect.value = settings.markdownTheme;
    syntaxHighlighting.checked = settings.syntaxHighlighting;
    autoPreviewMd.checked = settings.autoPreviewMd;
    previewFontSize.value = settings.previewFontSize;
    
    // Load fonts
    loadFont(settings.uiFont);
    loadFont(settings.noteFont);
    
    // Restore markdown preview state
    isMarkdownPreviewActive = settings.markdownEnabled;
    if (isMarkdownPreviewActive) {
        toggleMarkdownPreview();
    }
    
    applySettings();
}

// Font loading
function loadFont(f) {
    if (document.getElementById('gf-' + f.replace(/\s+/g, ''))) return;
    const l = document.createElement('link');
    l.id = 'gf-' + f.replace(/\s+/g, '');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + '&display=swap';
    document.head.appendChild(l);
}

// Font search
function setupFontSearch(input, list, settingKey) {
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        list.innerHTML = '';
        googleFonts.filter(f => f.toLowerCase().includes(q)).forEach(f => {
            const div = document.createElement('div');
            div.textContent = f;
            div.onclick = () => {
                input.value = f;
                settings[settingKey] = f;
                applySettings();
                loadFont(f);
                list.innerHTML = '';
                saveSettings();
            };
            list.appendChild(div);
        });
    });
    input.addEventListener('blur', () => setTimeout(() => list.innerHTML = '', 200));
}

// File operations
function saveFile() {
    const text = editor.value || '';
    const nameBase = currentFilename || 'notes.txt';

    // If markdown detected or current filename already ends with .md, save as .md
    const detectedMd = isMarkdownText(text) || (nameBase && nameBase.toLowerCase().endsWith('.md'));
    let name = nameBase;
    if (detectedMd) {
        // Replace extension if present, otherwise append .md
        if (!name.toLowerCase().endsWith('.md')) {
            name = name.replace(/\.[^/.]+$/, '') + '.md';
        }
    }

    const mime = detectedMd ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Simple heuristic to detect Markdown content
function isMarkdownText(text) {
    if (!text || !text.trim()) return false;
    const patterns = [
        /^#{1,6}\s+/m,         // headings
        /\*\*(.*?)\*\*/m,    // bold
        /`{3}/m,                // code fence
        /\[(.*?)\]\((.*?)\)/m, // links
        /!\[(.*?)\]\((.*?)\)/m, // images
        /^>\s+/m,              // blockquote
        /^\s*[-*+]\s+/m,      // unordered list
        /^\s*\d+\.\s+/m     // ordered list
    ];
    return patterns.some(rx => rx.test(text));
}

function saveContent() {
    localStorage.setItem('zephyrNotepad.content', editor.value);
    localStorage.setItem('zephyrNotepad.filename', currentFilename || 'Untitled.txt');
}

function loadContent() {
    const c = localStorage.getItem('zephyrNotepad.content');
    const fn = localStorage.getItem('zephyrNotepad.filename') || 'Untitled.txt';
    if (c) {
        editor.value = c;
        currentFilename = fn;
        updateCounts();
        updateUI();
    } else {
        currentFilename = fn;
    }
    updateFilenameDisplay();
}

// Counts and stats
function updateCounts() {
    const text = editor.value;
    el('charCount').textContent = 'Chars: ' + text.length;
    const words = text.trim().split(/\s+/).filter(Boolean);
    el('wordCount').textContent = 'Words: ' + (text.trim() ? words.length : 0);
    const sel = editor.selectionEnd - editor.selectionStart;
    el('selCount').textContent = 'Selection: ' + Math.max(0, sel);
    const before = text.slice(0, editor.selectionStart).split('\n');
    el('position').textContent = 'Ln ' + before.length + ', Col ' + (before[before.length - 1].length + 1);
    
    updateUI();
}

// Setup event listeners
function setupEventListeners() {
    // Editor events
    editor.addEventListener('keydown', handleTabKey);
    editor.addEventListener('input', () => {
        updateCounts();
        saveContent();
        if (isMarkdownPreviewActive) {
            renderMarkdown(editor.value, true);
        }
    });
    editor.addEventListener('click', updateCounts);
    editor.addEventListener('keyup', updateCounts);
    editor.addEventListener('select', updateCounts);
    
    // Preview events
    markdownPreview.addEventListener('input', handlePreviewEdit);
    markdownPreview.addEventListener('click', () => {
        // Save cursor position on click
        saveCursorPosition();
    });
    markdownPreview.addEventListener('keydown', (e) => {
        // Save cursor position on keydown
        saveCursorPosition();
        
        // Handle Enter key in preview (insert newline) and Tab
        if (e.key === 'Enter') {
            // Insert a newline-like break in the contenteditable preview.
            // Using insertHTML with two <br> gives a visible blank line similar to pressing Enter.
            e.preventDefault();
            document.execCommand('insertHTML', false, '<br><br>');
            // Update underlying markdown and re-render (preserves cursor via existing logic)
            handlePreviewEdit();
            return;
        }

        // Handle Tab key in preview
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
            handlePreviewEdit();
        }
        
        // Allow formatting shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold');
                handlePreviewEdit();
            } else if (e.key === 'i') {
                e.preventDefault();
                document.execCommand('italic');
                handlePreviewEdit();
            } else if (e.key === 'm') {
                e.preventDefault();
                toggleMarkdownPreview();
            }
        }
    });
    markdownPreview.addEventListener('keyup', saveCursorPosition);
    
    // Markdown toggle
    toggleMarkdownBtn.addEventListener('click', toggleMarkdownPreview);
    
    // File operations
    el('openBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) {
            const r = new FileReader();
            r.onload = ev => {
                editor.value = ev.target.result;
                currentFilename = f.name;
                updateFilenameDisplay();
                localStorage.setItem('zephyrNotepad.filename', currentFilename);
                updateCounts();
                saveContent();
                updateUI();
                
                // Auto-enable markdown preview for .md files
                if (settings.autoPreviewMd && f.name.toLowerCase().endsWith('.md')) {
                    if (!isMarkdownPreviewActive) {
                        toggleMarkdownPreview();
                    }
                }
            };
            r.readAsText(f, 'utf-8');
        }
    });
    
    el('saveBtn').addEventListener('click', saveFile);
    el('newBtn').addEventListener('click', () => {
        if (confirm('Clear editor?')) {
            editor.value = '';
            markdownPreview.innerHTML = '';
            currentFilename = 'Untitled.txt';
            updateFilenameDisplay();
            updateCounts();
            saveContent();
            updateUI();
        }
    });
    
    // Settings
    el('settingsBtn').addEventListener('click', () => el('settingsModal').style.display = 'flex');
    el('closeSettings').addEventListener('click', () => el('settingsModal').style.display = 'none');
    el('settingsModal').addEventListener('click', e => {
        if (e.target === el('settingsModal')) el('settingsModal').style.display = 'none';
    });
    
    // Help
    el('helpBtn').addEventListener('click', () => el('helpModal').style.display = 'flex');
    el('closeHelp').addEventListener('click', () => el('helpModal').style.display = 'none');
    el('helpModal').addEventListener('click', e => {
        if (e.target === el('helpModal')) el('helpModal').style.display = 'none';
    });
    
    // Tabs
    document.querySelectorAll('.tabBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tabContent').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
    
    // Settings change listeners
    fontSizeInput.addEventListener('change', () => {
        settings.fontSize = Number(fontSizeInput.value);
        applySettings();
        saveSettings();
    });
    
    lineHeightInput.addEventListener('change', () => {
        settings.lineHeight = Number(lineHeightInput.value);
        applySettings();
        saveSettings();
    });
    
    wrapToggle.addEventListener('change', () => {
        settings.wrap = wrapToggle.value;
        applySettings();
        saveSettings();
    });
    
    themeSelect.addEventListener('change', () => {
        settings.theme = themeSelect.value;
        applySettings();
        saveSettings();
    });
    
    tabSizeSelect.addEventListener('change', () => {
        settings.tabSize = tabSizeSelect.value;
        saveSettings();
    });
    
    markdownThemeSelect.addEventListener('change', () => {
        settings.markdownTheme = markdownThemeSelect.value;
        applySettings();
        saveSettings();
    });
    
    syntaxHighlighting.addEventListener('change', () => {
        settings.syntaxHighlighting = syntaxHighlighting.checked;
        applySettings();
        saveSettings();
    });
    
    autoPreviewMd.addEventListener('change', () => {
        settings.autoPreviewMd = autoPreviewMd.checked;
        saveSettings();
    });
    
    previewFontSize.addEventListener('change', () => {
        settings.previewFontSize = Number(previewFontSize.value);
        applySettings();
        saveSettings();
    });
    
    el('bgColorPicker').addEventListener('input', e => {
        settings.bgColor = e.target.value;
        applySettings();
        saveSettings();
    });
    
    el('textColorPicker').addEventListener('input', e => {
        settings.textColor = e.target.value;
        applySettings();
        saveSettings();
    });
    
    // Font search
    setupFontSearch(uiFontInput, uiFontList, 'uiFont');
    setupFontSearch(noteFontInput, noteFontList, 'noteFont');
    
    // Keyboard shortcuts
    window.addEventListener('keydown', e => {
        const combo = (k) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === k;
        
        if (combo('n')) {
            if (confirm('Clear editor?')) {
                editor.value = '';
                markdownPreview.innerHTML = '';
                currentFilename = 'Untitled.txt';
                updateFilenameDisplay();
                updateCounts();
                saveContent();
                updateUI();
            }
            e.preventDefault();
        }
        
        if (combo('s')) {
            saveFile();
            e.preventDefault();
        }
        
        if (combo('o')) {
            fileInput.click();
            e.preventDefault();
        }
        
        if (combo('m')) {
            toggleMarkdownPreview();
            e.preventDefault();
        }
    });
    
    // Theme sync
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (settings.theme === 'system') {
            document.documentElement.classList.toggle('dark', e.matches);
        }
    });
}

// Load Highlight.js for syntax highlighting
function loadHighlightJS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css';
    document.head.appendChild(link);
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js';
    script.onload = () => {
        if (isMarkdownPreviewActive) {
            renderMarkdown(editor.value);
        }
    };
    document.head.appendChild(script);
}

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
    init();
    loadHighlightJS();
});