// ─── State ────────────────────────────────────────────────────────────────────
let isCreator = false;
let tracks = [];
let albums = [];
let currentTrackId = null;
let isPlaying = false;
let isLooping = false;
let isShuffling = false;
let currentPurpose = 'collab';
let pendingAlbumTracks = [];
let pendingCoverFile = null;
let pendingCoverPreview = null;
let pendingUploadFile = null;
let pendingUploadObjectPath = null;
let trackIdCounter = 1;
let albumIdCounter = 1;
let albumTrackIdCounter = 1;
let socialLinks = {
  ig: 'https://instagram.com/rbeatz44',
  yt: 'https://youtube.com/@Rbeatz-08',
  tt: 'https://tiktok.com/@rbeatz6'
};

// ─── Audio ────────────────────────────────────────────────────────────────────
const audio = new Audio();
audio.addEventListener('timeupdate', onTimeUpdate);
audio.addEventListener('ended', onEnded);
audio.addEventListener('loadedmetadata', () => {
  if (currentTrackId !== null) {
    const t = tracks.find(t => t.id === currentTrackId);
    if (t && !t.duration) { t.duration = formatTime(audio.duration); saveTracksToStorage(); }
  }
  renderAll();
});

let audioCtx = null, analyser = null;
const eqFilters = [];
const EQ_BANDS = [
  { type:'lowshelf', freq:100, label:'BASS' },
  { type:'peaking',  freq:300, label:'LOW'  },
  { type:'peaking',  freq:1000,label:'MID'  },
  { type:'peaking',  freq:4000,label:'HIGH' },
  { type:'highshelf',freq:12000,label:'AIR' },
];
let eqGains = [0,0,0,0,0];

function setupAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    const source = audioCtx.createMediaElementSource(audio);
    EQ_BANDS.forEach((b, i) => {
      const f = audioCtx.createBiquadFilter();
      f.type = b.type; f.frequency.value = b.freq; f.gain.value = eqGains[i];
      eqFilters.push(f);
    });
    // Loudness boost — phones/native players apply automatic volume enhancement
    // that browsers don't, so beats can sound quieter on the website. This compensates.
    const boost = audioCtx.createGain();
    boost.gain.value = 1.8;
    let prev = source;
    eqFilters.forEach(f => { prev.connect(f); prev = f; });
    prev.connect(boost); boost.connect(analyser); analyser.connect(audioCtx.destination);
  } catch(e) { console.warn('AudioContext unavailable', e); }
}

// ─── Cursor ───────────────────────────────────────────────────────────────────
const glowEl = document.getElementById('cursor-glow');
const dotEl  = document.getElementById('cursor-dot');
let mx=0,my=0,gx=0,gy=0;
document.addEventListener('mousemove', e => {
  mx=e.clientX; my=e.clientY;
  dotEl.style.left=mx+'px'; dotEl.style.top=my+'px';
  const el=document.elementFromPoint(mx,my);
  dotEl.classList.toggle('hovering',!!el?.closest('a,button,input,textarea,select,label,[role=button]'));
});
(function moveGlow(){gx+=(mx-gx)*0.08;gy+=(my-gy)*0.08;glowEl.style.left=gx+'px';glowEl.style.top=gy+'px';requestAnimationFrame(moveGlow);})();

// ─── Hero bars ────────────────────────────────────────────────────────────────
const heroBars = document.getElementById('hero-bars');
for(let i=0;i<40;i++){const b=document.createElement('div');b.className='hero-bar';b.style.height=Math.max(20,Math.random()*100)+'%';b.style.animationDelay=(i*0.05)+'s';heroBars.appendChild(b);}

// ─── Year ─────────────────────────────────────────────────────────────────────
document.getElementById('year').textContent=new Date().getFullYear();

