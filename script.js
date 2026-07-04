async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateLua(depotId) {
    const trimmed = depotId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const salt = "SteamDepotKeySalt_2024";
    const raw = trimmed + salt;
    const hash = await sha256(raw);
    const key = hash.substring(0, 64);
    return `addappid(${trimmed})\naddappid(${trimmed},0,"${key}")`;
}

const input = document.getElementById('depotInput');
const output = document.getElementById('output');
const genBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const downBtn = document.getElementById('downloadBtn');

let lastLua = null;
let lastId = null;

async function handleGenerate() {
    const val = input.value.trim();
    if (!val || !/^\d+$/.test(val)) {
        output.innerHTML = `<div class="label">output</div><div class="empty">invalid Depot ID (digits only)</div>`;
        lastLua = null;
        lastId = null;
        return;
    }
    const lua = await generateLua(val);
    if (!lua) return;
    lastLua = lua;
    lastId = val;
    output.innerHTML = `<div class="label">${val}.lua</div><pre>${lua}</pre>`;
}

genBtn.addEventListener('click', handleGenerate);
input.addEventListener('keydown', e => { if (e.key === 'Enter') handleGenerate(); });

copyBtn.addEventListener('click', function() {
    if (!lastLua) { alert('Generate first'); return; }
    navigator.clipboard.writeText(lastLua).then(() => {
        const orig = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => this.textContent = orig, 1200);
    }).catch(() => {
        const pre = output.querySelector('pre');
        if (pre) {
            const r = document.createRange();
            r.selectNode(pre);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(r);
            document.execCommand('copy');
            alert('Copied!');
        }
    });
});

downBtn.addEventListener('click', function() {
    if (!lastLua) { alert('Generate first'); return; }
    const blob = new Blob([lastLua], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lastId}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

window.addEventListener('DOMContentLoaded', () => input.focus());
