// Router + sectionized reader
(async function(){
  const $ = (s, c=document)=>c.querySelector(s);
  const $$ = (s, c=document)=>Array.from(c.querySelectorAll(s));

  const brandTitle = $('#brandTitle');
  const footerTitle = $('#footerTitle');
  const landing = $('#landing');
  const landingGrid = $('#landingGrid');
  const readerLayout = $('#readerLayout');
  const docMount = $('#doc');
  const tocNav = $('#toc');
  const progress = $('#progressBar');

  const manifest = await fetch('manifest.json').then(r=>r.json());
  const siteTitle = manifest.title || 'Playbook';
  brandTitle.textContent = siteTitle; footerTitle.textContent = siteTitle;
  $('#downloadRaw').href = manifest.export_html; $('#viewRaw').href = manifest.export_html;

  // Utilities
  const slugify = (s)=> (s||'').toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-') || 'section';

  const ensureHeadingIds = (root)=>{
    const seen = new Set();
    $$('h1,h2,h3,h4', root).forEach(h=>{
      if(!h.id){
        let id = slugify(h.textContent);
        let i=2; while(seen.has(id)){ id = `${id}-${i++}`; }
        h.id = id; seen.add(id);
      }
      // add self-link
      if(!h.querySelector(':scope > a.anchor-link')){
        const a = document.createElement('a');
        a.href = `#${h.id}`; a.className = 'anchor-link'; a.textContent = ' ';
        h.appendChild(a);
      }
    });
  };

  const removeExportTOC = (root)=>{
    $$('[id*="toc" i],[class*="toc" i],nav[role="navigation"]', root).forEach(n=>n.remove());
  };

  // Load sections.json if present; otherwise split client-side
  let sectionsData = null;
  async function loadSections(){
    try{
      const res = await fetch('data/sections.json');
      if(res.ok){ sectionsData = await res.json(); return; }
    }catch {}
    // Fallback: parse export in browser
    const raw = await fetch(manifest.export_html).then(r=>r.text());
    const parser = new DOMParser(); const doc = parser.parseFromString(raw,'text/html');
    const body = doc.querySelector('article.page') || doc.body;
    // remove style/link to avoid conflicts
    body.querySelectorAll('style,link[rel="stylesheet"]').forEach(n=>n.remove());
    const h1s = $$('h1', body);
    if(!h1s.length){
      sectionsData = { sections: [{title:'Document', slug:'document', html: body.innerHTML}] };
      return;
    }
    const tmp = document.createElement('div'); tmp.innerHTML = '';
    const nodes = Array.from(body.childNodes);
    const idxs = nodes
      .map((n,i)=> n.nodeType===1 && n.tagName==='H1' ? i : -1)
      .filter(i=>i>=0);

    const sections = [];
    for(let s=0; s<idxs.length; s++){
      const start = idxs[s];
      const end = s+1<idxs.length ? idxs[s+1] : nodes.length;
      const frag = document.createDocumentFragment();
      for(let i=start;i<end;i++){ frag.appendChild(nodes[i].cloneNode(true)); }
      tmp.innerHTML = ''; tmp.appendChild(frag);
      const title = (tmp.querySelector('h1')?.textContent || `Section ${s+1}`).trim();
      sections.push({ title, slug: slugify(title), html: tmp.innerHTML });
    }
    sectionsData = { sections };
  }
  await loadSections();

  const sectionBySlug = Object.fromEntries(sectionsData.sections.map(s=>[s.slug, s]));

  // Build landing with four target buttons
  const targets = [
    {key:'scale',  label:'SCALE'},
    {key:'hire',   label:'HIRE'},
    {key:'train',  label:'TRAIN'},
    {key:'reflect',label:'REFLECT'},
  ];
  function matchSection(key){
    // direct match over slug/title; for REFLECT fallback to FIRE
    const pool = sectionsData.sections;
    let cand = pool.find(s=>s.slug.includes(key) || s.title.toLowerCase().includes(key));
    if(!cand && key==='reflect'){
      cand = pool.find(s=>/fire/i.test(s.title) || /fire/.test(s.slug));
    }
    return cand || pool[0];
  }
  function buildLanding(){
    landingGrid.innerHTML = '';
    targets.forEach(t=>{
      const sec = matchSection(t.key);
      const a = document.createElement('a');
      a.className = 'quad-btn';
      a.href = `#/s/${sec.slug}`;
      a.textContent = t.label;
      landingGrid.appendChild(a);
    });
  }

  // Render section into reader
  function buildTOC(root){
    tocNav.innerHTML = '';
    const heads = $$('h2,h3', root);
    heads.forEach(h=>{
      const level = +h.tagName.substring(1);
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent.trim();
      a.className = `toc-link toc-l${Math.min(level,3)}`;
      tocNav.appendChild(a);
    });
    const links = $$('.toc-link', tocNav);
    const byId = Object.fromEntries(links.map(a=>[a.getAttribute('href').slice(1), a]));
    const obs = new IntersectionObserver(entries=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          const id = e.target.id;
          links.forEach(a=>a.classList.toggle('active', a===byId[id]));
          history.replaceState(null, '', `#/${currentRoute?.path||''}${id ? `#${id}`:''}`);
        }
      });
    }, {rootMargin:'-40% 0% -50% 0%', threshold:[0,1e-6]});
    heads.forEach(h=>obs.observe(h));
  }

  function renderSection(slug){
    const sec = sectionBySlug[slug] || sectionsData.sections[0];
    const wrap = document.createElement('div');
    wrap.innerHTML = sec.html;
    removeExportTOC(wrap);
    ensureHeadingIds(wrap);

    docMount.innerHTML = '';
    // If the first element is H1, demote it visually since the page already has a title in header
    const first = wrap.querySelector('h1');
    if(first){ first.style.marginTop = '0.2rem'; }
    docMount.append(...Array.from(wrap.childNodes));

    // TOC from h2/h3
    buildTOC(docMount);

    // switch views
    landing.hidden = true;
    readerLayout.hidden = false;
    document.documentElement.scrollTo({top:0,left:0,behavior:'instant'});
    onScroll(); // refresh progress
  }

  // Progress bar
  const onScroll = ()=>{
    const max = docMount.scrollHeight - window.innerHeight;
    const pct = Math.max(0, Math.min(1, (window.scrollY) / (max || 1)));
    progress.style.width = (pct*100).toFixed(2)+'%';
  };
  document.addEventListener('scroll', onScroll, {passive:true});

  // Search
  const searchInput = $('#docSearch');
  searchInput.addEventListener('input', (e)=>{
    const q = (e.target.value||'').trim();
    // naive highlight in visible article
    $$('mark', docMount).forEach(m=>{ const t=document.createTextNode(m.textContent); m.replaceWith(t); });
    if(q.length<2) return;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    $$('h1,h2,h3,p,li', docMount).forEach(node=>{
      const m = node.textContent.match(re);
      if(m){
        const idx = node.textContent.toLowerCase().indexOf(q.toLowerCase());
        if(idx>=0){
          const before = node.textContent.slice(0, idx);
          const hit = node.textContent.slice(idx, idx+q.length);
          const after = node.textContent.slice(idx+q.length);
          const frag = document.createDocumentFragment();
          frag.append(before?document.createTextNode(before):document.createTextNode(''));
          const tag = document.createElement('mark'); tag.textContent = hit; frag.append(tag);
          frag.append(after?document.createTextNode(after):document.createTextNode(''));
          node.textContent = ''; node.appendChild(frag);
        }
      }
    });
  });

  // Theme toggle
  const themeToggle = $('#themeToggle'); const storageKey = 'playbook-theme';
  const setTheme = (t)=>{ document.documentElement.dataset.theme = t; };
  const saved = localStorage.getItem(storageKey); if(saved) setTheme(saved);
  themeToggle.addEventListener('click', ()=>{
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' :
                 document.documentElement.dataset.theme === 'dark' ? '' : 'light';
    document.documentElement.dataset.theme = next;
    if(next) localStorage.setItem(storageKey, next); else localStorage.removeItem(storageKey);
  });

  // Simple hash router
  let currentRoute = null;
  function route(){
    const h = location.hash || '#/';
    const m = h.match(/^#\/s\/([^#]+)/);
    if(m){
      currentRoute = {view:'section', path:`s/${m[1]}`};
      renderSection(decodeURIComponent(m[1]));
    }else{
      currentRoute = {view:'landing', path:''};
      buildLanding();
      landing.hidden = false; readerLayout.hidden = true;
    }
  }
  window.addEventListener('hashchange', route);

  // Initial render
  route();

  // If there’s a deep-link anchor after the section, scroll to it
  if(location.hash.includes('#/s/')){
    const anchor = location.hash.split('#/s/')[1].split('#')[1];
    if(anchor){
      const el = document.getElementById(anchor);
      if(el) setTimeout(()=> el.scrollIntoView({behavior:'instant', block:'start'}), 0);
    }
  }
})();
