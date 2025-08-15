(async function(){
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>Array.from(c.querySelectorAll(s));

  const params = new URLSearchParams(location.search);
  const section = (params.get('section')||'').toLowerCase();
  const manifest = await fetch('manifest.json').then(r=>r.json());

  const title = manifest.title || 'Playbook';
  $('#brandTitle').textContent = title;

  const map = manifest.sections || {};
  const src = map[section];
  if(!src){ $('#doc').innerHTML = `<p>Unknown section: <code>${section}</code>.</p>`; return; }

  $('#downloadRaw').href = src; $('#viewRaw').href = src;

  // Fetch export and sanitize
  const res = await fetch(src);
  if(!res.ok){ $('#doc').innerHTML = `<pre>Failed to load ${src} (HTTP ${res.status})</pre>`; return; }
  const raw = await res.text();
  const parser = new DOMParser(); const parsed = parser.parseFromString(raw,'text/html');
  const root = parsed.querySelector('article.page') || parsed.body;

  root.querySelectorAll('style,link[rel="stylesheet"]').forEach(n=>n.remove()); // decouple CSS
  root.querySelectorAll('[class*="table_of_contents"], [id*="table_of_contents"], [class*="toc"], nav[role="navigation"]').forEach(n=>n.remove()); // drop export TOC

  // Ensure heading IDs and self-links
  const slug = s=> (s||'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')||'section';
  const seen = new Set();
  $$('h1,h2,h3,h4', root).forEach(h=>{
    if(!h.id){ let id=slug(h.textContent); let i=2; while(seen.has(id)) id=`${id}-${i++}`; h.id=id; seen.add(id); }
    if(!h.querySelector(':scope > a.anchor-link')){ const a=document.createElement('a'); a.href=`#${h.id}`; a.className='anchor-link'; a.textContent=' '; h.appendChild(a); }
  });

  // Mount
  const docMount = $('#doc');
  docMount.innerHTML=''; docMount.append(...Array.from(root.childNodes));

  // Build TOC from h2/h3
  const toc = $('#toc'); toc.innerHTML='';
  const heads = $$('h2,h3', docMount);
  heads.forEach(h=>{
    const a=document.createElement('a'); a.href=`#${h.id}`; a.textContent=h.textContent.trim(); a.className=`toc-link toc-l${h.tagName==='H2'?2:3}`;
    toc.appendChild(a);
  });
  const links = $$('.toc-link', toc);
  const byId = Object.fromEntries(links.map(a=>[a.getAttribute('href').slice(1), a]));
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ const id=e.target.id; links.forEach(a=>a.classList.toggle('active', a===byId[id])); }
    });
  }, {rootMargin:'-40% 0% -50% 0%', threshold:[0,1e-6]});
  heads.forEach(h=>obs.observe(h));

  // Progress bar
  const progress = $('#progressBar');
  const onScroll = ()=>{
    const max = docMount.scrollHeight - window.innerHeight;
    const pct = Math.max(0, Math.min(1, (window.scrollY) / (max || 1)));
    progress.style.width = (pct*100).toFixed(2)+'%';
  };
  document.addEventListener('scroll', onScroll, {passive:true}); onScroll();

  // Search (naive highlight)
  $('#docSearch').addEventListener('input', e=>{
    const q=(e.target.value||'').trim();
    $$('mark', docMount).forEach(m=>{ const t=document.createTextNode(m.textContent); m.replaceWith(t); });
    if(q.length<2) return;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i');
    $$('h1,h2,h3,p,li', docMount).forEach(node=>{
      const i = node.textContent.toLowerCase().indexOf(q.toLowerCase());
      if(i>=0){
        const before=node.textContent.slice(0,i), hit=node.textContent.slice(i,i+q.length), after=node.textContent.slice(i+q.length);
        const frag=document.createDocumentFragment();
        frag.append(document.createTextNode(before));
        const mark=document.createElement('mark'); mark.textContent=hit; frag.append(mark);
        frag.append(document.createTextNode(after));
        node.textContent=''; node.appendChild(frag);
      }
    });
  });

  // Theme toggle
  const storageKey='playbook-theme';
  const saved=localStorage.getItem(storageKey); if(saved) document.documentElement.dataset.theme=saved;
  $('#themeToggle').onclick=()=>{
    const next=document.documentElement.dataset.theme==='light'?'dark':
                document.documentElement.dataset.theme==='dark'?'':'light';
    document.documentElement.dataset.theme=next;
    if(next) localStorage.setItem(storageKey,next); else localStorage.removeItem(storageKey);
  };
})();
