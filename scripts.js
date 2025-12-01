const googleFonts = ["Inter", "JetBrains Mono", "Roboto", "Fira Code", "Noto Sans", "Lato", "Montserrat", "Open Sans", "Source Sans Pro", "Roboto Mono", "PT Mono", "Merriweather", "Playfair Display", "Oswald", "Raleway", "Ubuntu", "Poppins", "Dancing Script", "Pacifico", "Indie Flower", "Caveat"];

const el = id => document.getElementById(id);
const editor = el('editor');
const uiFontInput = el('uiFontInput');
const noteFontInput = el('noteFontInput');
const uiFontList = el('uiFontList');
const noteFontList = el('noteFontList');
const themeSelect = el('themeSelect');
const wrapToggle = el('wrapToggle');
const fontSizeInput = el('fontSize');
const lineHeightInput = el('lineHeight');
const settingsModal = el('settingsModal');
const settingsBtn = el('settingsBtn');
const closeSettings = el('closeSettings');
const helpModal = el('helpModal');
const helpBtn = el('helpBtn');
const closeHelp = el('closeHelp');

let settings = {
    uiFont: 'Inter',
    noteFont: 'JetBrains Mono',
    fontSize: 16,
    lineHeight: 1.5,
    wrap: 'soft',
    theme: 'light',
    bgColor: '',
    textColor: ''
};

function applySettings() {
    document.documentElement.style.setProperty('--ui-font', settings.uiFont);
    document.documentElement.style.setProperty('--note-font', settings.noteFont);
    document.documentElement.style.setProperty('--font-size', settings.fontSize + 'px');
    document.documentElement.style.setProperty('--line-height', settings.lineHeight);
    editor.style.whiteSpace = (settings.wrap === 'off' ? 'pre' : 'pre-wrap');

    // theme + system
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else if (settings.theme === 'light') document.documentElement.classList.remove('dark');
    else {
        const darkMatch = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', darkMatch);
    }

    if (settings.bgColor) document.body.style.background = settings.bgColor;
    else document.body.style.background = '';
    if (settings.textColor) editor.style.color = settings.textColor;
    else editor.style.color = '';
}

/* Added — live theme sync when OS switches */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (settings.theme === 'system') {
        document.documentElement.classList.toggle('dark', e.matches);
    }
});

function loadFont(f) {
    if (document.getElementById('gf-' + f.replace(/\s+/g, ''))) return;
    const l = document.createElement('link');
    l.id = 'gf-' + f.replace(/\s+/g, '');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + '&display=swap';
    document.head.appendChild(l);
}

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

function saveSettings() {
    localStorage.setItem('zephyrNotepad.settings', JSON.stringify(settings));
}

function loadSettings() {
    const s = JSON.parse(localStorage.getItem('zephyrNotepad.settings') || '{}');
    settings = { ...settings, ...s };
    uiFontInput.value = settings.uiFont;
    noteFontInput.value = settings.noteFont;
    fontSizeInput.value = settings.fontSize;
    lineHeightInput.value = settings.lineHeight;
    wrapToggle.value = settings.wrap;
    themeSelect.value = settings.theme;
    el('bgColorPicker').value = settings.bgColor || '#ffffff';
    el('textColorPicker').value = settings.textColor || '#000000';
    applySettings();
    loadFont(settings.uiFont);
    loadFont(settings.noteFont);
}

setupFontSearch(uiFontInput, uiFontList, 'uiFont');
setupFontSearch(noteFontInput, noteFontList, 'noteFont');

// Modal event handlers
settingsBtn.onclick = () => settingsModal.style.display = 'flex';
closeSettings.onclick = () => settingsModal.style.display = 'none';
settingsModal.addEventListener('click', e => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
});

helpBtn.onclick = () => helpModal.style.display = 'flex';
closeHelp.onclick = () => helpModal.style.display = 'none';
helpModal.addEventListener('click', e => {
    if (e.target === helpModal) helpModal.style.display = 'none';
});

// Tab functionality
document.querySelectorAll('.tabBtn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tabContent').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});

// Editor event listeners
editor.addEventListener('input', () => {
    updateCounts();
    saveContent();
});
editor.addEventListener('click', updateCounts);
editor.addEventListener('keyup', updateCounts);
editor.addEventListener('select', updateCounts);

function updateCounts() {
    const text = editor.value;
    el('charCount').textContent = 'Chars: ' + text.length;
    const words = text.trim().split(/\s+/).filter(Boolean);
    el('wordCount').textContent = 'Words: ' + (text.trim() ? words.length : 0);
    const sel = editor.selectionEnd - editor.selectionStart;
    el('selCount').textContent = 'Selection: ' + Math.max(0, sel);
    const before = text.slice(0, editor.selectionStart).split('\n');
    el('position').textContent = 'Ln ' + before.length + ', Col ' + (before[before.length - 1].length + 1);
}

// File operations
const fileInput = el('fileInput');
el('openBtn').onclick = () => fileInput.click();
fileInput.onchange = (e) => {
    const f = e.target.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = ev => {
            editor.value = ev.target.result;
            updateCounts();
            saveContent();
        };
        r.readAsText(f, 'utf-8');
    }
};
el('saveBtn').onclick = () => saveFile();
el('newBtn').onclick = () => {
    if (confirm('Clear editor?')) {
        editor.value = '';
        updateCounts();
        saveContent();
    }
};

function saveFile() {
    const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'notes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function saveContent() {
    localStorage.setItem('zephyrNotepad.content', editor.value);
}

function loadContent() {
    const c = localStorage.getItem('zephyrNotepad.content');
    if (c) {
        editor.value = c;
        updateCounts();
    }
}

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

// Keyboard shortcuts
window.addEventListener('keydown', e => {
    const combo = (k) => (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === k;
    if (combo('n')) {
        if (confirm('Clear editor?')) {
            editor.value = '';
            updateCounts();
            saveContent();
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
});

// Initialize
loadSettings();
loadContent();