(async function(){
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>Array.from(c.querySelectorAll(s));

  const params = new URLSearchParams(location.search);
  const section = (params.get('section')||'').toLowerCase();
  const manifest = await fetch('manifest.json').then(r=>r.json());

  const title = manifest.title || 'Scale, Hire, Train, Fire';
  const brandTitle = $('#brandTitle');
  if (brandTitle) brandTitle.textContent = title;
  
  // Update page title and breadcrumb
  const sectionTitles = {
    'scale': 'Scale',
    'hire': 'Hire', 
    'train': 'Train',
    'fire': 'Fire',
    'reflect': 'Reflect',
    'references': 'References'
  };
  
  const sectionTitle = sectionTitles[section] || section;
  document.title = sectionTitle ? `${sectionTitle} - ${title}` : title;
  
  const currentSection = $('#currentSection');
  if (currentSection) {
    currentSection.textContent = sectionTitle || 'Unknown Section';
  }

  const map = manifest.sections || {};
  const src = map[section];
  
  // Show error state if section not found
  if(!src){ 
    const docElement = $('#doc');
    if (docElement) {
      docElement.innerHTML = `
        <div class="error-state">
          <h2>Section Not Found</h2>
          <p>The section <code>${section}</code> could not be found.</p>
          <a href="index.html" class="cta-button">← Back to Home</a>
        </div>
      `;
    }
    return; 
  }

  const downloadRaw = $('#downloadRaw');
  const viewRaw = $('#viewRaw');
  if (downloadRaw) downloadRaw.href = src;
  if (viewRaw) viewRaw.href = src;

  // Fetch export and sanitize
  try {
    const res = await fetch(src);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const raw = await res.text();
    const parser = new DOMParser(); 
    const parsed = parser.parseFromString(raw,'text/html');
    const root = parsed.querySelector('article.page') || parsed.body;

    // Clean up the content
    $$('style,link[rel="stylesheet"]', root).forEach(n=>n.remove());
    $$('[class*="table_of_contents"], [id*="table_of_contents"], [class*="toc"], nav[role="navigation"]', root).forEach(n=>n.remove());

    // Ensure heading IDs and self-links
    const slug = s=> (s||'').toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-')||'section';
    const seen = new Set();
    $$('h1,h2,h3,h4', root).forEach(h=>{
      if(!h.id){ 
        let id=slug(h.textContent); 
        let i=2; 
        while(seen.has(id)) id=`${id}-${i++}`; 
        h.id=id; 
        seen.add(id); 
      }
      if(!h.querySelector(':scope > a.anchor-link')){ 
        const a=document.createElement('a'); 
        a.href=`#${h.id}`; 
        a.className='anchor-link'; 
        a.textContent='#'; 
        h.appendChild(a); 
      }
    });

    // Mount content
    const docMount = $('#doc');
    if (docMount) {
      docMount.innerHTML=''; 
      docMount.append(...Array.from(root.childNodes));
    }

    // Build enhanced TOC from h2/h3
    const toc = $('#toc');
    if (toc) {
      toc.innerHTML='';
      const heads = $$('h2,h3', docMount);
      
      if (heads.length === 0) {
        toc.innerHTML = '<div class="toc-empty">No headings found</div>';
      } else {
        heads.forEach(h=>{
          const a=document.createElement('a'); 
          a.href=`#${h.id}`; 
          a.textContent=h.textContent.trim(); 
          a.className=`toc-link toc-l${h.tagName==='H2'?2:3}`;
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.getElementById(h.id);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              // Update URL without page reload
              history.pushState(null, null, `#${h.id}`);
            }
          });
          toc.appendChild(a);
        });
      }

      // Enhanced intersection observer for active states
      const links = $$('.toc-link', toc);
      const byId = Object.fromEntries(links.map(a=>[a.getAttribute('href').slice(1), a]));
      const obs = new IntersectionObserver(entries=>{
        entries.forEach(e=>{
          if(e.isIntersecting){ 
            const id=e.target.id; 
            links.forEach(a=>a.classList.toggle('active', a===byId[id])); 
          }
        });
      }, {rootMargin:'-20% 0% -60% 0%', threshold:[0,0.1]});
      heads.forEach(h=>obs.observe(h));
    }

  } catch (error) {
    const docElement = $('#doc');
    if (docElement) {
      docElement.innerHTML = `
        <div class="error-state">
          <h2>Failed to Load Content</h2>
          <p>Could not load content from <code>${src}</code></p>
          <p class="error-details">${error.message}</p>
          <a href="index.html" class="cta-button">← Back to Home</a>
        </div>
      `;
    }
    return;
  }

  // Enhanced progress tracking
  const progress = $('#progressBar');
  const progressCircle = $('#progressCircle');
  const progressPercent = $('#progressPercent');
  const docMount = $('#doc');
  
  const updateProgress = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.max(0, Math.min(1, scrollTop / (docHeight || 1)));
    const percentage = Math.round(scrollPercent * 100);
    
    // Linear progress bar
    if (progress) progress.style.width = `${percentage}%`;
    
    // Circular progress
    if (progressCircle && progressPercent) {
      const circumference = 113; // 2 * π * 18
      const offset = circumference - (scrollPercent * circumference);
      progressCircle.style.strokeDashoffset = offset;
      progressPercent.textContent = `${percentage}%`;
    }
  };
  
  document.addEventListener('scroll', updateProgress, {passive:true}); 
  updateProgress();

  // Enhanced search with better highlighting
  const docSearch = $('#docSearch');
  if (docSearch) {
    docSearch.addEventListener('input', e=>{
      const q=(e.target.value||'').trim();
      
      // Clear previous highlights
      $$('mark', docMount).forEach(m=>{ 
        const t=document.createTextNode(m.textContent); 
        m.replaceWith(t); 
      });
      
      if(q.length<2) {
        // Remove search results indicator when query is too short
        const resultsIndicator = $('.search-results');
        if (resultsIndicator) resultsIndicator.remove();
        return;
      }
      
      // Find and highlight matches
      const searchTerms = q.toLowerCase().split(/\s+/).filter(term => term.length > 1);
      let matchCount = 0;
      
      $$('h1,h2,h3,p,li', docMount).forEach(node=>{
        const text = node.textContent.toLowerCase();
        const hasMatch = searchTerms.some(term => text.includes(term));
        
        if (hasMatch) {
          const originalText = node.textContent;
          let highlightedText = originalText;
          
          searchTerms.forEach(term => {
            const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
          });
          
          if (highlightedText !== originalText) {
            node.innerHTML = highlightedText;
            matchCount++;
          }
        }
      });
      
      // Show search results count
      const searchContainer = $('.search-container');
      let resultsIndicator = $('.search-results');
      if (resultsIndicator) resultsIndicator.remove();
      
      if (q.length >= 2 && searchContainer) {
        resultsIndicator = document.createElement('div');
        resultsIndicator.className = 'search-results';
        resultsIndicator.textContent = `${matchCount} matches`;
        searchContainer.appendChild(resultsIndicator);
      }
    });
  }

  // Sidebar toggle for mobile
  const sidebarToggle = $('#sidebarToggle');
  const sidebar = $('#sidebar');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && 
          !sidebar.contains(e.target) && 
          !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Header scroll effect
  const header = $('#header');
  let lastScrollY = window.scrollY;
  
  if (header) {
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 100) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      
      lastScrollY = currentScrollY;
    });
  }

  // Setup navigation between sections
  const setupNavigation = () => {
    const sectionOrder = ['scale', 'hire', 'train', 'fire', 'reflect', 'references'];
    const currentIndex = sectionOrder.indexOf(section);
    const navigation = $('#docNavigation');
    const prevNav = $('#navPrev');
    const nextNav = $('#navNext');
    
    if (currentIndex === -1 || !navigation) return;
    
    let hasNav = false;
    
    // Setup previous navigation
    if (currentIndex > 0 && prevNav) {
      const prevSection = sectionOrder[currentIndex - 1];
      const prevTitle = sectionTitles[prevSection] || prevSection;
      prevNav.href = `reader.html?section=${prevSection}`;
      const prevNavTitle = prevNav.querySelector('.nav-title');
      if (prevNavTitle) prevNavTitle.textContent = prevTitle;
      prevNav.style.display = 'flex';
      hasNav = true;
    } else if (prevNav) {
      prevNav.style.display = 'none';
    }
    
    // Setup next navigation
    if (currentIndex < sectionOrder.length - 1 && nextNav) {
      const nextSection = sectionOrder[currentIndex + 1];
      const nextTitle = sectionTitles[nextSection] || nextSection;
      nextNav.href = `reader.html?section=${nextSection}`;
      const nextNavTitle = nextNav.querySelector('.nav-title');
      if (nextNavTitle) nextNavTitle.textContent = nextTitle;
      nextNav.style.display = 'flex';
      hasNav = true;
    } else if (nextNav) {
      nextNav.style.display = 'none';
    }
    
    if (hasNav) {
      navigation.style.display = 'grid';
    }
  };
  
  setupNavigation();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = $('#docSearch');
      if (searchInput) searchInput.focus();
    }
    
    // Escape to clear search or close sidebar
    if (e.key === 'Escape') {
      const searchInput = $('#docSearch');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      } else if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    }
    
    // Arrow keys for navigation
    if (e.altKey) {
      if (e.key === 'ArrowLeft') {
        const prevLink = $('#navPrev');
        if (prevLink && prevLink.style.display !== 'none') {
          window.location.href = prevLink.href;
        }
      } else if (e.key === 'ArrowRight') {
        const nextLink = $('#navNext');
        if (nextLink && nextLink.style.display !== 'none') {
          window.location.href = nextLink.href;
        }
      }
    }
  });

  // Smooth scroll to hash on load
  if (window.location.hash) {
    setTimeout(() => {
      const target = document.querySelector(window.location.hash);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  // Add loading complete class for animations
  setTimeout(() => {
    document.body.classList.add('content-loaded');
  }, 100);

})();