// ─── SECRET LOGIN — Ctrl+Shift+L (invisible to visitors) ─────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'L') { e.preventDefault(); openLogin(); }
});
// Also triple-click on the logo opens login (mobile friendly)
document.querySelector('.nav-logo').addEventListener('click', (() => {
  let clicks=0, timer=null;
  return () => {
    clicks++;
    if(clicks===3){ clicks=0; clearTimeout(timer); openLogin(); }
    clearTimeout(timer); timer=setTimeout(()=>{ clicks=0; },600);
  };
})());

function openLogin(){ document.getElementById('login-modal').classList.add('open'); setTimeout(()=>document.getElementById('login-email').focus(),100); }
function closeLogin(){ document.getElementById('login-modal').classList.remove('open'); document.getElementById('login-error').classList.add('hidden'); }
async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if(data.success){
      isCreator=true;
      CREATOR_EMAIL_STORED=email; CREATOR_PASSWORD_STORED=pass;
      closeLogin(); applyCreatorMode(); renderAll();
      sessionStorage.setItem('rb_creator_email', email);
      sessionStorage.setItem('rb_creator_pass', pass);
    } else {
      document.getElementById('login-error').classList.remove('hidden');
    }
  } catch(e){
    document.getElementById('login-error').textContent = 'Connection error — try again.';
    document.getElementById('login-error').classList.remove('hidden');
  }
}
document.getElementById('login-password').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
function signOut(){
  isCreator=false; CREATOR_EMAIL_STORED=''; CREATOR_PASSWORD_STORED='';
  applyCreatorMode(); renderAll();
  sessionStorage.removeItem('rb_creator_email');
  sessionStorage.removeItem('rb_creator_pass');
}
function applyCreatorMode(){
  document.getElementById('creator-badge').classList.toggle('hidden',!isCreator);
  document.getElementById('signout-btn').classList.toggle('hidden',!isCreator);
  document.getElementById('dash-nav-link').classList.toggle('hidden',!isCreator);
  document.getElementById('dashboard').classList.toggle('visible',isCreator);
}

