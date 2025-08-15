// Decoupled client runtime for Playbook wrapper
(async function(){
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  // Load manifest to resolve current HTML export filename
  const manifest = await fetch('manifest.json').then(r=>r.json()).catch(()=>null);
  if(!manifest || !manifest.export_html){
    $('#doc').innerHTML = '<p>Missing manifest.json or export_html pointer.</p>';
    return;
  }
  const exportHref = manifest.export_html;
  const title = manifest.title || 'Playbook';
  $('#brandTitle').textContent = title;
  $('#footerTitle').textContent = title;
  $('#downloadRaw').href = exportHref;
  $('#viewRaw').href = exportHref;

  // Fetch export HTML
  const raw = await fetch(exportHref).then(r=>r.text());

  // Parse export. Remove any <style> and <link> in head to avoid conflicts.
  const parser = new DOMParser();
  const docParsed = parser.parseFromString(raw, 'text/html');

  // Prefer the main article if present, else fall back to body
  let fragment = docParsed.querySelector('article.page') || docParsed.body;

  // Clone to avoid live node moves; strip style/link tags inside the fragment
  fragment = fragment.cloneNode(true);
  fragment.querySelectorAll('style, link[rel="stylesheet"]').forEach(n=>n.remove());

  // Normalize anchors: ensure headings have predictable IDs
  const mkId = s => s.toLowerCase()
                     .replace(/[^a-z0-9\s-]/g,'')
                     .trim().replace(/\s+/g,'-')
  $$('h1,h2,h3,h4', fragment).forEach(h=>{
    if(!h.id || h.id.length < 3){
      h.id = mkId(h.textContent || 'section');
    }
    // add self-link
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.className = 'anchor-link';
    a.textContent = ' ';
    h.appendChild(a);
  });

  // Inject into wrapper
  const docMount = $('#doc');
  docMount.innerHTML = '';
  docMount.appendChild(fragment);

  // Build a sidebar TOC from headings within the article
  const toc = $('#toc');
  const headings = $$('h1,h2,h3', docMount);
  headings.forEach(h=>{
    const level = +h.tagName.substring(1);
    const li = document.createElement('a');
    li.href = `#${h.id}`;
    li.textContent = h.textContent.replace(/\s*$/,''); // trim trailing spaces from anchor
    li.className = `toc-link toc-l${Math.min(level,3)}`;
    toc.appendChild(li);
  });

  // Scrollspy for active section
  const links = $$('.toc-link', toc);
  const byId = Object.fromEntries(links.map(a=>[a.getAttribute('href').slice(1), a]));
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const id = e.target.id;
        links.forEach(a=>a.classList.toggle('active', a===byId[id]));
        history.replaceState(null, '', `#${id}`);
      }
    });
  }, {rootMargin: '-40% 0% -50% 0%', threshold: [0, 1e-6]});
  headings.forEach(h=>obs.observe(h));

  // Progress bar
  const progress = $('#progressBar');
  const onScroll = () => {
    const el = docMount;
    const max = el.scrollHeight - window.innerHeight;
    const pct = Math.max(0, Math.min(1, (window.scrollY) / (max || 1)));
    progress.style.width = (pct*100).toFixed(2)+'%';
  };
  document.addEventListener('scroll', onScroll, {passive:true}); onScroll();

  // Keyboard nav
  document.addEventListener('keydown', (e)=>{
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
    if(e.key === 'ArrowRight'){ focusNextHeading(+1); }
    if(e.key === 'ArrowLeft'){ focusNextHeading(-1); }
    if(e.key === '/'){ e.preventDefault(); $('#docSearch').focus(); }
  });
  function focusNextHeading(step){
    const idx = headings.findIndex(h => h.id === location.hash.slice(1));
    const next = headings[Math.max(0, Math.min(headings.length-1, (idx<0?0:idx)+step))];
    if(next){ next.scrollIntoView({behavior:'smooth', block:'start'}); }
  }

  // Search (simple client-side contains over headings + paragraphs)
  const searchInput = $('#docSearch');
  let lastMarks = [];
  function clearMarks(){
    lastMarks.forEach(m=>{
      const parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
    lastMarks = [];
  }
  function mark(el){
    const span = document.createElement('mark');
    span.textContent = el.textContent;
    lastMarks.push(span);
    el.replaceWith(span);
  }
  function search(q){
    clearMarks();
    if(!q || q.length<2) return;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matches = [];
    $$('h1,h2,h3,p,li', docMount).forEach(node=>{
      const m = node.textContent.match(re);
      if(m){
        // split text and wrap the match
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
          lastMarks.push(tag);
          matches.push(node);
        }
      }
    });
    if(matches[0]) matches[0].scrollIntoView({behavior:'smooth', block:'center'});
  }
  searchInput.addEventListener('input', (e)=> search(e.target.value));

  // Theme toggle with persistence
  const themeToggle = $('#themeToggle');
  const storageKey = 'playbook-theme';
  const setTheme = (t)=>{
    document.documentElement.dataset.theme = t;
  };
  const saved = localStorage.getItem(storageKey);
  if(saved) setTheme(saved);
  themeToggle.addEventListener('click', ()=>{
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' :
                 document.documentElement.dataset.theme === 'dark' ? '' : 'light';
    document.documentElement.dataset.theme = next;
    if(next) localStorage.setItem(storageKey, next); else localStorage.removeItem(storageKey);
  });

  // Hash on load
  if(location.hash){
    const tgt = $(location.hash);
    if(tgt) setTimeout(()=>tgt.scrollIntoView({behavior:'instant', block:'start'}), 0);
  }
})();