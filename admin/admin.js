(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const cfg = window.YUKTECH_CONFIG;
  const loginPanel = $('#login-panel'), appPanel = $('#app-panel');
  let sb, currentUser, currentRole;
  const canReview = () => ['admin', 'reviewer'].includes(currentRole);
  const canEdit = () => ['admin', 'editor'].includes(currentRole);
  const isAdmin = () => currentRole === 'admin';
  let toastTimer;
  const say = (message, error = false, target = '#app-message') => {
    const el = $(target); if (!el) return;
    el.textContent = message; el.classList.toggle('error', error);
    if (target === '#app-message') { clearTimeout(toastTimer); if (message && !error) toastTimer = setTimeout(() => { el.textContent = ''; }, 6000); if (message) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const statusTag = s => `<span class="status ${esc(s)}">${esc(String(s).replace('_', ' '))}</span>`;
  const httpUrl = v => { try { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };

  /* ================= startup / auth ================= */
  /* show the logo currently set under Brand (falls back to the bundled logo.png) */
  async function applySiteLogo() {
    try {
      const { data } = await sb.from('cms_content').select('content_value').eq('content_key', 'site.logo').eq('status', 'published').order('updated_at', { ascending: false }).limit(1);
      const u = data && data[0] && httpUrl(data[0].content_value);
      if (u) $$('.admin-logo').forEach(i => { i.src = u; });
    } catch { /* keep default logo */ }
  }

  async function init() {
    if (!cfg || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR-PROJECT') || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('YOUR_')) {
      say('Setup required: copy config.example.js to config.js and add your Supabase URL and publishable/anon key.', true, '#login-message'); return;
    }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    applySiteLogo();
    $('#login-form').addEventListener('submit', async e => {
      e.preventDefault(); say('Signing in…', false, '#login-message');
      const { error } = await sb.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
      if (error) say(error.message, true, '#login-message');
    });
    sb.auth.onAuthStateChange((_e, session) => { if (session) setTimeout(() => loadApp(session.user), 0); else showLogin(); });
    const { data: { session } } = await sb.auth.getSession();
    if (session) await loadApp(session.user); else showLogin();
  }
  function showLogin() { loginPanel.hidden = false; appPanel.hidden = true; $('#bottom-nav').hidden = true; $('#signout-button').hidden = true; currentUser = currentRole = null; }

  async function loadApp(user) {
    if (currentUser && currentUser.id === user.id) return;           // avoid double loading
    const { data: roleRow, error } = await sb.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (error || !roleRow) { await sb.auth.signOut(); showLogin(); say('This account has no YUKTECH role. Ask an administrator to assign one.', true, '#login-message'); return; }
    currentUser = user; currentRole = roleRow.role;
    loginPanel.hidden = true; appPanel.hidden = false; $('#bottom-nav').hidden = false; $('#signout-button').hidden = false;
    $('#user-summary').textContent = `${user.email} · ${currentRole}`;
    $$('.admin-only').forEach(el => el.hidden = !isAdmin());
    $$('.reviewer-only').forEach(el => el.hidden = !canReview());
    $('#new-job').hidden = !canEdit();
    $('#job-publish-btn').hidden = !canReview();
    $('#content-publish').hidden = !canReview();
    bindOnce();
    await Promise.all([loadJobs(), loadStats()]);
    switchTab('overview');
  }

  /* ================= navigation ================= */
  const TITLES = { overview: 'Dashboard', contact: 'Contact & links', brand: 'Logo & founder', jobs: 'Job postings', more: 'More tools', pages: 'Page text', media: 'Image library', review: 'Review queue', users: 'User access' };
  const NAV_FOR = { pages: 'more', media: 'more', review: 'more', users: 'more' };
  function switchTab(name) {
    if ((name === 'contact' || name === 'brand') && !isAdmin()) { say('Only an administrator can change site details.', true); name = 'overview'; }
    $$('.tab-panel').forEach(p => p.hidden = p.id !== `tab-${name}`);
    $$('#bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === (NAV_FOR[name] || name)));
    $('#page-title').textContent = TITLES[name] || 'Dashboard';
    window.scrollTo({ top: 0 });
    if (name === 'contact') loadSettings('contact');
    if (name === 'brand') loadSettings('brand');
    if (name === 'review') loadReview();
    if (name === 'users') loadRoles();
    if (name === 'media') loadMedia();
    if (name === 'jobs' || name === 'overview') { loadJobs(); loadStats(); }
  }
  let bound = false;
  function bindOnce() {
    if (bound) return; bound = true;
    $$('#bottom-nav button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) switchTab(g.dataset.go); });
    $('#signout-button').addEventListener('click', () => sb.auth.signOut());
    $$('.settings-form').forEach(f => f.addEventListener('submit', saveSettings));
    $$('[data-reload]').forEach(b => b.addEventListener('click', () => loadSettings(b.dataset.reload)));
    $('#new-job').addEventListener('click', () => openJob());
    $('#cancel-job').addEventListener('click', () => $('#job-form').hidden = true);
    $('#job-form').addEventListener('submit', saveJob);
    $('#preview-job').addEventListener('click', () => { previewJob(); $('#job-preview').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
    bindDescriptionTools();
    $('#job-search').addEventListener('input', renderJobs);
    $('#job-department').addEventListener('change', () => { const o = $('#job-department').value === OTHER; $('#job-department-other').hidden = !o; if (o) $('#job-department-other').focus(); });
    $('#job-filters').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $$('#job-filters .chip').forEach(x => x.classList.toggle('active', x === c)); jobFilter = c.dataset.f; renderJobs(); });
    $('#page-picker').addEventListener('change', loadPageFields);
    $('#content-form').addEventListener('submit', saveContent);
    $('#cancel-content').addEventListener('click', () => $('#content-form').hidden = true);
    $('#media-form').addEventListener('submit', uploadMedia);
    $('#copy-media-url').addEventListener('click', async () => { await navigator.clipboard.writeText($('#media-url').value); say('Image URL copied.'); });
    $('#role-form').addEventListener('submit', saveRole);
  }
  async function loadStats() {
    const [j, d, r] = await Promise.all([
      sb.from('job_posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      sb.from('job_posts').select('id', { count: 'exact', head: true }).in('status', ['draft', 'rejected']),
      sb.from('job_posts').select('id', { count: 'exact', head: true }).eq('status', 'in_review')]);
    $('#stat-jobs').textContent = j.count ?? '—'; $('#stat-drafts').textContent = d.count ?? '—'; $('#stat-review').textContent = r.count ?? '—';
  }

  /* ================= site details (contact, logo, founder) ================= */
  const D_BIO1 = 'Kapil Jain is a technology professional and entrepreneur with 15+ years of experience in US IT infrastructure engineering and 11+ years in IT staffing and talent augmentation. His experience spans enterprise technology, workforce solutions, and IT service delivery, enabling him to understand client challenges and develop practical solutions across IT consulting, specialized talent acquisition, and onsite-offshore delivery models.';
  const D_BIO2 = 'As Co-Founder of VKore Solutions LLC, Kapil has helped build an IT services and staffing business focused on meeting evolving client needs. Beyond technology, his entrepreneurial journey includes founding and operating businesses in the travel and tourism industry, giving him firsthand experience in building companies, managing daily operations, developing client relationships, and driving sustainable growth.';
  const D_BIO3 = 'As Founder of YukTech, Kapil brings together technical expertise, staffing experience, and business ownership to help organizations align people, processes, and technology with their business objectives.';
  const FIELDS = {
    contact: [
      { key: 'site.email', label: 'Public email address', def: 'info@yuktech.net', type: 'email', help: 'Shown in the footer and on the Contact page.' },
      { key: 'site.linkedin', label: 'LinkedIn page link', def: 'https://www.linkedin.com/company/yuktech/home/', type: 'url' },
      { key: 'site.company.name', label: 'Company name (footer)', def: 'YUKTECH', type: 'text' }],
    us: [
      { key: 'site.us.label', label: 'Heading', def: 'UNITED STATES OFFICE', type: 'text' },
      { key: 'site.us.address', label: 'Address', def: '314 E Highland Mall Blvd STE 505,\nAustin, TX 78752, USA', type: 'textarea', help: 'One line of the address per line. The “Get directions” link updates automatically.' },
      { key: 'site.us.phone', label: 'Phone number', def: '+1 818 312 1406', type: 'tel' }],
    india: [
      { key: 'site.india.label', label: 'Heading', def: 'INDIA OFFICE', type: 'text' },
      { key: 'site.india.address', label: 'Address', def: 'No. 306, Block B-158, Sector 63,\nNoida, Uttar Pradesh 201309, India', type: 'textarea' },
      { key: 'site.india.phone', label: 'Phone number', def: '+91 63797 95204', type: 'tel' }],
    footer: [
      { key: 'site.footer.tagline', label: 'Footer tagline (under the logo)', def: '', type: 'text', help: 'Leave blank to keep each page’s own wording.' },
      { key: 'site.footer.motto', label: 'Footer line (bottom right)', def: 'People × Process × Technology.', type: 'text' },
      { key: 'site.banner.text', label: 'Announcement banner message', def: '', type: 'text', help: 'Leave blank for no banner. Example: “We are hiring – see our open roles.”' },
      { key: 'site.banner.link', label: 'Banner link (optional)', def: '', type: 'text', help: 'A page such as careers.html, or a full https:// address.' },
      { key: 'site.banner.linklabel', label: 'Banner link text (optional)', def: '', type: 'text' }],
    logo: [{ key: 'site.logo', label: 'Logo', def: './Images/YUK.png', type: 'image' }],
    founderphoto: [{ key: 'site.founder.photo', label: 'Founder photo', def: './Images/Kapil.png', type: 'image' }],
    founder: [
      { key: 'founder.name', label: 'Name', def: 'Kapil Jain', type: 'text' },
      { key: 'founder.title', label: 'Title', def: 'Founder, YukTech | Co-Founder, VKore Solutions LLC', type: 'text' },
      { key: 'founder.heading', label: 'Section heading', def: 'Technology Leadership. Entrepreneurial Vision. Business Impact.', type: 'text' },
      { key: 'founder.bio1', label: 'Paragraph 1', def: D_BIO1, type: 'textarea', rows: 6 },
      { key: 'founder.bio2', label: 'Paragraph 2', def: D_BIO2, type: 'textarea', rows: 6 },
      { key: 'founder.bio3', label: 'Paragraph 3', def: D_BIO3, type: 'textarea', rows: 4 },
      { key: 'founder.philosophy', label: 'Closing line (shown in bold italics)', def: 'His approach is simple: understand the challenge, deliver the right solution, and create meaningful business impact.', type: 'textarea', rows: 3 }]
  };
  const GROUPS = { contact: ['contact', 'us', 'india', 'footer'], brand: ['logo', 'founderphoto', 'founder'] };
  const fid = k => 'f-' + k.replace(/\./g, '-');
  const built = {};
  let rowsByKey = new Map();
  const pending = {};   // key -> File chosen but not yet uploaded

  function buildFields(group) {
    if (built[group]) return; built[group] = true;
    GROUPS[group].forEach(g => {
      const host = $(`[data-fields="${g}"]`); host.replaceChildren();
      FIELDS[g].forEach(f => {
        if (f.type === 'image') { host.append(imageField(f)); return; }
        const lab = document.createElement('label'); lab.htmlFor = fid(f.key); lab.append(document.createTextNode(f.label));
        const inp = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
        if (f.type === 'textarea') inp.rows = f.rows || 3; else { inp.type = f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'url' ? 'url' : 'text'; if (f.type === 'email') inp.inputMode = 'email'; if (f.type === 'tel') inp.inputMode = 'tel'; if (f.type === 'url') inp.inputMode = 'url'; }
        inp.id = fid(f.key); inp.dataset.key = f.key; inp.maxLength = f.type === 'textarea' ? 1500 : 250; inp.autocomplete = 'off';
        lab.append(inp);
        if (f.help) { const h = document.createElement('small'); h.className = 'help'; h.textContent = f.help; lab.append(h); }
        host.append(lab);
      });
    });
  }
  function imageField(f) {
    const wrap = document.createElement('div'); wrap.className = 'img-field'; wrap.dataset.imgKey = f.key;
    const prev = document.createElement('div'); prev.className = 'img-preview'; const img = document.createElement('img'); img.alt = f.label + ' preview'; prev.append(img);
    const acts = document.createElement('div'); acts.className = 'img-actions';
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp,image/gif'; file.id = fid(f.key); file.setAttribute('aria-label', 'Choose ' + f.label);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn ghost'; reset.textContent = 'Use original image';
    const hid = document.createElement('input'); hid.type = 'hidden'; hid.dataset.key = f.key; hid.id = fid(f.key) + '-url';
    const note = document.createElement('small'); note.className = 'help'; note.textContent = 'JPG, PNG, WEBP or GIF, up to 5 MB. Press “Save & publish” to apply.';
    file.addEventListener('change', () => {
      const fl = file.files[0]; if (!fl) return;
      const err = imageError(fl); if (err) { say(err, true); file.value = ''; return; }
      pending[f.key] = fl; img.src = URL.createObjectURL(fl);
    });
    reset.addEventListener('click', () => { delete pending[f.key]; file.value = ''; hid.value = f.def; img.src = '../' + f.def.replace(/^\.\//, ''); });
    acts.append(file, reset, note); wrap.append(prev, acts, hid); return wrap;
  }
  const imageError = fl => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(fl.type) ? 'Please choose a JPG, PNG, WEBP or GIF image.' : fl.size > 5 * 1024 * 1024 ? 'That image is over 5 MB. Please choose a smaller one.' : '';

  async function loadSettings(group) {
    if (!isAdmin()) return;
    buildFields(group);
    const keys = GROUPS[group].flatMap(g => FIELDS[g].map(f => f.key));
    const { data, error } = await sb.from('cms_content').select('id,content_key,content_value,updated_at').in('content_key', keys).eq('status', 'published').order('updated_at', { ascending: false });
    if (error) { say(error.message, true); return; }
    keys.forEach(k => rowsByKey.delete(k));
    (data || []).forEach(r => { if (!rowsByKey.has(r.content_key)) rowsByKey.set(r.content_key, r); });
    GROUPS[group].forEach(g => FIELDS[g].forEach(f => {
      const el = document.getElementById(f.type === 'image' ? fid(f.key) + '-url' : fid(f.key)); if (!el) return;
      const r = rowsByKey.get(f.key); el.value = r ? r.content_value : f.def;
      if (f.type === 'image') { delete pending[f.key]; const fi = document.getElementById(fid(f.key)); if (fi) fi.value = ''; const im = el.closest('.img-field').querySelector('img'); im.src = el.value.startsWith('http') ? el.value : '../' + el.value.replace(/^\.\//, ''); }
    }));
  }
  function fieldError(f, v) {
    if (!v || f.type === 'image') return '';
    if (f.type === 'email' && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) return f.label + ': enter a valid email address.';
    if (f.type === 'tel' && !/^\+?[\d\s().-]{6,25}$/.test(v)) return f.label + ': use digits, spaces and + only.';
    if (f.type === 'url' && !httpUrl(v)) return f.label + ': enter a full address starting with https://';
    if (f.key === 'site.banner.link' && !/^[\w./-]+\.html(#[\w-]*)?$/.test(v) && !httpUrl(v)) return f.label + ': use a page such as careers.html or a full https:// address.';
    return '';
  }
  async function saveSettings(e) {
    e.preventDefault(); if (!isAdmin()) return;
    const form = e.currentTarget, group = form.dataset.group;
    const plan = [];
    for (const g of GROUPS[group]) for (const f of FIELDS[g]) {
      const el = document.getElementById(f.type === 'image' ? fid(f.key) + '-url' : fid(f.key));
      const v = (el.value || '').replace(/\r/g, '').trim();
      const msg = fieldError(f, v); if (msg) { say(msg, true); el.scrollIntoView({ block: 'center' }); return; }
      plan.push({ f, v });
    }
    const btns = $$('button[type=submit]', form); btns.forEach(b => b.disabled = true); say('Saving…');
    let changed = 0;
    try {
      for (const item of plan) {
        const { f } = item; let v = item.v;
        if (f.type === 'image' && pending[f.key]) {                     // upload a newly chosen image first
          const fl = pending[f.key];
          const path = `${f.key.replace(/\./g, '-')}-${Date.now()}.${(fl.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          const up = await sb.storage.from('site-media').upload(path, fl, { upsert: false, contentType: fl.type }); if (up.error) throw up.error;
          v = sb.storage.from('site-media').getPublicUrl(path).data.publicUrl; delete pending[f.key];
        }
        const existing = rowsByKey.get(f.key);
        if (!v || v === f.def) { if (existing) { const { error } = await sb.from('cms_content').delete().eq('content_key', f.key); if (error) throw error; changed++; } continue; }
        if (existing && existing.content_value === v) continue;
        const type = f.type === 'image' ? 'image_url' : 'text';
        if (existing) { const { error } = await sb.from('cms_content').update({ content_value: v, content_type: type, updated_by: currentUser.id }).eq('id', existing.id); if (error) throw error; }
        else {
          const ins = await sb.from('cms_content').insert({ content_key: f.key, content_value: v, content_type: type, status: 'draft', created_by: currentUser.id, updated_by: currentUser.id }).select('id').single(); if (ins.error) throw ins.error;
          const up = await sb.from('cms_content').update({ status: 'published', approved_by: currentUser.id, approved_at: new Date().toISOString(), updated_by: currentUser.id }).eq('id', ins.data.id); if (up.error) throw up.error;
        }
        changed++;
      }
      if (changed) await sb.from('audit_log').insert({ actor_id: currentUser.id, action: 'update_settings', entity_type: 'cms_content', entity_id: group, details: { changed } });
      say(changed ? `Saved. ${changed} item${changed === 1 ? '' : 's'} updated — refresh the website to see the change.` : 'Nothing to change.');
      await loadSettings(group);
    } catch (err) { say(err.message || String(err), true); }
    btns.forEach(b => b.disabled = false);
  }

  /* ================= jobs ================= */
  let jobsCache = [], jobFilter = 'all';
  async function loadJobs() {
    const { data, error } = await sb.from('job_posts').select('*').order('updated_at', { ascending: false });
    if (error) { say(error.message, true); return; }
    jobsCache = data || []; renderJobs();
  }
  function renderJobs() {
    const list = $('#job-list'); list.replaceChildren();
    const term = ($('#job-search').value || '').trim().toLowerCase();
    const rows = jobsCache.filter(j => (jobFilter === 'all' || j.status === jobFilter || (jobFilter === 'draft' && j.status === 'rejected')) && (!term || [j.title, j.location, j.department, j.description].join(' ').toLowerCase().includes(term)));
    if (!rows.length) { list.textContent = jobsCache.length ? 'No jobs match your search.' : 'No job postings yet. Tap “+ Add job” to create the first one.'; return; }
    rows.forEach(row => {
      const card = document.createElement('article'); card.className = 'record';
      const when = row.published_at ? ' · Posted ' + new Date(row.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      card.innerHTML = `<div><h3>${esc(row.title)}</h3><p>${statusTag(row.status)} ${esc(row.location)} · ${esc(row.work_type)}${row.experience ? ' · ' + esc(row.experience) : ''}${esc(when)}</p><p>${esc(descText(row.description).slice(0, 140))}…</p></div><div class="record-actions">${
        canEdit() ? '<button class="small-btn" data-edit type="button">Edit</button>' : ''}${
        canEdit() ? '<button class="small-btn" data-dup type="button">Duplicate</button>' : ''}${
        canEdit() && ['draft', 'rejected'].includes(row.status) && !canReview() ? '<button class="small-btn publish" data-submit type="button">Submit for review</button>' : ''}${
        canReview() && ['draft', 'rejected', 'in_review'].includes(row.status) ? '<button class="small-btn publish" data-publish type="button">Publish</button>' : ''}${
        canReview() && row.status === 'in_review' ? '<button class="small-btn reject" data-reject type="button">Reject</button>' : ''}${
        canReview() && row.status === 'published' ? '<button class="small-btn" data-close type="button">Close</button>' : ''}${
        canReview() && row.status === 'closed' ? '<button class="small-btn publish" data-reopen type="button">Reopen</button>' : ''}${
        row.status === 'published' && canReview() && row.external_board !== 'website' ? '<button class="small-btn publish" data-dispatch type="button">Send to ATS</button>' : ''}${
        isAdmin() && ['draft', 'rejected', 'closed'].includes(row.status) ? '<button class="small-btn reject" data-del type="button">Delete</button>' : ''}</div>`;
      const on = (sel, fn) => { const b = $(sel, card); if (b) b.onclick = fn; };
      on('[data-edit]', () => openJob(row)); on('[data-dup]', () => openJob({ ...row, id: '', status: 'draft', supersedes_id: null, title: row.title + ' (copy)' }, true));
      on('[data-submit]', () => submitForReview(row.id)); on('[data-publish]', () => publishJob(row.id));
      on('[data-reject]', () => rejectJob(row.id)); on('[data-close]', () => setJobStatus(row.id, 'closed', 'Job closed.'));
      on('[data-reopen]', () => setJobStatus(row.id, 'published', 'Job reopened and live again.', true));
      on('[data-dispatch]', () => dispatchJob(row.id)); on('[data-del]', () => deleteJob(row));
      list.append(card);
    });
  }
  /* ---- department dropdown: preset IT-services departments + any already used on existing jobs ---- */
  const DEPT_GROUPS = {
    'Engineering & Technology': ['Software Engineering', 'Cloud & DevOps', 'Data & Analytics', 'AI & Machine Learning', 'Cybersecurity', 'ERP & Enterprise Applications', 'QA & Testing', 'IT Infrastructure & Support', 'Network Engineering', 'Database Administration'],
    'Consulting & Delivery': ['IT Consulting & Advisory', 'Solution Architecture', 'Business Analysis', 'Project & Program Management', 'UI/UX Design', 'Delivery & Account Management'],
    'Staffing & Business': ['Recruitment & Talent Acquisition', 'Sales & Business Development', 'Marketing', 'HR & Operations', 'Finance & Accounting']
  };
  const OTHER = '__other__';
  function fillDepartments(selected) {
    const sel = $('#job-department'); const preset = new Set(Object.values(DEPT_GROUPS).flat());
    const used = [...new Set(jobsCache.map(j => (j.department || '').trim()).filter(Boolean))].filter(d => !preset.has(d)).sort();
    if (selected && !preset.has(selected) && !used.includes(selected)) used.push(selected);
    sel.replaceChildren();
    if (used.length) { const g = document.createElement('optgroup'); g.label = 'Already used'; used.forEach(d => g.append(new Option(d, d))); sel.append(g); }
    Object.entries(DEPT_GROUPS).forEach(([label, items]) => { const g = document.createElement('optgroup'); g.label = label; items.forEach(d => g.append(new Option(d, d))); sel.append(g); });
    sel.append(new Option('Other (type a new department)…', OTHER));
    sel.value = selected || 'Software Engineering';
    $('#job-department-other').hidden = true; $('#job-department-other').value = '';
  }
  const departmentValue = () => { const v = $('#job-department').value; return v === OTHER ? $('#job-department-other').value.trim() : v; };
  function openJob(row, isCopy) {
    const form = $('#job-form'); form.hidden = false; $('#job-preview').hidden = true;
    const live = row?.status === 'published';
    $('#job-id').value = live || isCopy ? '' : (row?.id || '');
    $('#job-supersedes-id').value = live ? row.id : (isCopy ? '' : (row?.supersedes_id || ''));
    $('#job-title').value = row?.title || ''; fillDepartments(row?.department || ''); $('#job-location').value = row?.location || '';
    $('#job-work-type').value = row?.work_type || 'Full-time'; $('#job-experience').value = row?.experience || ''; $('#job-board').value = row?.external_board || 'website';
    setEditor(row?.description); $('#job-apply-url').value = row?.apply_url || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function jobPayload() {
    return { title: $('#job-title').value.trim(), department: departmentValue() || 'Technology', location: $('#job-location').value.trim(), work_type: $('#job-work-type').value, experience: $('#job-experience').value.trim(), external_board: $('#job-board').value, description: editorHtml(), apply_url: $('#job-apply-url').value.trim(), supersedes_id: $('#job-supersedes-id').value || null };
  }
  async function saveJob(e) {
    e.preventDefault();
    const mode = (e.submitter && e.submitter.dataset.mode) || 'draft';
    const p = jobPayload();
    if (!editorHasText()) { say('Please add a job description.', true); ed().focus(); return; }
    if (p.apply_url && !httpUrl(p.apply_url) && !/^mailto:/i.test(p.apply_url)) { say('Application URL must start with https://', true); return; }
    const id = $('#job-id').value; const payload = { ...p, status: 'draft', updated_by: currentUser.id };
    let res, savedId = id;
    if (id) res = await sb.from('job_posts').update(payload).eq('id', id);
    else { payload.created_by = currentUser.id; res = await sb.from('job_posts').insert(payload).select('id').single(); savedId = res.data?.id; }
    if (res.error) { say(res.error.message, true); return; }
    await sb.from('audit_log').insert({ actor_id: currentUser.id, action: id ? 'edit_job_draft' : 'create_job_draft', entity_type: 'job_posts', entity_id: savedId || p.title });
    $('#job-form').hidden = true;
    if (mode === 'publish' && canReview() && savedId) { await publishJob(savedId); return; }
    say('Draft saved.' + (canReview() ? ' Tap Publish when it is ready.' : ' Submit it for review when ready.'));
    await Promise.all([loadJobs(), loadStats()]);
  }
  function previewJob() {
    const p = jobPayload(), box = $('#job-preview'); box.replaceChildren(); box.hidden = false; box.classList.add('job-details');
    const h = document.createElement('h3'); h.textContent = p.title || 'Job title'; box.append(h);
    const ul = document.createElement('ul'); ul.className = 'pv-chips';
    [p.location, p.work_type, p.department, p.experience].filter(Boolean).forEach(c => { const li = document.createElement('li'); li.textContent = c; ul.append(li); }); box.append(ul);
    box.append(renderJobBody(p.description));
  }

  /* Turns the description text into headings, bold text, bullet lists (with sub-bullets) and paragraphs.
     Syntax:  "## Heading"  or a short line ending with ":"   |   "- point"   |   "  - sub-point" (indented)
              "1. step"     |   **bold**.   No HTML is ever injected: everything is built with textContent. */
  function formatDescription(text){
    const frag = document.createDocumentFragment(); let stack = [];
    const inline = (parent, s) => String(s).split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
      if (!part) return;
      if (i % 2) { const b = document.createElement('strong'); b.textContent = part; parent.append(b); } else parent.append(document.createTextNode(part));
    });
    String(text || '').replace(/\r/g, '').split('\n').forEach(raw => {
      if (!raw.trim()) { stack = []; return; }
      const item = raw.match(/^([ \t]*)([-•*–▪◦●○]|\d{1,2}[.)])[ \t]+(.*)$/);
      if (item) {
        const level = Math.min(2, Math.floor(item[1].replace(/\t/g, '    ').length / 2));
        const ordered = /\d/.test(item[2]);
        while (stack.length > level + 1) stack.pop();
        while (stack.length < level + 1) {
          const list = document.createElement(ordered && stack.length === 0 ? 'ol' : 'ul'); list.className = 'job-bullets' + (stack.length ? ' job-sub' : '');
          const parentLi = stack.length ? stack[stack.length - 1].lastElementChild : null;
          (parentLi || frag).append(list); stack.push(list);
        }
        const li = document.createElement('li'); inline(li, item[3]); stack[stack.length - 1].append(li); return;
      }
      stack = [];
      const line = raw.trim(), h = line.match(/^#{1,6}\s+(.*)$/);
      if (h || (line.length <= 70 && /:$/.test(line) && !/\*\*/.test(line.replace(/\*\*(.+?)\*\*/g, '')))) {
        const el = document.createElement('h4'); inline(el, (h ? h[1] : line.replace(/:$/, '')).replace(/\*\*/g, '')); frag.append(el);
      } else { const p = document.createElement('p'); inline(p, line); frag.append(p); }
    });
    return frag;
  }

  /* ---- rich job description: safe HTML (allow-list). Used by the public Careers page AND the admin editor. ---- */
  const DESC_TAGS = { P: 'p', H1: 'h4', H2: 'h4', H3: 'h4', H4: 'h4', H5: 'h5', H6: 'h5', UL: 'ul', OL: 'ol', LI: 'li', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', BR: 'br', A: 'a' };
  const DESC_SKIP = /^(SCRIPT|STYLE|META|LINK|TITLE|HEAD|IFRAME|OBJECT|EMBED|SVG|FORM|INPUT|BUTTON|TEXTAREA|SELECT|NOSCRIPT)$/;
  const looksLikeHtml = s => /^\s*<(p|h[1-6]|ul|ol|div|strong|b|em|i|u|br)\b/i.test(String(s || ''));
  function sanitizeDescription(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html'), out = document.createDocumentFragment();
    const walk = (src, dest) => src.childNodes.forEach(n => {
      if (n.nodeType === 3) { dest.append(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1 || DESC_SKIP.test(n.tagName)) return;
      const t = DESC_TAGS[n.tagName];
      if (!t && (n.tagName === 'SPAN' || n.tagName === 'FONT')) {          // Word / Google Docs mark bold & italic with styles
        const s = n.style || {}; let wrap = dest;
        const w = s.fontWeight; if (w === 'bold' || parseInt(w, 10) >= 600) { const b = document.createElement('strong'); wrap.append(b); wrap = b; }
        if (s.fontStyle === 'italic') { const i = document.createElement('em'); wrap.append(i); wrap = i; }
        walk(n, wrap); return;
      }
      if (!t) { walk(n, dest); return; }                                      // unknown wrapper: keep its text, drop the tag
      if (t === 'br') { dest.append(document.createElement('br')); return; }
      if (t === 'a') {
        const href = (n.getAttribute('href') || '').trim();
        if (!/^(https?:|mailto:|tel:)/i.test(href)) { walk(n, dest); return; }
        const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; walk(n, a); dest.append(a); return;
      }
      const el = document.createElement(t); walk(n, el); dest.append(el);
    });
    walk(doc.body, out);
    return tidyDescription(out);
  }
  function tidyDescription(frag) {
    const box = document.createElement('div'); box.append(frag);
    box.querySelectorAll('li > p').forEach(p => p.replaceWith(...p.childNodes));          // list items: no paragraph inside
    box.querySelectorAll('h4 strong, h5 strong').forEach(s => s.replaceWith(...s.childNodes)); // headings are already bold
    for (let pass = 0; pass < 3; pass++) box.querySelectorAll('p,li,strong,em,u,h4,h5,a,ul,ol').forEach(e => { if (!e.textContent.trim() && !e.querySelector('br,li')) e.remove(); });
    const INLINE = /^(STRONG|EM|U|A|BR)$/; const kids = [...box.childNodes]; let run = [];
    const flush = () => { if (run.some(n => n.nodeType !== 3 || n.nodeValue.trim())) { const p = document.createElement('p'); run[0].before(p); run.forEach(n => p.append(n)); } else run.forEach(n => n.remove()); run = []; };
    kids.forEach(n => { if (n.nodeType === 3 || (n.nodeType === 1 && INLINE.test(n.tagName))) run.push(n); else flush(); }); flush();
    return [...box.childNodes].reduce((f, n) => (f.append(n), f), document.createDocumentFragment());
  }
  const fragToHtml = f => { const d = document.createElement('div'); d.append(f.cloneNode(true)); return d.innerHTML; };
  const cleanHtml = html => fragToHtml(sanitizeDescription(html));
  const renderJobBody = d => looksLikeHtml(d) ? sanitizeDescription(d) : formatDescription(d);
  const descToHtml = d => fragToHtml(renderJobBody(d));
  const descText = d => { const d2 = document.createElement('div'); d2.innerHTML = descToHtml(d).replace(/<\/(p|li|h4|h5|ul|ol)>|<br>/gi, ' $&'); return d2.textContent.replace(/\s+/g, ' ').trim(); };

  /* ---- visual editor for the job description ---- */
  const ed = () => $('#job-description');
  const TEMPLATE = '<h4>About the role</h4><p>Briefly describe the role, the team and the client or project.</p><h4>Key responsibilities</h4><ul><li>Responsibility one</li><li>Responsibility two</li><li>Responsibility three</li></ul><h4>Required skills &amp; experience</h4><ul><li>Skill or qualification</li><li>Years of experience</li></ul><h4>Nice to have</h4><ul><li>Optional skill</li></ul><h4>What we offer</h4><ul><li>Benefit or growth opportunity</li></ul>';
  let savedRange = null;
  const inEditor = () => { const s = getSelection(); return s.rangeCount && ed().contains(s.anchorNode); };
  function restoreRange() { if (!savedRange) return; const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
  function syncToolbar() {
    if (!inEditor()) return; savedRange = getSelection().getRangeAt(0).cloneRange();
    $$('.rte-bar [data-cmd]').forEach(b => { if (/^(bold|italic|underline|insertUnorderedList|insertOrderedList)$/.test(b.dataset.cmd)) { let on = false; try { on = document.queryCommandState(b.dataset.cmd); } catch {} b.classList.toggle('on', on); } });
    let v = ''; try { v = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/\s/g, ''); } catch {}
    $('#rte-block').value = /^(h1|h2|h3|h4|heading[1-4])$/.test(v) ? 'h4' : /^(h5|h6|heading[56])$/.test(v) ? 'h5' : 'p';
  }
  function setEditor(desc) { ed().innerHTML = desc ? descToHtml(desc) : ''; }
  const editorHtml = () => cleanHtml(ed().innerHTML);
  const editorHasText = () => !!ed().textContent.trim();
  function bindDescriptionTools() {
    const e = ed(); try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
    $$('.rte-bar button, .rte-bar select').forEach(b => { if (b.tagName === 'BUTTON') b.addEventListener('mousedown', ev => ev.preventDefault()); });
    $$('.rte-bar [data-cmd]').forEach(b => b.addEventListener('click', () => { e.focus(); restoreRange(); document.execCommand(b.dataset.cmd, false, null); syncToolbar(); }));
    $('#rte-block').addEventListener('change', ev => { e.focus(); restoreRange(); document.execCommand('formatBlock', false, ev.target.value === 'p' ? 'p' : ev.target.value); syncToolbar(); });
    $$('.rte-bar [data-act]').forEach(b => b.addEventListener('click', () => {
      e.focus(); restoreRange();
      if (b.dataset.act === 'link') {
        const url = (prompt('Link address (must start with https://)', 'https://') || '').trim(); if (!url) return;
        if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) { say('The link must start with https://', true); return; }
        document.execCommand('createLink', false, url);
      } else if (b.dataset.act === 'clear') {
        document.execCommand('removeFormat'); document.execCommand('unlink'); document.execCommand('formatBlock', false, 'p');
      } else if (b.dataset.act === 'template') {
        if (editorHasText() && !confirm('Add the standard job layout at the end of your text?')) return;
        e.insertAdjacentHTML('beforeend', TEMPLATE);
      }
      syncToolbar(); e.dispatchEvent(new Event('input'));
    }));
    e.addEventListener('paste', ev => {                                    // keep structure, drop fonts/colours/styles
      ev.preventDefault(); const cd = ev.clipboardData; const html = cd.getData('text/html'), text = cd.getData('text/plain');
      const out = html && /<[a-z][\s\S]*>/i.test(html) ? cleanHtml((html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [0, html])[1]) : fragToHtml(formatDescription(text));
      document.execCommand('insertHTML', false, out);
    });
    e.addEventListener('keydown', ev => { if (ev.key === 'Tab' && document.queryCommandState('insertUnorderedList') || ev.key === 'Tab' && document.queryCommandState('insertOrderedList')) { ev.preventDefault(); document.execCommand(ev.shiftKey ? 'outdent' : 'indent'); } });
    document.addEventListener('selectionchange', syncToolbar);
    let timer; e.addEventListener('input', () => { if ($('#job-preview').hidden) return; clearTimeout(timer); timer = setTimeout(previewJob, 500); });
  }
  async function submitForReview(id) { const { error } = await sb.from('job_posts').update({ status: 'in_review', updated_by: currentUser.id }).eq('id', id); if (error) { say(error.message, true); return; } say('Submitted for review.'); await Promise.all([loadJobs(), loadStats()]); }
  async function publishJob(id) {
    if (!canReview()) return; const now = new Date().toISOString();
    const { data: t } = await sb.from('job_posts').select('supersedes_id').eq('id', id).single();
    if (t?.supersedes_id) { const { error } = await sb.from('job_posts').update({ status: 'closed', updated_by: currentUser.id }).eq('id', t.supersedes_id); if (error) { say(error.message, true); return; } }
    const { error } = await sb.from('job_posts').update({ status: 'published', approved_by: currentUser.id, approved_at: now, published_at: now, updated_by: currentUser.id }).eq('id', id);
    if (error) { say(error.message, true); return; }
    await sb.from('audit_log').insert({ actor_id: currentUser.id, action: 'publish', entity_type: 'job_posts', entity_id: id });
    say('Job published. It is now on the Careers page.'); await Promise.all([loadJobs(), loadStats()]);
  }
  async function rejectJob(id) { const { error } = await sb.from('job_posts').update({ status: 'rejected', updated_by: currentUser.id }).eq('id', id); if (error) { say(error.message, true); return; } await sb.from('audit_log').insert({ actor_id: currentUser.id, action: 'reject', entity_type: 'job_posts', entity_id: id }); say('Job sent back as rejected.'); await Promise.all([loadJobs(), loadStats()]); }
  async function setJobStatus(id, status, msg, stamp) {
    const patch = { status, updated_by: currentUser.id }; if (stamp) { patch.published_at = new Date().toISOString(); patch.approved_by = currentUser.id; patch.approved_at = patch.published_at; }
    const { error } = await sb.from('job_posts').update(patch).eq('id', id); if (error) { say(error.message, true); return; }
    await sb.from('audit_log').insert({ actor_id: currentUser.id, action: status === 'closed' ? 'close_job' : 'reopen_job', entity_type: 'job_posts', entity_id: id });
    say(msg); await Promise.all([loadJobs(), loadStats()]);
  }
  async function deleteJob(row) { if (!confirm(`Delete “${row.title}” permanently?`)) return; const { error } = await sb.from('job_posts').delete().eq('id', row.id); if (error) { say(error.message, true); return; } say('Job deleted.'); await Promise.all([loadJobs(), loadStats()]); }
  async function dispatchJob(id) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch('/.netlify/functions/dispatch-approved-job', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ jobId: id }) });
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error || 'Could not send this job.');
      say('Job sent to your ATS / distribution provider.');
    } catch (err) { say(err.message, true); }
  }

  /* ================= page text (advanced) ================= */
  async function openContent(row) {
    const f = $('#content-form'); f.hidden = false;
    const published = row?.status === 'published';
    $('#content-id').value = published ? '' : (row?.id || ''); $('#content-key').value = row?.content_key || '';
    $('#content-type').value = row?.content_type || 'text'; $('#content-value').value = row?.content_value || '';
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  async function loadPageFields() {
    const page = $('#page-picker').value, host = $('#page-fields'); host.replaceChildren(); $('#content-form').hidden = true; if (!page) return;
    host.textContent = 'Loading page fields…';
    try {
      const res = await fetch('../' + page + '.html', { cache: 'no-store' }); if (!res.ok) throw new Error('Page not found');
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const { data: rows } = await sb.from('cms_content').select('content_key,status').in('status', ['draft', 'in_review', 'published']);
      const state = new Map(); (rows || []).forEach(r => { const o = state.get(r.content_key) || []; o.push(r.status); state.set(r.content_key, o); });
      host.replaceChildren();
      doc.querySelectorAll('[data-cms-key],[data-cms-image]').forEach(el => {
        const isImg = el.hasAttribute('data-cms-image'); const key = isImg ? el.dataset.cmsImage : el.dataset.cmsKey;
        if (isImg) return;                                  // logo and founder photo live under "Logo & founder"
        if (key.startsWith('founder.')) return;
        const current = el.textContent.trim().replace(/\s+/g, ' ');
        const card = document.createElement('article'); card.className = 'record';
        const st = state.get(key); const badge = st ? statusTag(st.includes('published') ? 'published' : st[0]) : '<span class="status">not edited</span>';
        card.innerHTML = `<div><h3>${esc(el.tagName.toLowerCase())} · ${badge}</h3><p>${esc(current.slice(0, 160))}</p></div><div class="record-actions">${canEdit() ? '<button class="small-btn" type="button">Edit</button>' : ''}</div>`;
        const btn = $('button', card); if (btn) btn.onclick = async () => {
          const { data } = await sb.from('cms_content').select('*').eq('content_key', key).order('updated_at', { ascending: false }).limit(1);
          openContent(data && data[0] ? data[0] : { content_key: key, content_type: 'text', content_value: current });
        };
        host.append(card);
      });
      if (!host.children.length) host.textContent = 'No editable text fields found on this page.';
    } catch (err) { host.textContent = 'Could not load page: ' + err.message; }
  }
  async function saveContent(e) {
    e.preventDefault(); const publish = e.submitter && e.submitter.dataset.mode === 'publish' && canReview();
    const id = $('#content-id').value; const key = $('#content-key').value.trim();
    const payload = { content_key: key, content_type: $('#content-type').value, content_value: $('#content-value').value, status: 'draft', updated_by: currentUser.id };
    let res, savedId = id;
    if (id) res = await sb.from('cms_content').update(payload).eq('id', id);
    else { payload.created_by = currentUser.id; res = await sb.from('cms_content').insert(payload).select('id').single(); savedId = res.data?.id; }
    if (res.error) { say(res.error.message, true); return; }
    $('#content-form').hidden = true;
    if (publish && savedId) {
      const { error: oe } = await sb.from('cms_content').update({ status: 'draft' }).eq('content_key', key).eq('status', 'published').neq('id', savedId); if (oe) { say(oe.message, true); return; }
      const now = new Date().toISOString(); const { error } = await sb.from('cms_content').update({ status: 'published', approved_by: currentUser.id, approved_at: now, updated_by: currentUser.id }).eq('id', savedId);
      if (error) { say(error.message, true); return; } say('Published. Refresh the website to see it.'); loadPageFields(); return;
    }
    say(canReview() ? 'Draft saved.' : 'Draft saved. Ask a reviewer to publish it.'); loadPageFields();
  }

  /* ================= review queue (jobs + page text) ================= */
  async function loadReview() {
    if (!canReview()) return;
    const [c, j] = await Promise.all([sb.from('cms_content').select('*').eq('status', 'in_review'), sb.from('job_posts').select('*').eq('status', 'in_review')]);
    const list = $('#review-list'); list.replaceChildren();
    if (c.error || j.error) { list.textContent = (c.error || j.error).message; return; }
    const rows = [...(c.data || []).map(x => ({ ...x, _t: 'cms_content' })), ...(j.data || []).map(x => ({ ...x, _t: 'job_posts' }))];
    if (!rows.length) { list.textContent = 'The review queue is empty.'; return; }
    rows.forEach(row => {
      const card = document.createElement('article'); card.className = 'record'; const job = row._t === 'job_posts';
      card.innerHTML = `<div><h3>${job ? 'Job: ' + esc(row.title) : 'Text: ' + esc(row.content_key)}</h3><p>${statusTag(row.status)}</p><p>${esc((job ? `${row.location} · ${row.work_type}\n${descText(row.description)}` : row.content_value).slice(0, 600))}</p></div><div class="record-actions"><button class="small-btn publish" data-p type="button">Approve &amp; publish</button><button class="small-btn reject" data-r type="button">Reject</button></div>`;
      $('[data-p]', card).onclick = async () => { if (job) await publishJob(row.id); else await approveContent(row.id); loadReview(); };
      $('[data-r]', card).onclick = async () => { if (job) await rejectJob(row.id); else { await sb.from('cms_content').update({ status: 'rejected', updated_by: currentUser.id }).eq('id', row.id); say('Returned as rejected.'); } loadReview(); };
      list.append(card);
    });
  }
  async function approveContent(id) {
    const { data: t, error: re } = await sb.from('cms_content').select('content_key').eq('id', id).single(); if (re) { say(re.message, true); return; }
    await sb.from('cms_content').update({ status: 'draft' }).eq('content_key', t.content_key).eq('status', 'published');
    const now = new Date().toISOString(); const { error } = await sb.from('cms_content').update({ status: 'published', approved_by: currentUser.id, approved_at: now, updated_by: currentUser.id }).eq('id', id);
    if (error) { say(error.message, true); return; } await sb.from('audit_log').insert({ actor_id: currentUser.id, action: 'publish', entity_type: 'cms_content', entity_id: id }); say('Published.');
  }

  /* ================= media + users (advanced) ================= */
  async function uploadMedia(e) {
    e.preventDefault(); const file = $('#media-file').files[0]; if (!file) return;
    const err = imageError(file); if (err) { say(err, true); return; }
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await sb.storage.from('site-media').upload(path, file, { upsert: false, contentType: file.type }); if (error) { say(error.message, true); return; }
    $('#media-url').value = sb.storage.from('site-media').getPublicUrl(path).data.publicUrl; $('#media-url-wrap').hidden = false;
    say('Image uploaded.'); $('#media-file').value = ''; loadMedia();
  }
  async function loadMedia() {
    const { data, error } = await sb.storage.from('site-media').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }); if (error) return;
    const list = $('#media-list'); list.replaceChildren();
    (data || []).filter(x => x.name).forEach(file => {
      const url = sb.storage.from('site-media').getPublicUrl(file.name).data.publicUrl;
      const card = document.createElement('div'); card.className = 'media-card';
      const img = document.createElement('img'); img.src = url; img.alt = file.name; img.loading = 'lazy';
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = file.name;
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'small-btn'; copy.textContent = 'Copy URL';
      copy.onclick = async () => { await navigator.clipboard.writeText(url); say('Image URL copied.'); };
      card.append(img, a, copy); list.append(card);
    });
  }
  async function loadRoles() {
    if (!isAdmin()) return;
    const { data, error } = await sb.from('user_roles').select('user_id,role,created_at').order('created_at', { ascending: false });
    const list = $('#role-list'); list.replaceChildren(); if (error) { list.textContent = error.message; return; }
    (data || []).forEach(row => {
      const el = document.createElement('article'); el.className = 'record'; const info = document.createElement('div');
      const h = document.createElement('h3'); h.textContent = row.user_id; const p = document.createElement('p'); p.textContent = 'Role: ' + row.role; info.append(h, p);
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'small-btn reject'; btn.textContent = 'Remove access';
      btn.onclick = async () => { if (row.user_id === currentUser.id) { say('You cannot remove your own role.', true); return; } if (!confirm('Remove this user’s admin access?')) return; const { error: e2 } = await sb.from('user_roles').delete().eq('user_id', row.user_id); if (e2) say(e2.message, true); else { say('Access removed.'); loadRoles(); } };
      el.append(info, btn); list.append(el);
    });
  }
  async function saveRole(e) {
    e.preventDefault(); if (!isAdmin()) return;
    const userId = $('#role-user-id').value.trim(), role = $('#role-value').value;
    const { error } = await sb.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id' }); if (error) { say(error.message, true); return; }
    await sb.from('audit_log').insert({ actor_id: currentUser.id, action: 'assign_role', entity_type: 'user_roles', entity_id: userId, details: { role } });
    $('#role-user-id').value = ''; say('Role saved.'); loadRoles();
  }
  init();
})();