// ─── Social links ─────────────────────────────────────────────────────────────
function saveSocials(){
  socialLinks.ig=document.getElementById('social-ig').value.trim();
  socialLinks.yt=document.getElementById('social-yt').value.trim();
  socialLinks.tt=document.getElementById('social-tt').value.trim();
  updateFooterSocials();
  const s=document.getElementById('socials-saved');
  s.classList.remove('hidden');
  setTimeout(()=>s.classList.add('hidden'),2500);
}
function updateFooterSocials(){
  [['footer-ig',socialLinks.ig],['footer-yt',socialLinks.yt],['footer-tt',socialLinks.tt]].forEach(([id,url])=>{
    const a=document.getElementById(id);
    if(url&&url!=='#'){a.href=url;a.classList.add('active');}
    else{a.href='#';a.classList.remove('active');}
  });
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────
function switchTab(tab){
  document.getElementById('tab-track').classList.toggle('active',tab==='track');
  document.getElementById('tab-album').classList.toggle('active',tab==='album');
  document.getElementById('panel-track').classList.toggle('hidden',tab!=='track');
  document.getElementById('panel-album').classList.toggle('hidden',tab==='track');
}

// ─── REAL API — tracks are stored permanently in Postgres + Cloudflare R2 ────
// Visible to every visitor, on every device, forever.
const API_BASE = ''; // same-origin — server serves both site and API

async function fetchTracksAndAlbums(){
  try {
    const [tRes, aRes] = await Promise.all([
      fetch(`${API_BASE}/api/tracks`),
      fetch(`${API_BASE}/api/albums`)
    ]);
    tracks = await tRes.json();
    albums = await aRes.json();
  } catch(e){
    console.error('Failed to load tracks/albums from server', e);
    tracks = []; albums = [];
  }
}

function getCreatorAuthHeader(){
  return `${CREATOR_EMAIL_STORED}:${CREATOR_PASSWORD_STORED}`;
}
let CREATOR_EMAIL_STORED = '';
let CREATOR_PASSWORD_STORED = '';

// ─── Single track upload ──────────────────────────────────────────────────────
function handleAudioFile(input){
  const file=input.files[0]; if(!file)return;
  pendingUploadFile=file;
  document.getElementById('upload-zone-wrap').classList.add('hidden');
  document.getElementById('track-meta-form').classList.remove('hidden');
  document.getElementById('meta-title').value=file.name.replace(/\.[^/.]+$/,'');
  document.getElementById('meta-genre').value='Trap';
}
async function saveTrack(){
  const title=document.getElementById('meta-title').value.trim();
  const genre=document.getElementById('meta-genre').value.trim();
  const bpm=document.getElementById('meta-bpm').value;
  if(!title||!genre){alert('Title and genre are required');return;}
  if(!pendingUploadFile){alert('Please select an audio file');return;}

  document.getElementById('track-meta-form').classList.add('hidden');
  document.getElementById('upload-progress-overlay').classList.remove('hidden');
  document.getElementById('upload-progress-bar').style.width='40%';

  try {
    const fd = new FormData();
    fd.append('audio', pendingUploadFile);
    fd.append('email', CREATOR_EMAIL_STORED);
    fd.append('password', CREATOR_PASSWORD_STORED);
    fd.append('title', title);
    fd.append('genre', genre);
    if(bpm) fd.append('bpm', bpm);

    const res = await fetch(`${API_BASE}/api/tracks/upload`, { method:'POST', body: fd });
    document.getElementById('upload-progress-bar').style.width='100%';
    if(!res.ok){ const err=await res.json(); throw new Error(err.error||'Upload failed'); }
    await fetchTracksAndAlbums();
  } catch(e){
    alert('Upload failed: '+e.message);
  } finally {
    document.getElementById('upload-progress-overlay').classList.add('hidden');
    cancelMeta(); updateStats(); renderAll();
  }
}
function cancelMeta(){
  document.getElementById('upload-zone-wrap').classList.remove('hidden');
  document.getElementById('track-meta-form').classList.add('hidden');
  ['meta-title','meta-genre','meta-bpm'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('audio-file-input').value='';
  pendingUploadFile=null; pendingUploadObjectPath=null;
}

// ─── Album upload ─────────────────────────────────────────────────────────────
function handleCover(input){
  const file=input.files[0]; if(!file)return;
  pendingCoverFile=file; pendingCoverPreview=URL.createObjectURL(file);
  const p=document.getElementById('cover-preview');
  p.style.border='none'; p.innerHTML=`<img src="${pendingCoverPreview}" style="width:100%;height:100%;object-fit:cover" />`;
}
function handleAlbumTracks(input){
  Array.from(input.files||[]).forEach(file=>{
    pendingAlbumTracks.push({id:albumTrackIdCounter++,file,
      objectPath:URL.createObjectURL(file),
      title:file.name.replace(/\.[^/.]+$/,''),genre:'Trap',bpm:'',
      trackNumber:pendingAlbumTracks.length+1,status:'done'});
  });
  renderAlbumTrackList();
  document.getElementById('album-track-count').textContent=pendingAlbumTracks.length;
  input.value='';
}
function renderAlbumTrackList(){
  const wrap=document.getElementById('album-track-list');
  if(pendingAlbumTracks.length===0){
    wrap.innerHTML=`<label style="cursor:pointer;display:block"><input type="file" accept="audio/*" multiple class="hidden" onchange="handleAlbumTracks(this)" /><div style="border:2px dashed rgba(160,32,255,0.2);border-radius:12px;padding:32px;text-align:center;color:var(--muted)"><div style="font-size:1.5rem;margin-bottom:8px;opacity:.5">🎵</div><p style="font-size:.875rem">Click to add tracks</p></div></label>`;
    return;
  }
  wrap.innerHTML=pendingAlbumTracks.map(pt=>`
    <div style="padding:12px;border-radius:12px;border:1px solid rgba(160,32,255,0.2);background:rgba(160,32,255,0.04);margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:24px;height:24px;border-radius:50%;background:rgba(160,32,255,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:var(--primary-bright)">${pt.trackNumber}</span>
        <span style="color:#4ade80;font-size:.75rem;font-weight:600">✓ Ready</span>
        <button onclick="removeAlbumTrack(${pt.id})" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1rem">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <input class="form-input" style="height:34px;font-size:.8rem" value="${escHtml(pt.title)}" onchange="updateAlbumTrack(${pt.id},'title',this.value)" placeholder="Track title" />
        <input class="form-input" style="height:34px;font-size:.8rem" value="${escHtml(pt.genre)}" onchange="updateAlbumTrack(${pt.id},'genre',this.value)" placeholder="Genre" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <input class="form-input" style="height:34px;font-size:.8rem" type="number" value="${pt.bpm}" onchange="updateAlbumTrack(${pt.id},'bpm',this.value)" placeholder="BPM (optional)" />
        <input class="form-input" style="height:34px;font-size:.8rem" type="number" value="${pt.trackNumber}" onchange="updateAlbumTrack(${pt.id},'trackNumber',parseInt(this.value)||1)" placeholder="Track #" />
      </div>
    </div>`).join('');
}
function updateAlbumTrack(id,field,value){const t=pendingAlbumTracks.find(t=>t.id===id);if(t)t[field]=value;}
function removeAlbumTrack(id){
  pendingAlbumTracks=pendingAlbumTracks.filter(t=>t.id!==id);
  pendingAlbumTracks.forEach((t,i)=>t.trackNumber=i+1);
  renderAlbumTrackList();
  document.getElementById('album-track-count').textContent=pendingAlbumTracks.length;
}
async function publishAlbum(){
  const title=document.getElementById('album-title').value.trim();
  const desc=document.getElementById('album-desc').value.trim();
  const year=document.getElementById('album-year').value;
  if(!title){alert('Album title is required');return;}
  if(pendingAlbumTracks.length===0){alert('Add at least one track');return;}

  const publishBtn = document.querySelector('#panel-album .btn-primary');
  const originalText = publishBtn.textContent;
  publishBtn.disabled = true; publishBtn.textContent = 'Publishing…';

  try {
    // 1. Create the album (with cover if provided)
    const albumFd = new FormData();
    albumFd.append('email', CREATOR_EMAIL_STORED);
    albumFd.append('password', CREATOR_PASSWORD_STORED);
    albumFd.append('title', title);
    albumFd.append('description', desc);
    if(year) albumFd.append('releaseYear', year);
    if(pendingCoverFile) albumFd.append('cover', pendingCoverFile);

    const albumRes = await fetch(`${API_BASE}/api/albums`, { method:'POST', body: albumFd });
    if(!albumRes.ok){ const err=await albumRes.json(); throw new Error(err.error||'Album creation failed'); }
    const newAlbum = await albumRes.json();

    // 2. Upload each track, linked to the new album
    for(const pt of pendingAlbumTracks){
      const trackFd = new FormData();
      trackFd.append('audio', pt.file);
      trackFd.append('email', CREATOR_EMAIL_STORED);
      trackFd.append('password', CREATOR_PASSWORD_STORED);
      trackFd.append('title', pt.title);
      trackFd.append('genre', pt.genre);
      if(pt.bpm) trackFd.append('bpm', pt.bpm);
      trackFd.append('albumId', newAlbum.id);
      trackFd.append('trackNumber', pt.trackNumber);

      const trackRes = await fetch(`${API_BASE}/api/tracks/upload`, { method:'POST', body: trackFd });
      if(!trackRes.ok){ console.error('One track failed to upload:', pt.title); }
    }

    pendingAlbumTracks=[]; pendingCoverFile=null; pendingCoverPreview=null;
    ['album-title','album-desc','album-year'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('cover-preview').innerHTML='🎨';
    document.getElementById('cover-preview').style.border='2px dashed rgba(255,255,255,0.2)';
    document.getElementById('album-track-count').textContent='0';
    renderAlbumTrackList();
    await fetchTracksAndAlbums();
    updateStats(); renderAll();
    alert(`Album "${title}" published! ✓`);
  } catch(e){
    alert('Failed to publish album: '+e.message);
  } finally {
    publishBtn.disabled = false; publishBtn.textContent = originalText;
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(){
  document.getElementById('stat-tracks').textContent=tracks.length;
  document.getElementById('stat-albums').textContent=albums.length;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderAll(){renderMusic();renderNowPlaying();}

function renderMusic(){
  const container=document.getElementById('music-content');
  const loose=tracks.filter(t=>!t.albumId);
  if(albums.length===0&&loose.length===0){
    container.innerHTML=`<div class="empty-state"><div style="font-size:2.5rem;margin-bottom:16px">🎵</div><p>No tracks dropped yet — check back soon.</p></div>`;
    return;
  }
  let html='';
  albums.forEach(album=>{
    const at=tracks.filter(t=>t.albumId===album.id).sort((a,b)=>(a.trackNumber||999)-(b.trackNumber||999));
    const coverHtml=album.coverObjectPath?`<img src="${album.coverObjectPath}" alt="${escHtml(album.title)}" style="width:100%;height:100%;object-fit:cover" />`:`<span style="font-size:1.8rem">💿</span>`;
    html+=`<div class="album-card">
      <div class="album-header">
        <div class="album-cover">${coverHtml}</div>
        <div class="album-info">
          <div class="album-badges">
            <span class="badge badge-primary" style="font-size:.65rem">ALBUM</span>
            ${album.releaseYear?`<span style="font-size:.75rem;color:var(--muted)">${album.releaseYear}</span>`:''}
          </div>
          <div class="album-title">${escHtml(album.title)}</div>
          ${album.description?`<div class="album-desc">${escHtml(album.description)}</div>`:''}
          <div class="album-tracks-count">${at.length} track${at.length!==1?'s':''}</div>
        </div>
        <div class="album-actions">
          ${isCreator?`<button class="collapse-btn" style="color:var(--destructive);border-color:rgba(255,68,85,0.3)" onclick="deleteAlbum(${album.id})">🗑</button>`:''}
          <button class="collapse-btn" onclick="toggleAlbum(${album.id})" id="collapse-${album.id}">▲</button>
        </div>
      </div>
      <div class="album-tracks" id="album-tracks-${album.id}">${at.map((t,i)=>renderAlbumTrackRow(t,i)).join('')}</div>
    </div>`;
  });
  if(loose.length>0){
    if(albums.length>0)html+=`<div style="display:flex;align-items:center;gap:12px;margin:32px 0 20px"><div style="height:1px;flex:1;background:rgba(160,32,255,0.15)"></div><span style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:700">Singles</span><div style="height:1px;flex:1;background:rgba(160,32,255,0.15)"></div></div>`;
    html+=`<div class="track-list">`;
    loose.forEach((t,i)=>{html+=renderTrackRow(t,i);});
    html+=`</div>`;
  }
  container.innerHTML=html;
}

function renderTrackRow(t,i){
  const active=t.id===currentTrackId,playing=active&&isPlaying;
  return `<div class="track-row${active?' active':''}" id="track-row-${t.id}">
    <div class="track-num">${String(i+1).padStart(2,'0')}</div>
    <button class="track-play-btn" onclick="playTrack(${t.id})">${playing?eqBarsHtml():playIcon()}</button>
    <div class="track-info"><div class="track-title">${escHtml(t.title)}</div><div class="track-meta">${escHtml(t.genre)}${t.bpm?` · ${t.bpm} BPM`:''}</div></div>
    <div class="track-duration">${t.duration||'--:--'}</div>
    ${isCreator?`<button onclick="deleteTrack(${t.id})" style="width:32px;height:32px;border-radius:50%;color:var(--destructive);background:none;border:none;opacity:0;transition:opacity .2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">🗑</button>`:''}
  </div>`;
}
function renderAlbumTrackRow(t,i){
  const active=t.id===currentTrackId,playing=active&&isPlaying;
  return `<div class="album-track${active?' active':''}" id="track-row-${t.id}">
    <div style="width:24px;text-align:center;font-size:.8rem;color:var(--muted)">${t.trackNumber??(i+1)}</div>
    <button class="track-play-btn" style="width:36px;height:36px" onclick="playTrack(${t.id})">${playing?eqBarsHtml():playIconSm()}</button>
    <div class="track-info"><div class="track-title">${escHtml(t.title)}</div><div class="track-meta">${escHtml(t.genre)}${t.bpm?` · ${t.bpm} BPM`:''}</div></div>
    <div class="track-duration">${t.duration||'--:--'}</div>
    ${isCreator?`<button onclick="deleteTrack(${t.id})" style="width:28px;height:28px;border-radius:50%;color:var(--destructive);background:none;border:none;opacity:0;transition:opacity .2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">🗑</button>`:''}
  </div>`;
}
function eqBarsHtml(){return `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`;}
function playIcon(){return `<svg style="width:14px;height:14px;fill:currentColor;margin-left:2px" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;}
function playIconSm(){return `<svg style="width:12px;height:12px;fill:currentColor;margin-left:2px" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;}
function toggleAlbum(id){
  const el=document.getElementById(`album-tracks-${id}`);
  const btn=document.getElementById(`collapse-${id}`);
  const hidden=el.style.display==='none';
  el.style.display=hidden?'':'none'; btn.textContent=hidden?'▲':'▼';
}

// ─── Now Playing ──────────────────────────────────────────────────────────────
function renderNowPlaying(){
  const section=document.getElementById('now-playing');
  if(!currentTrackId){section.classList.remove('visible');return;}
  const t=tracks.find(t=>t.id===currentTrackId); if(!t)return;
  section.classList.add('visible');
  document.getElementById('now-genre').textContent=t.genre;
  document.getElementById('now-title').textContent=t.title;
  document.getElementById('now-meta').textContent=`Relebogile Phatudi · ${t.bpm?t.bpm+' BPM':'Original'}`;
  document.getElementById('vinyl-bg').classList.toggle('spinning',isPlaying);
  document.getElementById('now-play-icon').innerHTML=isPlaying
    ?'<rect x="6" y="4" width="4" height="16" fill="white"/><rect x="14" y="4" width="4" height="16" fill="white"/>'
    :'<polygon points="5 3 19 12 5 21 5 3" fill="white"/>';
}

// ─── Playback ─────────────────────────────────────────────────────────────────
function playTrack(id){
  const t=tracks.find(t=>t.id===id);
  if(!t||!t.objectPath){alert('This track file is not available in this session. Please re-upload it from the Dashboard.');return;}
  // Native playback only — no Web Audio routing, guarantees reliable sound on every device
  if(currentTrackId===id){isPlaying?audio.pause():audio.play();isPlaying=!isPlaying;}
  else{currentTrackId=id;audio.src=t.objectPath;audio.play().catch(()=>{});isPlaying=true;}
  audio.loop=isLooping;
  updatePlayerUI();renderAll();
  document.getElementById('sticky-player').classList.add('visible');
}
function toggleCurrentTrack(){
  if(!currentTrackId)return;
  isPlaying?audio.pause():audio.play();
  isPlaying=!isPlaying;updatePlayerUI();renderAll();
}
function updatePlayerUI(){
  const t=tracks.find(t=>t.id===currentTrackId); if(!t)return;
  document.getElementById('player-title').textContent=t.title;
  document.getElementById('player-genre').textContent=`${t.genre}${t.bpm?' · '+t.bpm+' BPM':''}`;
  document.getElementById('vinyl-mini-disc').classList.toggle('spinning',isPlaying);
  document.getElementById('player-play-icon').innerHTML=isPlaying
    ?'<rect x="6" y="4" width="4" height="16" fill="white"/><rect x="14" y="4" width="4" height="16" fill="white"/>'
    :'<polygon points="5 3 19 12 5 21 5 3" fill="white"/>';
  document.getElementById('pulse1').classList.toggle('hidden',!isPlaying);
  document.getElementById('pulse2').classList.toggle('hidden',!isPlaying);
}
function skipTrack(dir){
  if(!tracks.length)return;
  const idx=tracks.findIndex(t=>t.id===currentTrackId);
  const next=isShuffling?Math.floor(Math.random()*tracks.length):(idx+dir+tracks.length)%tracks.length;
  playTrack(tracks[next].id);
}
function onTimeUpdate(){
  const cur=audio.currentTime,dur=audio.duration||0,pct=dur?(cur/dur)*100:0;
  document.getElementById('seek-fill').style.width=pct+'%';
  document.getElementById('seek-thumb').style.left=pct+'%';
  document.getElementById('time-display').textContent=`${formatTime(cur)} / ${formatTime(dur)}`;
}
function onEnded(){
  isPlaying=false;
  if(!isLooping&&(isShuffling||tracks.length>1))skipTrack(1);
  else{updatePlayerUI();renderAll();}
}
function seekTo(e){
  const rect=document.getElementById('seek-bar').getBoundingClientRect();
  if(!isNaN(audio.duration))audio.currentTime=((e.clientX-rect.left)/rect.width)*audio.duration;
}
function setVolume(v){audio.volume=parseFloat(v);}
function toggleLoop(){
  isLooping=!isLooping;audio.loop=isLooping;
  document.getElementById('loop-btn').classList.toggle('active',isLooping);
}
function toggleShuffle(){
  isShuffling=!isShuffling;
  document.getElementById('shuffle-btn').classList.toggle('active',isShuffling);
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteTrack(id){
  if(!confirm('Delete this track?'))return;
  try {
    const res = await fetch(`${API_BASE}/api/tracks/${id}`, {
      method:'DELETE',
      headers:{ 'x-creator-auth': getCreatorAuthHeader() }
    });
    if(!res.ok) throw new Error('Delete failed');
    if(currentTrackId===id){audio.pause();audio.src='';isPlaying=false;currentTrackId=null;document.getElementById('sticky-player').classList.remove('visible');}
    await fetchTracksAndAlbums(); updateStats(); renderAll();
  } catch(e){ alert('Failed to delete track: '+e.message); }
}
async function deleteAlbum(id){
  const album=albums.find(a=>a.id===id);
  if(!confirm(`Delete album "${album?.title}" and all its tracks?`))return;
  try {
    const res = await fetch(`${API_BASE}/api/albums/${id}`, {
      method:'DELETE',
      headers:{ 'x-creator-auth': getCreatorAuthHeader() }
    });
    if(!res.ok) throw new Error('Delete failed');
    if(tracks.filter(t=>t.albumId===id).map(t=>t.id).includes(currentTrackId)){
      audio.pause();audio.src='';isPlaying=false;currentTrackId=null;
      document.getElementById('sticky-player').classList.remove('visible');
    }
    await fetchTracksAndAlbums(); updateStats(); renderAll();
  } catch(e){ alert('Failed to delete album: '+e.message); }
}

// ─── EQ (temporarily disabled for playback reliability) ──────────────────────
function toggleEQ(){
  alert('The equalizer is temporarily unavailable while we ensure reliable playback across all devices. Coming back soon!');
}
function resetEQ(){}
function renderEQBands(){
  document.getElementById('eq-bands').innerHTML = '<p style="color:var(--muted);font-size:.8rem;text-align:center;padding:12px 0">Equalizer coming soon</p>';
}
function setEQ(){}
renderEQBands();

// ─── Visualizer ──────────────────────────────────────────────────────────────
const canvas=document.getElementById('visualizer-canvas');
const ctx2d=canvas.getContext('2d');
let animT=0;
(function draw(){
  requestAnimationFrame(draw);animT+=0.04;
  const W=canvas.width,H=canvas.height,BAR_COUNT=24,barW=Math.floor(W/BAR_COUNT)-1;
  ctx2d.clearRect(0,0,W,H);
  if(analyser&&isPlaying){
    const data=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    for(let i=0;i<BAR_COUNT;i++){
      const val=data[Math.floor((i/BAR_COUNT)*data.length*0.6)]/255;
      const bH=Math.max(2,val*H);
      const grad=ctx2d.createLinearGradient(0,H,0,H-bH);
      grad.addColorStop(0,'#A020FF');grad.addColorStop(1,'#00FFFF');
      ctx2d.fillStyle=grad;ctx2d.beginPath();ctx2d.roundRect(i*(barW+1),H-bH,barW,bH,1);ctx2d.fill();
    }
  } else {
    for(let i=0;i<BAR_COUNT;i++){
      const bH=2+Math.abs(Math.sin(animT+i*0.4))*4;
      ctx2d.fillStyle='rgba(160,32,255,0.3)';
      ctx2d.beginPath();ctx2d.roundRect(i*(barW+1),H-bH,barW,Math.max(2,bH),1);ctx2d.fill();
    }
  }
})();

// ─── Booking form — Formspree ─────────────────────────────────────────────────
function setPurpose(btn){
  document.querySelectorAll('.purpose-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentPurpose=btn.dataset.val;
  document.getElementById('form-purpose').value=currentPurpose;
  if(currentPurpose==='promote'){
    document.getElementById('book-socials').classList.add('open');
    document.querySelector('.socials-toggle').textContent='▼ Add your social media links (optional)';
  }
}
function toggleBookSocials(){
  const panel=document.getElementById('book-socials');
  const btn=document.querySelector('.socials-toggle');
  panel.classList.toggle('open');
  btn.textContent=panel.classList.contains('open')
    ?'▼ Add your social media links (optional)'
    :'▶ Add your social media links (optional)';
}
async function handleBookingSubmit(e){
  e.preventDefault();
  const btn=document.getElementById('booking-submit-btn');
  btn.disabled=true; btn.textContent='Sending…';
  const form=document.getElementById('booking-form');
  const data=new FormData(form);
  try {
    const res=await fetch(form.action,{method:'POST',body:data,headers:{Accept:'application/json'}});
    const json=await res.json().catch(()=>({}));
    if(res.ok && json.success){
      document.getElementById('booking-form-wrap').classList.add('hidden');
      document.getElementById('booking-success').classList.remove('hidden');
    } else {
      document.getElementById('booking-error').textContent='Failed to send — please email rbeatz44@gmail.com directly.';
      document.getElementById('booking-error').classList.remove('hidden');
      btn.disabled=false; btn.textContent='Send Message to Relebogile';
    }
  } catch(err){
    document.getElementById('booking-error').textContent='Connection error — please try again or email rbeatz44@gmail.com';
    document.getElementById('booking-error').classList.remove('hidden');
    btn.disabled=false; btn.textContent='Send Message to Relebogile';
  }
}
function resetBooking(){
  document.getElementById('booking-form-wrap').classList.remove('hidden');
  document.getElementById('booking-success').classList.add('hidden');
  document.getElementById('booking-form').reset();
  document.getElementById('booking-submit-btn').disabled=false;
  document.getElementById('booking-submit-btn').textContent='Send Message to Relebogile';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(s){if(!s||isNaN(s))return '0:00';return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init(){
  await fetchTracksAndAlbums();
  updateFooterSocials();
  updateStats();
  renderAll();
  // Restore creator session if still active in this browser tab
  const savedEmail = sessionStorage.getItem('rb_creator_email');
  const savedPass = sessionStorage.getItem('rb_creator_pass');
  if(savedEmail && savedPass){
    CREATOR_EMAIL_STORED = savedEmail; CREATOR_PASSWORD_STORED = savedPass;
    isCreator = true; applyCreatorMode(); renderAll();
  }
})();
