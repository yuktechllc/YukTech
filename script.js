document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".site-header");
  const menuButton = document.querySelector("#menuToggle");
  const nav = document.querySelector("#primaryNav");
  const topButton = document.querySelector("#backToTop");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const updateScrollUI = () => {
    if (header) header.classList.toggle("scrolled", window.scrollY > 20);
    if (topButton) topButton.hidden = window.scrollY < 350;
  };
  updateScrollUI();
  window.addEventListener("scroll", updateScrollUI, { passive: true });

  const closeMenu = () => {
    if (!menuButton || !nav) return;
    nav.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    menuButton.innerHTML = "<span></span><span></span><span></span>";
  };
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = nav.classList.toggle("menu-open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      menuButton.innerHTML = open ? '<span class="menu-x">×</span>' : "<span></span><span></span><span></span>";
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", event => { if (event.key === "Escape") { closeMenu(); menuButton.focus(); } });
    document.addEventListener("click", event => { if (nav.classList.contains("menu-open") && !nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -25px 0px" });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add("is-visible"));
  }

  if (topButton) topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  const contactForm = document.querySelector("#contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", event => {
      if (!contactForm.checkValidity()) {
        event.preventDefault();
        contactForm.reportValidity();
        return;
      }
      const attachment = contactForm.querySelector('#contactAttachment');
      if (attachment && attachment.files.length && attachment.files[0].size > 10 * 1024 * 1024) {
        event.preventDefault();
        attachment.setCustomValidity('Please choose a file smaller than or equal to 10 MB.');
        attachment.reportValidity();
        attachment.setCustomValidity('');
        return;
      }
      if (attachment && !attachment.files.length) attachment.disabled = true;
      const submitButton = contactForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        submitButton.innerHTML = 'Submitting…';
      }
    });
  }

  const year = document.querySelector("#currentYear");
  if (year) year.textContent = new Date().getFullYear();


  // Accessible Services dropdown: click/tap, Escape, and close after choosing a link.
  document.querySelectorAll(".nav-dropdown").forEach(dropdown => {
    const toggle = dropdown.querySelector(".nav-dropdown-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", event => {
      event.stopPropagation();
      const open = dropdown.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    dropdown.querySelectorAll(".nav-dropdown-menu a").forEach(link => link.addEventListener("click", () => {
      dropdown.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { dropdown.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("click", event => {
      if (!dropdown.contains(event.target)) { dropdown.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
  });

});


/* Centred headings + intro lines stay on ONE line on desktop (font shrinks slightly if needed),
   and any justified paragraph that would show wide word gaps falls back to left-aligned. */
(function(){
  const FIT='main .section-intro h2, main .about-pillars-intro h2, main .section-intro p, main .about-pillars-intro p';
  const MAX_GAP = 0.75;                      // em; a normal space is about 0.28em
  function fit(){
    document.querySelectorAll(FIT).forEach(el=>{
      el.style.removeProperty('font-size');
      if (window.innerWidth<=768) return;
      const isH = el.tagName==='H2', min = isH ? 26 : 12.5;
      let fs=parseFloat(getComputedStyle(el).fontSize);
      const lh=()=>parseFloat(getComputedStyle(el).lineHeight)||fs*1.4;
      while (el.getBoundingClientRect().height > lh()*1.6 && fs>min){ fs-=0.5; el.style.setProperty('font-size',fs+'px','important'); }
    });
  }
  function maxGap(el){
    const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT), rects=[]; let n;
    while((n=tw.nextNode())){ const re=/\S+/g; let m; while((m=re.exec(n.nodeValue))){ const r=document.createRange(); r.setStart(n,m.index); r.setEnd(n,m.index+m[0].length); const c=r.getClientRects(); if(c.length) rects.push(c[0]); } }
    const fs=parseFloat(getComputedStyle(el).fontSize)||16; let max=0;
    for(let i=1;i<rects.length;i++){ const a=rects[i-1],b=rects[i]; if(Math.abs(a.top-b.top)<4) max=Math.max(max,(b.left-a.right)/fs); }
    return max;
  }
  function smartJustify(){
    const els=[...document.querySelectorAll('main p, main li')];
    els.forEach(e=>e.classList.remove('is-ragged'));
    if (window.innerWidth<=768) return;   // phones: stay justified (CSS hyphenation handles the gaps)
    els.forEach(e=>{
      if (e.querySelector('p,ul,ol,li')) return;
      const cs=getComputedStyle(e); if (cs.textAlign!=='justify') return;
      if (maxGap(e)>MAX_GAP) e.classList.add('is-ragged');
    });
  }
  const run=()=>{ fit(); smartJustify(); };
  let t; const later=()=>{clearTimeout(t);t=setTimeout(run,80);};
  document.addEventListener('DOMContentLoaded',run);
  window.addEventListener('load',()=>{run();setTimeout(run,900);setTimeout(run,2200);});
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  window.addEventListener('resize',later);
})();
