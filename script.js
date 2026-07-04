const CACHE_KEY='steamtech_cache';
let cache={};
try{const c=localStorage.getItem(CACHE_KEY);if(c)cache=JSON.parse(c);}catch(e){}

const PROXIES=[
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?url=',
    'https://api.codetabs.com/v1/proxy?quest='
];

async function fetchViaProxy(url) {
    for(const proxy of PROXIES) {
        try {
            const r=await fetch(proxy+encodeURIComponent(url),{signal:AbortSignal.timeout(8000)});
            if(r.ok) return await r.text();
        } catch(e) {}
    }
    throw new Error('All proxies failed');
}

async function fetchDepotId(appId) {
    const cacheKey = 'depot_' + appId;
    if (cache[cacheKey]) return cache[cacheKey];

    const url = `https://steamdb.info/app/${appId}/depots/`;
    let html;
    try {
        html = await fetchViaProxy(url);
    } catch(e) {
        return null;
    }

    const patterns = [
        /Windows.+?(\d{5,10})/i,
        /<td>Windows<\/td>\s*<td[^>]*>\s*<a[^>]*>\s*(\d+)\s*<\/a>/i,
        /Depot ID\s*(\d+).*?Windows/i
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            const depotId = match[1];
            cache[cacheKey] = depotId;
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
            return depotId;
        }
    }

    const fallback = String(parseInt(appId) + 1);
    cache[cacheKey] = fallback;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return fallback;
}

async function fetchManifestId(depotId) {
    if (cache[depotId]) return cache[depotId];

    const url = `https://steamdb.info/depot/${depotId}/`;
    let html;
    try {
        html = await fetchViaProxy(url);
    } catch(e) {
        return null;
    }

    const patterns = [
        /Manifest ID<\/td>\s*<td[^>]*>\s*(\d{17,20})\s*</i,
        /manifestid["']?\s*>\s*(\d{17,20})/i,
        /"manifestid":\s*"(\d{17,20})"/i,
        /manifest\s+id\s*[:=]\s*(\d{17,20})/i,
        /<td>Manifest ID<\/td>\s*<td[^>]*>(\d{17,20})<\/td>/i,
        /ManifestID:\s*(\d{17,20})/i,
        /Manifest\s+ID\s*:\s*(\d{17,20})/i
    ];

    for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1]) {
            cache[depotId] = m[1];
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
            return m[1];
        }
    }
    return null;
}

async function generateLua(appId) {
    const t = appId.trim();
    if (!t || !/^\d+$/.test(t)) return null;

    const depotId = await fetchDepotId(t);
    if (!depotId) return null;

    let manifestId = await fetchManifestId(depotId);
    let lua = `addappid(${t})\n`;

    if (manifestId) {
        lua += `addappid(${depotId},1,"${manifestId}")`;
    } else {
        lua += `-- Manifest not found for depot ${depotId}`;
    }
    return lua;
}

const input = document.getElementById('depotInput');
const output = document.getElementById('output');
const genBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const downBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');

let lastLua = null;
let lastId = null;

async function handleGenerate() {
    const val = input.value.trim();
    if (!val || !/^\d+$/.test(val)) {
        output.innerHTML = `<div class="label">output</div><div class="empty">invalid App ID (digits only)</div>`;
        lastLua = null;
        lastId = null;
        statusText.textContent = '';
        return;
    }

    statusText.innerHTML = `<span class="loader"></span> fetching depot and manifest...`;
    const lua = await generateLua(val);

    if (!lua) {
        statusText.textContent = 'error';
        return;
    }

    lastLua = lua;
    lastId = val;
    output.innerHTML = `<div class="label">${val}.lua</div><pre>${lua}</pre>`;
    statusText.textContent = '';
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
