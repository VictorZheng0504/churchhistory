/* 教会史互动课堂 —— 单文件引擎。
   数据来自 data/lesson-XX.js（window.COURSE_LESSONS），地图来自 assets/map-data.js（window.MAP_DATA）。
   纯函数集中在 Util，Node 测试可以直接 require 本文件使用它们（见 tests/util.test.js）。 */
(function (root) {
  'use strict';

  /* ================= 纯函数（可测试） ================= */
  const Util = {
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    // 洗牌；avoidIdentity 用于排序题，避免洗完正好是正确答案
    shuffle(arr, rnd = Math.random, avoidIdentity = false) {
      const a = arr.slice();
      for (let tries = 0; tries < 10; tries++) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        if (!avoidIdentity || a.length < 2 || a.some((x, i) => x !== arr[i])) break;
      }
      return a;
    },
    // 世界史"同一时期"：把地区文字（如"中国 / 欧洲"）归到几个颜色组，供上色和筛选
    WORLD_REGIONS: [
      ['cn', '中国', ['中国']],
      ['eu', '欧洲', ['欧洲', '英国', '罗马', '罗斯', '俄国']],
      ['am', '美洲', ['美洲', '北美', '美国']],
      ['me', '中东·中亚', ['西亚', '中东', '阿拉伯', '中亚']],
      ['sa', '南亚·东南亚', ['南亚', '东南亚', '印度洋']],
      ['ea', '日本·朝鲜·蒙古', ['日本', '朝鲜', '蒙古']],
      ['gl', '全球', []],
    ],
    regionKeys(region) {
      const keys = String(region || '').split('/').map(t => t.trim()).filter(Boolean).map(t => {
        const hit = Util.WORLD_REGIONS.find(([, , words]) => words.includes(t));
        return hit ? hit[0] : 'gl'; // 没列出的（全球、亚洲、欧亚……）都算"全球"
      });
      return keys.length ? [...new Set(keys)] : ['gl'];
    },
    // 时间段排行：每段放进第一条放得下的行（首尾不重叠），返回各段的行号
    // minLen：短时段在屏幕上有最小宽度，按至少这么长来排，免得窄屏上挤在一起
    laneRows(spans, minLen = 0) {
      const ends = [];
      return spans.map(([a, b]) => {
        let r = ends.findIndex(e => e < a);
        if (r < 0) r = ends.length;
        ends[r] = Math.max(b, a + minLen);
        return r;
      });
    },
    // 排序题：返回每个位置是否正确
    checkOrder(items) {
      const sorted = items.slice().sort((x, y) => x.year - y.year);
      return items.map((it, i) => it.year === sorted[i].year);
    },
    // 与 tools/build-map.mjs 使用同一投影公式
    project(view, lon, lat) {
      return [(lon - view.lon0) * view.cos * view.k, (view.lat1 - lat) * view.k];
    },
    inView(view, lon, lat) {
      return lon >= view.lon0 && lon <= view.lon1 && lat >= view.lat0 && lat <= view.lat1;
    },
    // 时间轴比例尺：每 25 年一格，格宽 = 事件数 + 0.35。
    // 事件密的年代（1520–1560）自动展开，空白的几百年只占一点位置但仍看得出"很长"。
    timeScale(years, width, pad = 40, bucket = 25) {
      const lo = Math.floor(Math.min(...years) / bucket) * bucket;
      const hi = (Math.floor(Math.max(...years) / bucket) + 1) * bucket;
      const n = (hi - lo) / bucket;
      const w = Array(n).fill(0.35);
      for (const y of years) w[Math.min(n - 1, Math.floor((y - lo) / bucket))] += 1;
      const cum = [0];
      for (const x of w) cum.push(cum[cum.length - 1] + x);
      const f = y => {
        const t = Math.max(lo, Math.min(hi, y));
        const i = Math.min(n - 1, Math.floor((t - lo) / bucket));
        return pad + (cum[i] + w[i] * (t - lo - i * bucket) / bucket) / cum[n] * (width - 2 * pad);
      };
      f.lo = lo; f.hi = hi; f.weight = cum[n];
      return f;
    },
    // 选主地图：从小到大，取第一张装得下所有地点的图（城市越不挤越好）。
    // 欧洲/地中海图另配新英格兰小图，所以新英格兰的地点不算在内。
    MAIN_VIEWS: ['europe', 'mediterranean', 'usa', 'atlantic', 'world'],
    INSET_OK: ['europe', 'mediterranean'],
    mainView(views, places) {
      const inNE = p => views.newEngland && Util.inView(views.newEngland, p.lon, p.lat);
      for (const k of Util.MAIN_VIEWS) {
        if (!views[k]) continue;
        const need = Util.INSET_OK.includes(k) ? places.filter(p => !inNE(p)) : places;
        if (need.every(p => Util.inView(views[k], p.lon, p.lat))) return k;
      }
      return 'world';
    },
    // 把条目分配到不重叠的"泳道"；返回每个条目的泳道号
    assignLanes(xs, widths, maxLanes) {
      const ends = [];
      return xs.map((x, i) => {
        let lane = ends.findIndex(e => e < x);
        if (lane === -1) {
          if (ends.length < maxLanes) lane = ends.length;
          else lane = ends.indexOf(Math.min(...ends));
        }
        ends[lane] = x + widths[i];
        return lane;
      });
    },
    // 课程进度：章节阅读、互动完成、测验三项平均
    lessonProgress(L, p) {
      if (!p) return 0;
      const seen = L.chapters.filter(c => p.seen && p.seen[c.id]).length / L.chapters.length;
      const done = L.activities.filter(a => p.done && p.done[a.id]).length / L.activities.length;
      const quiz = p.quiz ? 1 : 0;
      return (seen + done + quiz) / 3;
    },
    // 把名字从简介里遮住，用于"我是谁"
    maskName(text, name) {
      const parts = [name, ...String(name).split(/[·・]/)].filter(s => s && s.length >= 2);
      let out = String(text);
      for (const p of parts.sort((x, y) => y.length - x.length)) out = out.split(p).join('＿＿');
      return out;
    },
    monogram(name) {
      const parts = String(name).split(/[·・]/);
      return (parts[parts.length - 1] || name).trim().charAt(0);
    },
    // 跨课合并地点（第 8、9 课都有伦敦）
    mergePlaces(lessons) {
      const map = new Map();
      for (const L of lessons) for (const p of L.places) {
        if (!map.has(p.id)) map.set(p.id, { ...p, lessons: [L] });
        else if (!map.get(p.id).lessons.includes(L)) map.get(p.id).lessons.push(L);
      }
      return [...map.values()];
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Util;
  if (typeof document === 'undefined') return;

  /* ================= 浏览器端 ================= */
  const esc = Util.esc;
  const LESSONS = (root.COURSE_LESSONS || []).slice().sort((a, b) => a.no - b.no);
  const MAP = root.MAP_DATA;
  const byId = id => LESSONS.find(L => L.id === id);
  const OVERVIEW = root.COURSE_OVERVIEW || null;
  // 世界史视角：辅助板块，每篇对应一课（data/world-XX.js）
  const WORLD = root.COURSE_WORLD || [];
  const worldOf = L => WORLD.find(w => w.lesson === L.id);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const accentStyle = L => `--accent-raw:${esc(L.accent)}`;
  const SITE = '从耶路撒冷到山上之城';
  const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];

  // localStorage 可能不可用（隐私模式等），全部包 try
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ch:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ch:' + k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } },
  };
  const progress = {
    all() { return store.get('progress', {}); },
    of(id) { return this.all()[id] || { seen: {}, done: {}, quiz: null }; },
    update(id, fn) { const all = this.all(); const p = all[id] || { seen: {}, done: {}, quiz: null }; fn(p); all[id] = p; store.set('progress', all); },
  };

  /* ---------- 顶栏 ---------- */
  // 13 课收进下拉面板，顶栏宽度固定，手机上不用横向滑动
  function renderTopbar() {
    const bar = $('#topbar');
    bar.innerHTML = `
      <div class="topbar-in">
        <a class="brand" href="#"><span class="lat">H</span> <span class="full">${SITE}</span></a>
        <nav class="nav" aria-label="课程导航">
          ${OVERVIEW ? '<a href="#overview" data-route="overview">导论</a>' : ''}
          <div class="nav-dd">
            <button type="button" class="nav-trigger" id="btn-lessons" aria-expanded="false" aria-controls="panel-lessons"><span class="lbl">课程</span> <span class="caret" aria-hidden="true">▾</span></button>
            <div class="nav-panel lesson-panel" id="panel-lessons" hidden></div>
          </div>
          <a href="#review" data-route="review">复习</a>
          ${WORLD.length ? '<a href="#world" data-route="world">世界史</a>' : ''}
          <div class="nav-dd">
            <button type="button" class="nav-trigger" id="btn-more" aria-expanded="false" aria-controls="panel-more" aria-label="更多设置" title="更多设置">⋯</button>
            <div class="nav-panel more-panel" id="panel-more" hidden>
              <button type="button" id="btn-projector" aria-pressed="false">投影模式<small>放大字号</small></button>
              <button type="button" id="btn-theme">切换深浅色<small>◐</small></button>
            </div>
          </div>
        </nav>
      </div>
      <div class="readbar" id="readbar"></div>`;
    $$('#topbar .nav-trigger').forEach(btn => btn.onclick = () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      closeNavPanels();
      if (!open) return;
      // 每次打开都重画，✓ 反映最新进度
      if (btn.id === 'btn-lessons') fillLessonPanel();
      btn.setAttribute('aria-expanded', 'true');
      $('#' + btn.getAttribute('aria-controls')).hidden = false;
    });
    $('#btn-projector').setAttribute('aria-pressed', String(document.documentElement.classList.contains('projector')));
    $('#btn-projector').onclick = () => {
      const on = document.documentElement.classList.toggle('projector');
      $('#btn-projector').setAttribute('aria-pressed', String(on));
      store.set('projector', on);
    };
    $('#btn-theme').onclick = () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      store.set('theme', dark ? 'light' : 'dark');
    };
    // 点面板外或按 Esc 关闭；Esc 后焦点回到按钮，键盘用户不迷路
    document.addEventListener('click', e => { if (!e.target.closest('.nav-dd')) closeNavPanels(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const btn = $('#topbar .nav-trigger[aria-expanded="true"]');
      if (btn) { closeNavPanels(); btn.focus(); }
    });
  }
  function fillLessonPanel() {
    // 世界史页面不算"在某一课"，和按钮文字保持一致
    const cur = decodeURIComponent(location.hash.slice(1));
    // 进度口径同首页书架（章节、互动、测验三项平均）：没开始不标，学了一部分显示百分比，全部完成打 ✓
    $('#panel-lessons').innerHTML = LESSONS.map(L => {
      const p = Util.lessonProgress(L, progress.of(L.id));
      // 和课内目录一样四舍五入；没学完最多 99%，学了一点最少 1%，免得和 ✓、空白混淆
      const pct = p > 0 && p < 1 ? Math.min(99, Math.max(1, Math.round(p * 100))) : 0;
      const mark = p >= 1 ? '<span class="ck" title="已学完">✓</span>' : pct > 0 ? `<span class="pct" title="已完成 ${pct}%">${pct}%</span>` : '';
      return `<a href="#${esc(L.id)}" style="${accentStyle(L)}"${L.id === cur ? ' aria-current="page"' : ''}>
        <span class="no">第${CN_NUM[L.no] || L.no}课${mark}</span>
        <span class="t">${esc(L.title)}</span>${p > 0 && p < 1 ? `<i class="bar" aria-hidden="true"><b style="width:${pct}%"></b></i>` : ''}</a>`;
    }).join('');
    $$('#panel-lessons a').forEach(a => a.onclick = closeNavPanels);
  }
  function closeNavPanels() {
    $$('#topbar .nav-trigger').forEach(b => b.setAttribute('aria-expanded', 'false'));
    $$('#topbar .nav-panel').forEach(p => { p.hidden = true; });
  }
  function markNav(route) {
    const navKey = route.startsWith('world/') ? 'world' : route;
    $$('#topbar [data-route]').forEach(a => {
      if (a.dataset.route === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const L = byId(route);
    // 在某一课里时，按钮直接显示"第五课"，一眼知道自己在哪
    const trig = $('#btn-lessons');
    if (trig) {
      $('.lbl', trig).textContent = L ? `第${CN_NUM[L.no] || L.no}课` : '课程';
      trig.classList.toggle('is-current', !!L);
    }
    closeNavPanels();
    document.body.setAttribute('style', L ? accentStyle(L) : '');
  }

  /* ---------- 路由 ---------- */
  let cleanup = [];
  function route() {
    cleanup.forEach(f => f()); cleanup = [];
    hidePopover();
    const id = decodeURIComponent(location.hash.slice(1));
    const main = $('#main');
    main.innerHTML = '';
    if (byId(id)) { renderLesson(main, byId(id)); store.set('last', id); document.title = byId(id).title + ' · ' + SITE; }
    else if (id === 'review') { renderReview(main); document.title = '复习 · ' + SITE; }
    else if (id === 'overview' && OVERVIEW) { renderOverview(main); document.title = OVERVIEW.title + ' · ' + SITE; }
    else if (id === 'world' && WORLD.length) { renderWorldIndex(main); document.title = '世界史视角 · ' + SITE; }
    else if (id.startsWith('world/') && byId(id.slice(6)) && worldOf(byId(id.slice(6)))) {
      const L = byId(id.slice(6));
      renderWorld(main, L, worldOf(L)); document.title = worldOf(L).title + ' · ' + SITE;
    }
    else { renderHome(main); document.title = SITE; }
    markNav(id);
    if (id === 'world' || id.startsWith('world/')) document.documentElement.dataset.section = 'world';
    else delete document.documentElement.dataset.section;
    window.scrollTo(0, 0);
  }

  /* ================= 首页 ================= */
  function renderHome(main) {
    const count = k => LESSONS.reduce((n, L) => n + (L[k] || []).length, 0);
    const last = byId(store.get('last', ''));
    const first = LESSONS[0];
    const shelfN = LESSONS.length + (OVERVIEW ? 1 : 0);
    const v = el(`<div class="view">
      <header class="hero">
        <div>
          <p class="eyebrow hero-press">教会史 · 第 ${LESSONS[0].no}–${LESSONS[LESSONS.length - 1].no} 课</p>
          <h1 class="hero-press">从耶路撒冷<span class="to">— 使徒行传 8 章 · 1662 —</span>到山上之城</h1>
          <p class="lede">从耶路撒冷的逼迫，到尼西亚的信经；从东西方的分裂，到维滕堡的一扇门、清教徒的新英格兰。跟着殉道者、教父、改教家和清教徒，走一遍神在历史中保守、复兴祂教会的路。</p>
          <div class="btn-row">
            ${last ? `<a class="btn" href="#${esc(last.id)}">继续：第 ${last.no} 课 ${esc(last.title)}</a>` : `<a class="btn" href="#${esc(first.id)}">从第 ${first.no} 课开始</a>`}
            ${OVERVIEW ? `<a class="btn ghost" href="#overview">先看${esc(OVERVIEW.title)}</a>` : ''}
            <a class="btn ghost" href="#review">复习与测验</a>
          </div>
        </div>
        <aside class="colophon" aria-label="课程概览">
          <span class="big">${LESSONS.length}</span> 课 · 约 ${LESSONS[LESSONS.length - 1].years[1] - LESSONS[0].years[0]} 年的历史
          <dl>
            <dt>人物</dt><dd>${count('people')} 位</dd>
            <dt>事件</dt><dd>${count('events')} 件</dd>
            <dt>互动</dt><dd>${count('activities')} 个</dd>
            <dt>测验题</dt><dd>${count('quiz')} 道</dd>
            <dt>关键词</dt><dd>${count('terms')} 个（也是闪卡）</dd>
          </dl>
        </aside>
      </header>

      <section class="block">
        <div class="block-head"><h2>${CN_NUM[LESSONS.length] || LESSONS.length}卷书</h2><span class="aside">点一本书开始；进度保存在本机浏览器</span></div>
        <div class="shelf" style="--n:${shelfN <= 5 ? shelfN : Math.ceil(shelfN / 2)}">
          ${OVERVIEW ? `<a class="book intro" href="#overview">
              <span class="band t"></span>
              <span class="no">序</span>
              <h3>导论：${esc(OVERVIEW.title)}</h3>
              <span class="sub">${esc(OVERVIEW.subtitle || '')}</span>
              <span class="yrs">${LESSONS[0].years[0]}–${LESSONS[LESSONS.length - 1].years[1]}</span>
              <span class="band b"></span>
            </a>` : ''}
          ${LESSONS.map(L => {
            const pct = Math.round(Util.lessonProgress(L, progress.of(L.id)) * 100);
            return `<a class="book" href="#${esc(L.id)}" style="${accentStyle(L)}">
              <span class="band t"></span>
              <span class="no">${L.no}</span>
              <h3>${esc(L.title)}</h3>
              <span class="sub">${esc(L.subtitle || '')}</span>
              <span class="yrs">${L.years[0]}–${L.years[1]}</span>
              <span class="prog"><i><b style="width:${pct}%"></b></i>${pct}%</span>
              <span class="band b"></span>
            </a>`;
          }).join('')}
        </div>
      </section>

      <section class="block">
        <div class="block-head"><h2>时间长河</h2><span class="aside">左右滑动；点任意事件看详情</span></div>
        <div id="home-tl"></div>
      </section>

      <section class="block">
        <div class="block-head"><h2>地图上的教会史</h2><span class="aside">点城市看发生了什么</span></div>
        <div id="home-map"></div>
      </section>

      <section class="block">
        <div class="block-head"><h2>课后复习</h2></div>
        <div class="tools">
          <a class="tool" href="#review" data-tab="flash"><h3>关键词闪卡</h3><p>翻卡片记住 ${count('terms')} 个关键词：唯独信心、规范性原则、半途契约……</p></a>
          <a class="tool" href="#review" data-tab="order"><h3>时间线挑战</h3><p>随机抽 6 件大事，排出先后。</p></a>
          <a class="tool" href="#review" data-tab="who"><h3>我是谁？</h3><p>读简介，猜人物。</p></a>
          <a class="tool" href="#review" data-tab="quiz"><h3>混合测验</h3><p>从各课里随机抽 10 题。</p></a>
          ${WORLD.length ? '<a class="tool" href="#world"><h3>世界史视角</h3><p>对照阅读：世界通史和国内教材怎样讲同一段历史。</p></a>' : ''}
        </div>
      </section>

      <section class="block">
        <div class="block-head"><h2>怎么用这个网站</h2></div>
        <div class="howto">
          <div><h3>学员</h3><ul><li>每课先读故事，遇到带下划线的词可以点开解释。</li><li>章节之间的互动都做一做，做完会打勾。</li><li>最后做测验、想一想讨论题。</li></ul></div>
          <div><h3>老师上课</h3><ul><li>点右上角「投影」放大字号，直接投屏讲。</li><li>情境题（"你会怎么选？"）适合现场举手投票。</li><li>讨论题可以直接用于小组时间。</li></ul></div>
          <div><h3>修改内容</h3><ul><li>每课内容在 <code>data/lesson-XX.js</code>，改文字不用碰代码。</li><li>格式说明见 <code>docs/content-schema.md</code>。</li></ul></div>
        </div>
      </section>
    </div>`);
    main.appendChild(v);
    $$('.tool[data-tab]', v).forEach(a => a.addEventListener('click', () => store.set('reviewTab', a.dataset.tab)));
    $('#home-tl', v).appendChild(timelineView(LESSONS, { filter: true }));
    $('#home-map', v).appendChild(homeMap(LESSONS));
  }

  /* ================= 导论：两千年一览 ================= */
  // 每课取标了 milestone 的事件；数据测试保证每课恰好一件
  function renderOverview(main) {
    const O = OVERVIEW;
    const ms = L => L.events.find(e => e.milestone);
    const t0 = 0, t1 = 2000;
    const pct = y => ((Math.min(Math.max(y, t0), t1) - t0) / (t1 - t0) * 100).toFixed(2) + '%';
    const ticks = [];
    for (let y = t0; y <= t1; y += 250) ticks.push(y);
    const lessonOf = no => LESSONS.find(L => L.no === no);
    const v = el(`<div class="view overview">
      <header class="ov-head">
        <p class="eyebrow">导论</p>
        <h1>${esc(O.title)}</h1>
        ${O.subtitle ? `<p class="ov-sub">${esc(O.subtitle)}</p>` : ''}
        <p class="lede">${esc(O.lede || '')}</p>
      </header>

      <section class="block">
        <div class="block-head"><h2>按真实比例</h2><span class="aside">色条是每课覆盖的年代，圆点是代表事件；点一行进入那一课</span></div>
        <div class="gantt" role="list">
          <div class="g-axis" aria-hidden="true"><span class="g-lab"></span><span class="g-track">${ticks.map(y => `<i style="left:${pct(y)}">${y}</i>`).join('')}</span></div>
          ${LESSONS.map(L => {
            const e = ms(L);
            return `<a class="g-row" role="listitem" href="#${esc(L.id)}" style="${accentStyle(L)}" title="${esc(L.title)}">
              <span class="g-lab"><b>${L.no}</b> ${esc(L.title)}</span>
              <span class="g-track">
                <span class="g-bar" style="left:${pct(L.years[0])};width:calc(${pct(L.years[1])} - ${pct(L.years[0])})"></span>
                ${e ? `<span class="g-dot" style="left:${pct(e.year)}" title="${e.year} ${esc(e.title)}"></span>` : ''}
              </span>
            </a>`;
          }).join('')}
        </div>
      </section>

      ${(O.eras || []).map(era => `<section class="block ov-era">
        <div class="block-head"><h2>${esc(era.name)}</h2><span class="aside lat">${esc(era.years || '')}</span></div>
        ${era.note ? `<p class="ov-note">${esc(era.note)}</p>` : ''}
        <ol class="ov-list">
          ${era.lessons.map(lessonOf).filter(Boolean).map(L => {
            const e = ms(L);
            return `<li style="${accentStyle(L)}">
              <span class="ov-year">${e ? e.year : ''}</span>
              <div>
                <p class="ov-lesson">第 ${L.no} 课 · ${esc(L.title)}</p>
                <h3>${esc(e ? e.title : L.subtitle || '')}</h3>
                ${e && e.desc ? `<p>${esc(e.desc)}</p>` : ''}
                <a class="ov-go" href="#${esc(L.id)}">进入第 ${L.no} 课 →</a>
              </div>
            </li>`;
          }).join('')}
        </ol>
      </section>`).join('')}

      <div class="btn-row ov-next"><a class="btn" href="#${esc(LESSONS[0].id)}">从第 ${LESSONS[0].no} 课开始</a><a class="btn ghost" href="#">回首页</a></div>
    </div>`);
    main.appendChild(v);
  }

  /* ================= 世界史视角（辅助板块） ================= */
  // 独立于课文：转述世俗史学的讲法，最后用"对照"框和本课比较。正文不做护教式反驳。
  // 视觉上和课文刻意不同（"地图探索"风格，见 style.css 的 [data-section="world"]），让人一眼知道这是辅助板块。
  const WX_SPAN = [0, 2000]; // 目录页"时间长河"的刻度范围
  const wxPct = y => ((y - WX_SPAN[0]) / (WX_SPAN[1] - WX_SPAN[0]) * 100).toFixed(2);
  const lessonStyle = L => `--lesson-raw:${esc(L.accent)}`;
  // 装饰用的地球经纬线，aria-hidden
  const WX_GLOBE = `<svg class="wx-globe" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92"/><ellipse cx="100" cy="100" rx="40" ry="92"/><ellipse cx="100" cy="100" rx="74" ry="92"/><line x1="100" y1="8" x2="100" y2="192"/><ellipse cx="100" cy="100" rx="92" ry="30"/><ellipse cx="100" cy="100" rx="92" ry="62"/><line x1="8" y1="100" x2="192" y2="100"/></svg>`;
  const WX_NOTE = '这里转述的是世俗史学的讲法，不代表本课程立场；教材观点是转述大意，不是原文。';

  function renderWorldIndex(main) {
    const riverRows = Util.laneRows(LESSONS.filter(worldOf).map(L => L.years), 130); // 130 年 ≈ 手机宽度下一个编号的宽度
    const v = el(`<div class="view world wx">
      <header class="wx-hero">
        ${WX_GLOBE}
        <p class="wx-kicker">辅助板块 · 世界史视角</p>
        <h1>换一副眼镜，看同一段历史</h1>
        <p class="wx-lede">本课程是教会史，从信仰出发讲神怎样保守祂的教会。这个板块换一个角度：世界通史——西方学界主流和国内高校教材——怎样描述、解读同一段历史。每篇对应一课，最后有一个「对照」框，供小组讨论。</p>
        <div class="wx-stats">
          <span><b>${WORLD.length}</b>篇</span>
          <span><b>${WORLD.reduce((n, w) => n + w.world.length, 0)}</b>件同期大事</span>
          <span><b>2</b>种解读</span>
        </div>
      </header>
      <p class="wx-note">${WX_NOTE}</p>

      <section class="block">
        <div class="wx-head"><h2>两千年时间长河</h2><span>点一段，直接进入那一篇</span></div>
        <nav class="wx-river" aria-label="按年代选篇" style="--rows:${Math.max(...riverRows) + 1}">
          ${LESSONS.filter(worldOf).map((L, i) => `<a class="wx-seg" href="#world/${esc(L.id)}" style="${lessonStyle(L)};left:${wxPct(L.years[0])}%;width:max(${(wxPct(L.years[1]) - wxPct(L.years[0])).toFixed(2)}%,1.5rem);--row:${riverRows[i]}" title="第 ${L.no} 课 · ${esc(worldOf(L).title)}（${L.years[0]}–${L.years[1]}）"><span>${L.no}</span></a>`).join('')}
          <div class="wx-axis" aria-hidden="true">${[0, 500, 1000, 1500, 2000].map(y => `<span style="left:${wxPct(y)}%">${y}</span>`).join('')}</div>
        </nav>
      </section>

      <section class="block">
        <div class="wx-head"><h2>十三站</h2><span>每一站对应课程的一课</span></div>
        <ol class="wx-dests">
          ${LESSONS.filter(worldOf).map(L => {
            const W = worldOf(L);
            return `<li class="wx-dest" style="${lessonStyle(L)}">
              <a href="#world/${esc(L.id)}">
                <span class="wx-no">${L.no}</span>
                <span class="wx-yrs">${L.years[0]}–${L.years[1]}</span>
                <h3>${esc(W.title)}</h3>
                ${W.subtitle ? `<p class="wx-sub">${esc(W.subtitle)}</p>` : ''}
                <p class="wx-from">对应第 ${L.no} 课 · ${esc(L.title)}</p>
                <span class="wx-bar" aria-hidden="true"><i style="left:${wxPct(L.years[0])}%;width:max(${(wxPct(L.years[1]) - wxPct(L.years[0])).toFixed(2)}%,4px)"></i></span>
                <span class="wx-go">出发 →</span>
              </a>
            </li>`;
          }).join('')}
        </ol>
      </section>
    </div>`);
    main.appendChild(v);
  }

  function renderWorld(main, L, W) {
    const regionsUsed = Util.WORLD_REGIONS.filter(([k]) => W.world.some(e => Util.regionKeys(e.region).includes(k)));
    const colCls = ['c-lesson', 'c-west', 'c-cn']; // 对照表三栏：本课 / 西方学界 / 国内教材
    const idx = W.chapters.length > 1;
    const v = el(`<div class="view world wx" style="${lessonStyle(L)}">
      <header class="wx-hero">
        ${WX_GLOBE}
        <p class="wx-kicker">世界史视角 · 对应第 ${L.no} 课</p>
        <h1>${esc(W.title)}</h1>
        ${W.subtitle ? `<p class="wx-subtitle">${esc(W.subtitle)}</p>` : ''}
        <p class="wx-lede">${esc(W.summary)}</p>
        <div class="wx-stats">
          ${W.years ? `<span><b>${W.years[0]}–${W.years[1]}</b></span>` : ''}
          <span><b>${W.world.length}</b>件同期大事</span>
          <span><b>${regionsUsed.length}</b>个地区</span>
          <span><b>${W.views.length}</b>种解读</span>
        </div>
        <div class="btn-row wx-btns"><a class="btn" href="#${esc(L.id)}">← 回到第 ${L.no} 课</a><a class="btn ghost" href="#world">全部篇目</a></div>
      </header>
      <p class="wx-note">${WX_NOTE}与本课的异同放在最后的「对照」里。</p>

      <section class="block">
        <div class="wx-head"><h2>带走什么</h2></div>
        <ol class="wx-keys">${W.keyPoints.map((k, i) => `<li><span class="wx-k">${i + 1}</span><p>${esc(k)}</p></li>`).join('')}</ol>
      </section>

      <section class="block world-story">
        <div class="wx-head"><h2>世界史怎么讲</h2><span>按世界通史的叙述，约为本课篇幅的三分之一</span></div>
        ${idx ? `<nav class="wx-chnav" aria-label="章节">${W.chapters.map((c, i) => `<button type="button" data-go="wch-${esc(c.id)}"><b>${i + 1}</b>${esc(c.title)}</button>`).join('')}</nav>` : ''}
        <div class="wx-chs">
        ${W.chapters.map((c, i) => `<article class="chapter wx-ch" id="wch-${esc(c.id)}">
          <div class="wx-pin" aria-hidden="true">${i + 1}</div>
          <div class="ch-meta">${c.years ? `<span class="wx-yr">${esc(c.years)}</span>` : ''}</div>
          <h2>${esc(c.title)}</h2>
          <div class="body">${c.body.map(t => `<p>${esc(t)}</p>`).join('')}</div>
          ${c.highlight ? `<aside class="wx-fact"><span class="tag">${c.highlight.type === 'fact' ? '同一时刻' : '批注'}</span>${esc(c.highlight.text)}${c.highlight.source ? `<cite>—— ${esc(c.highlight.source)}</cite>` : ''}</aside>` : ''}
        </article>`).join('')}
        </div>
      </section>

      <section class="block">
        <div class="wx-head"><h2>同一时期的世界</h2><span>左右滑动；点地区只看那里</span></div>
        <div class="wx-filter" role="group" aria-label="按地区筛选">
          <button type="button" data-rg="" aria-pressed="true">全部</button>
          ${regionsUsed.map(([k, label]) => `<button type="button" class="rg-${k}" data-rg="${k}" aria-pressed="false">${esc(label)}</button>`).join('')}
        </div>
        <ol class="wx-strip">${W.world.map(e => {
          const ks = Util.regionKeys(e.region);
          return `<li class="wx-ev rg-${ks[0]}" data-rg="${ks.join(' ')}"><span class="wx-dot" aria-hidden="true"></span><span class="lat">${e.year}</span><span class="wx-rg">${esc(e.region)}</span><p>${esc(e.text)}</p></li>`;
        }).join('')}</ol>
      </section>

      <section class="block">
        <div class="wx-head"><h2>两种解读</h2><span>同样的史实，不同的解释框架</span></div>
        <div class="wx-tabs" role="tablist">
          ${W.views.map((vw, i) => `<button type="button" role="tab" id="wxt-${esc(vw.id)}" class="v-${esc(vw.id)}" aria-controls="wxp-${esc(vw.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(vw.label)}</button>`).join('')}
        </div>
        <div class="world-views">
          ${W.views.map((vw, i) => `<article class="world-view v-${esc(vw.id)}" role="tabpanel" id="wxp-${esc(vw.id)}" aria-labelledby="wxt-${esc(vw.id)}" ${i === 0 ? '' : 'hidden'}>
            <p class="wx-frame"><span class="tag">解释框架</span>${esc(vw.frame)}</p>
            <ol class="wx-points">${vw.points.map((pt, j) => `<li><span class="wx-pn">${j + 1}</span><h4>${esc(pt.title)}</h4><p>${esc(pt.body)}</p></li>`).join('')}</ol>
            <details class="world-src"><summary>代表著作 · ${vw.sources.length} 种</summary><ul class="reading">${vw.sources.map(r => `<li><div>${esc(r.title)}</div><div class="au">${esc(r.author || '')}</div>${r.note ? `<div class="nt">${esc(r.note)}</div>` : ''}</li>`).join('')}</ul></details>
          </article>`).join('')}
        </div>
      </section>

      <section class="block">
        <div class="wx-head"><h2>三种讲法一览</h2><span>同一个问题，三种回答</span></div>
        <div class="wx-cmp world-cmp">
          ${W.table.rows.map(r => `<div class="wx-row">
            <h3>${esc(r.topic)}</h3>
            <div class="wx-cells">${r.cells.map((c, i) => `<div class="wx-cell ${colCls[i] || ''}"><span class="tag">${esc(W.table.columns[i])}</span><p>${esc(c)}</p></div>`).join('')}</div>
          </div>`).join('')}
        </div>
      </section>

      <section class="block world-contrast">
        <div class="wx-head"><h2>对照</h2><span>和第 ${L.no} 课放在一起看</span></div>
        <div class="wx-ad">
          <div class="wx-agree"><h3>共识</h3><ul>${W.contrast.agree.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
          <div class="wx-differ"><h3>分歧</h3><ul>${W.contrast.differ.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
        </div>
        <h3 class="wx-qh">小组讨论</h3>
        <ol class="wx-qs">${W.contrast.questions.map((t, i) => `<li><span class="lat">Q${i + 1}</span><p>${esc(t)}</p></li>`).join('')}</ol>
      </section>

      ${W.terms && W.terms.length ? `<section class="block"><div class="wx-head"><h2>关键词</h2><span>点卡片翻面</span></div>
        <ul class="wx-flips">${W.terms.map(t => `<li><button type="button" class="wx-flip" aria-pressed="false">
          <span class="wx-face wx-front"><b>${esc(t.term)}</b><span class="lat">${esc(t.en || '')}</span><i>翻面看解释</i></span>
          <span class="wx-face wx-back"><b>${esc(t.term)}</b>${esc(t.def)}</span>
        </button></li>`).join('')}</ul></section>` : ''}
      ${W.notes && W.notes.length ? `<section class="block"><details class="wx-notes"><summary>待核 · ${W.notes.length} 条<span>写作时没有逐页核对原书的地方，引用前请核对</span></summary><ul>${W.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details></section>` : ''}
    </div>`);

    // 章节导航：hash 用于路由，所以用按钮 + scrollIntoView，不用锚点
    $$('.wx-chnav [data-go]', v).forEach(b => b.onclick = () => document.getElementById(b.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'start' }));

    // 地区筛选
    const fbtns = $$('.wx-filter button', v);
    fbtns.forEach(b => b.onclick = () => {
      fbtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $$('.wx-ev', v).forEach(li => { li.hidden = !!b.dataset.rg && !li.dataset.rg.split(' ').includes(b.dataset.rg); });
      $('.wx-strip', v).scrollLeft = 0;
    });

    // 两种解读：标签页，左右方向键切换
    const tabs = $$('[role="tab"]', v);
    const pick = t => tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.onclick = () => pick(t);
      t.onkeydown = e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; pick(n); n.focus(); e.preventDefault(); }
      };
    });

    // 关键词翻卡
    $$('.wx-flip', v).forEach(b => b.onclick = () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));

    main.appendChild(v);
  }

  /* ---------- 时间轴 ---------- */
  function timelineView(lessons, { filter = false } = {}) {
    const wrap = el(`<div>${filter ? '<div class="tl-filters" role="group" aria-label="按课筛选"></div>' : ''}<div class="tl-scroll"></div><div class="tl-detail" aria-live="polite"><p class="muted">点时间轴上的事件查看详情。</p></div></div>`);
    let active = new Set(lessons.map(L => L.id));
    const draw = () => {
      const evs = [];
      for (const L of lessons) if (active.has(L.id)) for (const e of L.events) evs.push({ ...e, L });
      evs.sort((a, b) => a.year - b.year);
      // 事件越多画布越宽，保证密集的 1520–1560 年间标签不互相覆盖
      const bands = lessons.filter(L => active.has(L.id));
      const yrs = evs.map(e => e.year).concat(...bands.map(L => L.years));
      const W = Math.max(1400, Math.round(Util.timeScale(yrs, 1000).weight * 58));
      const X = Util.timeScale(yrs, W);
      const xs = evs.map(e => X(e.year));
      const widths = evs.map(e => 64 + e.title.length * 13.5);
      const lanes = Util.assignLanes(xs.map(x => x - 6), widths, 16);
      const nUp = Math.ceil((Math.max(0, ...lanes) + 1) / 2);
      const axisY = 30 + nUp * 30 + 20;
      const bandsY = axisY + 12;
      const downStart = bandsY + lessons.length * 11 + 30;
      const nDown = Math.floor((Math.max(0, ...lanes) + 1) / 2);
      const H = downStart + nDown * 30 + 20;
      const tl = el(`<div class="tl" style="width:${W}px;height:${H}px"></div>`);
      tl.appendChild(el(`<div class="tl-axis" style="top:${axisY}px"></div>`));
      // 刻度每 50 年一个，太挤的跳过；比例尺不均匀，所以刻度间距本身就提示"这里被压缩了"
      let lastX = -Infinity;
      for (let t = Math.ceil(X.lo / 50) * 50; t <= X.hi; t += 50) {
        const x = X(t);
        if (x - lastX < 56) continue;
        lastX = x;
        tl.appendChild(el(`<span class="tl-tick" style="left:${x}px;top:${axisY + 58 + lessons.length * 11}px">${t}</span>`));
      }
      lessons.forEach((L, i) => {
        if (!active.has(L.id)) return;
        const x0 = X(L.years[0]), x1 = X(L.years[1]);
        tl.appendChild(el(`<div class="tl-band" title="第 ${L.no} 课 ${esc(L.title)}" style="${accentStyle(L)};left:${x0}px;width:${x1 - x0}px;top:${bandsY + i * 11}px"></div>`));
      });
      evs.forEach((e, i) => {
        const lane = lanes[i];
        const up = lane % 2 === 0, k = Math.floor(lane / 2);
        const y = up ? axisY - 40 - k * 30 : downStart + k * 30;
        const stemTop = up ? y + 10 : axisY, stemH = up ? axisY - y - 10 : y - axisY;
        tl.appendChild(el(`<div class="tl-stem" style="${accentStyle(e.L)};left:${xs[i]}px;top:${stemTop}px;height:${stemH}px"></div>`));
        const b = el(`<button type="button" class="tl-ev" style="${accentStyle(e.L)};left:${xs[i]}px;top:${y - 10}px" aria-pressed="false"><span class="dot"></span><span class="lbl"><span class="yr">${e.year}</span> ${esc(e.title)}</span></button>`);
        b.onclick = () => {
          $$('.tl-ev', tl).forEach(x => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          const d = $('.tl-detail', wrap);
          d.setAttribute('style', accentStyle(e.L));
          d.innerHTML = `<h4><span class="lat">${e.year}</span>${esc(e.title)}</h4><p>${esc(e.desc)}</p><a href="#${esc(e.L.id)}">第 ${e.L.no} 课 · ${esc(e.L.title)} →</a>`;
        };
        tl.appendChild(b);
      });
      const sc = $('.tl-scroll', wrap);
      sc.innerHTML = '';
      sc.appendChild(tl);
      sc.scrollLeft = 0;
    };
    if (filter) {
      const f = $('.tl-filters', wrap);
      const all = el(`<button type="button" class="chip" aria-pressed="true">全部</button>`);
      f.appendChild(all);
      const chips = lessons.map(L => {
        const c = el(`<button type="button" class="chip" aria-pressed="false">第 ${L.no} 课 · ${esc(L.title)}</button>`);
        c.onclick = () => { active = new Set([L.id]); all.setAttribute('aria-pressed', 'false'); chips.forEach(x => x.setAttribute('aria-pressed', String(x === c))); draw(); };
        f.appendChild(c);
        return c;
      });
      all.onclick = () => { active = new Set(lessons.map(L => L.id)); all.setAttribute('aria-pressed', 'true'); chips.forEach(x => x.setAttribute('aria-pressed', 'false')); draw(); };
    }
    draw();
    return wrap;
  }

  /* ---------- 地图 ---------- */
  // 首页地图：九课的城市全画在一张图上会挤成一团，所以默认只显示"早期教会"或"宗教改革"一组，也可单选某课
  function homeMap(lessons) {
    const wrap = el(`<div><div class="tl-filters" role="group" aria-label="按课筛选"></div><div class="map-host"></div></div>`);
    const f = $('.tl-filters', wrap), host = $('.map-host', wrap);
    const groups = [
      { label: '第 1–5 课 · 早期与中世纪', ls: lessons.filter(L => L.no <= 5) },
      { label: '第 6–9 课 · 宗教改革', ls: lessons.filter(L => L.no >= 6 && L.no <= 9) },
      { label: '第 10–13 课 · 觉醒与宣教', ls: lessons.filter(L => L.no >= 10) },
    ].filter(g => g.ls.length);
    const opts = groups.concat(lessons.map(L => ({ label: `第 ${L.no} 课`, ls: [L] })));
    const chips = opts.map(o => {
      const c = el(`<button type="button" class="chip" aria-pressed="false">${esc(o.label)}</button>`);
      c.onclick = () => show(o, c);
      f.appendChild(c);
      return c;
    });
    function show(o, c) {
      chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
      host.innerHTML = '';
      host.appendChild(mapView({ places: Util.mergePlaces(o.ls), lessons: o.ls }));
    }
    if (opts.length) show(opts[0], chips[0]);
    return wrap;
  }

  function mapView({ places, lessons, journey }) {
    const wrap = el(`<div><div class="tl-scroll map-scroll"><div class="map-wrap" style="min-width:640px"></div></div><div class="map-info" aria-live="polite"><p class="muted">点地图上的城市。</p></div></div>`);
    if (!MAP) { $('.map-wrap', wrap).innerHTML = '<p class="empty">地图数据未加载</p>'; return wrap; }
    const mw = $('.map-wrap', wrap);
    const main = Util.mainView(MAP, places);
    const views = { [main]: MAP[main], newEngland: MAP.newEngland };
    const insetOK = Util.INSET_OK.includes(main);
    const where = p => Util.inView(views[main], p.lon, p.lat) ? main : (insetOK && Util.inView(views.newEngland, p.lon, p.lat) ? 'newEngland' : null);
    const svgs = {};
    const needInset = places.some(p => where(p) === 'newEngland');

    for (const key of [main, 'newEngland']) {
      if (key === 'newEngland' && !needInset) continue;
      const V = views[key];
      let grid = '';
      if (key === main) {
        // 经纬线间隔随地图范围放大，保持每张图大约 5–10 条
        const [step, latStep] = { europe: [5, 5], mediterranean: [10, 5], usa: [10, 10], atlantic: [20, 10], world: [30, 20] }[main];
        const hemi = (n, pos, neg) => `${Math.abs(n)}°${n < 0 ? neg : pos}`;
        for (let lon = Math.ceil(V.lon0 / step) * step; lon <= V.lon1; lon += step) { const [x] = Util.project(V, lon, 0); grid += `<path class="map-grid" d="M${x.toFixed(1)},0V${V.height}"/><text class="map-grid-lbl" x="${x + 3}" y="${V.height - 6}">${hemi(lon, 'E', 'W')}</text>`; }
        for (let lat = Math.floor(V.lat0 / latStep) * latStep + latStep; lat < V.lat1; lat += latStep) { const [, y] = Util.project(V, 0, lat); grid += `<path class="map-grid" d="M0,${y.toFixed(1)}H${V.width}"/><text class="map-grid-lbl" x="${V.width - 34}" y="${y - 4}">${hemi(lat, 'N', 'S')}</text>`; }
      }
      const label = { europe: '欧洲地图', mediterranean: '地中海世界地图', usa: '北美地图', atlantic: '大西洋两岸地图', world: '世界地图', newEngland: '新英格兰地图' }[key];
      const svg = el(`<svg viewBox="0 0 ${V.width} ${V.height}" role="img" aria-label="${label}"><path class="map-land" d="${V.path}"/>${grid}<g class="jr"></g><g class="pts"></g></svg>`);
      svgs[key] = svg;
      if (key === main) mw.appendChild(svg);
      else { const box = el(`<div class="map-inset"><span class="cap">新英格兰（北美）</span></div>`); box.appendChild(svg); mw.appendChild(box); }
    }

    // 标签避让：右、左、上、下，都放不下就只显示圆点
    const boxes = { [main]: [], newEngland: [] };
    const overlaps = (b, list) => list.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    const ptEls = {};
    const pts = places.map(p => ({ p, key: where(p) })).filter(o => o.key);
    for (const { p, key } of pts) { const [x, y] = Util.project(views[key], p.lon, p.lat); boxes[key].push({ x: x - 8, y: y - 8, w: 16, h: 16 }); }
    for (const { p, key } of pts) {
      const [x, y] = Util.project(views[key], p.lon, p.lat);
      const w = p.name.length * 17 + 4, h = 20;
      const cands = [[x + 11, y + 6, 'start', x + 9, y - 12], [x - 11, y + 6, 'end', x - 9 - w, y - 12], [x, y - 13, 'middle', x - w / 2, y - 30], [x, y + 25, 'middle', x - w / 2, y + 9]];
      let lbl = '';
      for (const [tx, ty, anchor, bx, by] of cands) {
        const b = { x: bx, y: by, w, h };
        if (bx < 0 || by < 0 || bx + w > views[key].width || by + h > views[key].height) continue;
        if (!overlaps(b, boxes[key])) { boxes[key].push(b); lbl = `<text x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(p.name)}</text>`; break; }
      }
      const L = (p.lessons && p.lessons[0]) || (lessons && lessons[0]);
      const g = el(`<svg><g class="map-pt" tabindex="0" role="button" aria-label="${esc(p.name)}" style="${L ? accentStyle(L) : ''}"><circle cx="${x}" cy="${y}" r="7"/>${lbl}</g></svg>`).firstElementChild;
      g.addEventListener('click', () => pick(p));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p); } });
      $('.pts', svgs[key]).appendChild(g);
      ptEls[p.id] = g;
    }
    function pick(p) {
      Object.values(ptEls).forEach(g => g.classList.remove('on'));
      if (ptEls[p.id]) ptEls[p.id].classList.add('on');
      const evs = [];
      for (const L of (lessons || [])) for (const e of L.events) if (e.place === p.id) evs.push({ ...e, L });
      evs.sort((a, b) => a.year - b.year);
      const info = $('.map-info', wrap);
      const L = p.lessons ? p.lessons[0] : null;
      info.setAttribute('style', L ? accentStyle(L) : '');
      info.innerHTML = `<h4>${esc(p.name)}<small>${esc(p.nameEn || '')}</small></h4><p>${esc(p.note || '')}</p>` +
        (evs.length ? `<ul>${evs.map(e => `<li><span class="lat">${e.year}</span> ${esc(e.title)} <a href="#${esc(e.L.id)}" class="muted">第 ${e.L.no} 课</a></li>`).join('')}</ul>` : '');
    }
    wrap.pick = pick;

    // 旅程模式：画路线 + 可移动的标记
    if (journey) {
      const V = views[main], svg = svgs[main];
      const stops = journey.stops.map(s => ({ ...s, place: places.find(p => p.id === s.place) })).filter(s => s.place && where(s.place) === main);
      const xy = stops.map(s => Util.project(V, s.place.lon, s.place.lat));
      const path = el(`<svg><path class="jr-path" d="M${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join('L')}"/></svg>`).firstElementChild;
      const marker = el(`<svg><g class="jr-marker"><circle r="11"/></g></svg>`).firstElementChild;
      $('.jr', svg).appendChild(path);
      $('.jr', svg).appendChild(marker);
      const len = path.getTotalLength ? path.getTotalLength() : 0;
      // 各站在路径上的累计长度，用来按站"画出"路线
      const segLen = [0];
      for (let i = 1; i < xy.length; i++) segLen.push(segLen[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.transition = 'stroke-dashoffset .9s cubic-bezier(.5,0,.2,1)';
      wrap.goto = i => {
        marker.style.transform = `translate(${xy[i][0]}px, ${xy[i][1]}px)`;
        path.style.strokeDashoffset = String(len - segLen[i]);
        pick(stops[i].place);
      };
      wrap.stops = stops;
    }
    return wrap;
  }

  /* ================= 课程页 ================= */
  function renderLesson(main, L) {
    const p = progress.of(L.id);
    const attached = new Set(L.chapters.map(c => c.activity).filter(Boolean));
    const loose = L.activities.filter(a => !attached.has(a.id));
    const v = el(`<div class="view" style="${accentStyle(L)}">
      <header class="lesson-head">
        <div>
          <p class="no">Lectio ${L.no} · 第${CN_NUM[L.no] || L.no}课</p>
          <h1>${esc(L.title)}</h1>
          ${L.subtitle ? `<p class="sub">${esc(L.subtitle)}</p>` : ''}
          <p class="yrs">${L.years[0]} – ${L.years[1]}</p>
        </div>
        <blockquote class="scripture"><p>${esc(L.scripture.text)}</p><cite>${esc(L.scripture.ref)}</cite></blockquote>
      </header>
      <section class="keypoints"><h2>带走什么</h2><ol>${L.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ol></section>
      <div class="lesson-grid">
        <div class="lesson-main"></div>
        <aside class="toc" aria-label="本课目录">
          <h3>本课目录</h3>
          <ol>${L.chapters.map(c => `<li><button type="button" data-ch="${esc(c.id)}"><span class="ck">${p.seen[c.id] ? '✓' : ''}</span><span>${esc(c.title)}</span></button></li>`).join('')}
            <li><button type="button" data-jump="people"><span class="ck"></span><span>人物</span></button></li>
            <li><button type="button" data-jump="quiz"><span class="ck">${p.quiz ? '✓' : ''}</span><span>测验</span></button></li>
            <li><button type="button" data-jump="discuss"><span class="ck"></span><span>讨论</span></button></li>
          </ol>
          <div class="progress">本课进度 <span class="pct num"></span><div class="meter"><b></b></div></div>
        </aside>
      </div>
    </div>`);
    main.appendChild(v);
    const col = $('.lesson-main', v);
    const actById = Object.fromEntries(L.activities.map(a => [a.id, a]));
    const refreshProgress = () => {
      const pct = Math.round(Util.lessonProgress(L, progress.of(L.id)) * 100);
      $('.toc .pct', v).textContent = pct + '%';
      $('.toc .meter b', v).style.width = pct + '%';
    };
    const ctx = {
      L,
      done(a) {
        progress.update(L.id, pp => { pp.done[a.id] = 1; });
        const s = $(`#act-${CSS.escape(a.id)} .act-done`, v);
        if (s) s.hidden = false;
        refreshProgress();
      },
    };

    // 名词解释：正文里每个关键词第一次出现时可点开
    const usedTerms = new Set();
    const linkTerms = text => {
      let html = esc(text);
      L.terms.forEach((t, i) => {
        if (usedTerms.has(i) || t.term.length < 2) return;
        const k = esc(t.term), at = html.indexOf(k);
        if (at === -1) return;
        usedTerms.add(i);
        html = html.slice(0, at) + `<button type="button" class="term-ref" data-term="${i}">${k}</button>` + html.slice(at + k.length);
      });
      return html;
    };

    if (L.epigraph) col.appendChild(el(`<figure class="hl quote" style="margin:0 0 3rem;max-width:var(--measure)"><blockquote style="margin:0">${esc(L.epigraph.text)}</blockquote><cite>—— ${esc(L.epigraph.source || '')}</cite></figure>`));

    L.chapters.forEach((c, i) => {
      const h = c.highlight;
      const sec = el(`<article class="chapter" id="ch-${esc(c.id)}" data-ch="${esc(c.id)}">
        <div class="ch-meta"><span class="lat">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'][i] || i + 1}</span>${c.years ? `<span>${esc(c.years)}</span>` : ''}</div>
        <h2>${esc(c.title)}</h2>
        <div class="body">${c.body.map(t => `<p>${linkTerms(t)}</p>`).join('')}</div>
        ${(c.figures || []).map(f => `<figure class="ch-fig"><a href="${esc(f.src)}" target="_blank" rel="noopener" title="在新标签页看大图"><img src="${esc(f.src)}" alt="${esc(f.alt || f.caption)}" loading="lazy" decoding="async"></a><figcaption>${esc(f.caption)}${f.credit ? `<span class="credit">${esc(f.credit)}</span>` : ''}</figcaption></figure>`).join('')}
        ${(c.notes || []).map(n => `<p class="src-note"><span class="tag">批注</span>${esc(n)}</p>`).join('')}
        ${h ? `<aside class="hl ${esc(h.type || 'note')}">${h.type === 'quote' ? '' : `<span class="tag">${h.type === 'fact' ? '史实' : '批注'}</span>`}${esc(h.text)}${h.source ? `<cite>—— ${esc(h.source)}</cite>` : ''}</aside>` : ''}
      </article>`);
      col.appendChild(sec);
      if (c.activity && actById[c.activity]) col.appendChild(renderActivity(actById[c.activity], ctx, p));
    });
    for (const a of loose) col.appendChild(renderActivity(a, ctx, p));

    // 人物
    col.appendChild(el(`<section class="block" id="sec-people"><div class="block-head"><h2>人物</h2><span class="aside">点开看简介</span></div><div class="people">${L.people.map(pp => `
      <details class="person"><summary><span class="mono">${esc(Util.monogram(pp.name))}</span><span><span class="nm">${esc(pp.name)}</span> <span class="en">${esc(pp.years || '')}</span><br><span class="role">${esc(pp.role || '')}</span></span></summary>
      <div class="more"><p class="lat" style="color:var(--muted)">${esc(pp.nameEn || '')}</p><p>${esc(pp.bio)}</p>${pp.quote ? `<blockquote>${esc(pp.quote.text)}<cite>${esc(pp.quote.source || '')}</cite></blockquote>` : ''}</div></details>`).join('')}</div></section>`));

    // 本课时间线与地图
    const tlSec = el(`<section class="block"><div class="block-head"><h2>本课大事</h2></div><div class="tl-host"></div></section>`);
    $('.tl-host', tlSec).appendChild(timelineView([L]));
    col.appendChild(tlSec);
    const mapSec = el(`<section class="block"><div class="block-head"><h2>本课地图</h2></div><div class="map-host"></div></section>`);
    $('.map-host', mapSec).appendChild(mapView({ places: Util.mergePlaces([L]), lessons: [L] }));
    col.appendChild(mapSec);

    // 名词
    col.appendChild(el(`<section class="block"><div class="block-head"><h2>关键词</h2><span class="aside"><a href="#review">去闪卡复习 →</a></span></div><dl class="terms">${L.terms.map(t => `<div><dt>${esc(t.term)}<span class="lat">${esc(t.en || '')}</span></dt><dd>${esc(t.def)}</dd></div>`).join('')}</dl></section>`));

    // 名言
    if (L.quotes && L.quotes.length) col.appendChild(el(`<section class="block"><div class="block-head"><h2>值得记住的话</h2></div><div class="quotes">${L.quotes.map(q => `<figure><blockquote>${esc(q.text)}</blockquote><figcaption>—— ${esc(q.source || '')}</figcaption></figure>`).join('')}</div></section>`));

    // 测验
    const qs = el(`<section class="block" id="sec-quiz"><div class="block-head"><h2>测验</h2><span class="aside">${L.quiz.length} 题 · ${p.quiz ? `上次最好 ${p.quiz.best}/${p.quiz.total}` : '还没做过'}</span></div><div class="quiz-host"></div></section>`);
    $('.quiz-host', qs).appendChild(quizView(L.quiz, {
      onFinish(score, total) {
        progress.update(L.id, pp => { pp.quiz = { best: Math.max(score, (pp.quiz && pp.quiz.best) || 0), total }; });
        refreshProgress();
      },
    }));
    col.appendChild(qs);

    col.appendChild(el(`<section class="block" id="sec-discuss"><div class="block-head"><h2>小组讨论</h2></div><ol class="discuss">${L.discussion.map(d => `<li>${esc(d)}</li>`).join('')}</ol></section>`));
    if (L.reading && L.reading.length) col.appendChild(el(`<section class="block"><div class="block-head"><h2>延伸阅读</h2></div><ul class="reading">${L.reading.map(r => `<li><div>${esc(r.title)}</div><div class="au">${esc(r.author || '')}</div>${r.note ? `<div class="nt">${esc(r.note)}</div>` : ''}</li>`).join('')}</ul></section>`));

    const W = worldOf(L);
    if (W) col.appendChild(el(`<section class="block"><a class="world-link" href="#world/${esc(L.id)}"><span class="eyebrow">辅助阅读 · 世界史视角</span><strong>${esc(W.title)}</strong><span>${esc(W.subtitle || '')}：世界通史和国内教材怎样讲这一段 →</span></a></section>`));

    const idx = LESSONS.indexOf(L), prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
    col.appendChild(el(`<nav class="lesson-foot">${prev ? `<a href="#${esc(prev.id)}"><span class="dir">← 上一课</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}${next ? `<a href="#${esc(next.id)}" style="text-align:right"><span class="dir">下一课 →</span><strong>${esc(next.title)}</strong></a>` : `<a href="#review" style="text-align:right"><span class="dir">全部读完了 →</span><strong>去总复习</strong></a>`}</nav>`));

    // 目录跳转
    $$('.toc button', v).forEach(b => b.onclick = () => {
      const t = b.dataset.ch ? $(`#ch-${CSS.escape(b.dataset.ch)}`, v) : $(`#sec-${b.dataset.jump}`, v);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // 名词弹窗
    v.addEventListener('click', e => {
      const b = e.target.closest('.term-ref');
      if (b) { e.stopPropagation(); showPopover(b, L.terms[+b.dataset.term]); }
    });

    // 章节读过 → 记录进度并高亮目录
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        for (const en of entries) if (en.isIntersecting) {
          const id = en.target.dataset.ch;
          $$('.toc button[data-ch]', v).forEach(b => b.classList.toggle('on', b.dataset.ch === id));
          progress.update(L.id, pp => { pp.seen[id] = 1; });
          const ck = $(`.toc button[data-ch="${CSS.escape(id)}"] .ck`, v);
          if (ck) ck.textContent = '✓';
          refreshProgress();
        }
      }, { rootMargin: '-35% 0px -55% 0px' });
      $$('.chapter', v).forEach(c => io.observe(c));
      cleanup.push(() => io.disconnect());
    }
    refreshProgress();
  }

  /* ---------- 名词弹窗 ---------- */
  let pop = null;
  function showPopover(anchor, t) {
    hidePopover();
    pop = el(`<div class="popover" role="dialog"><strong>${esc(t.term)}</strong> <span class="lat muted">${esc(t.en || '')}</span><p>${esc(t.def)}</p></div>`);
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 32);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(16, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 16)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
  }
  function hidePopover() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener('click', e => { if (pop && !pop.contains(e.target)) hidePopover(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopover(); });

  /* ================= 互动 ================= */
  const KIND = { sort: '分类', order: '排序', compare: '对照', reveal: '翻牌', scenario: '抉择', match: '配对', journey: '旅程', swing: '钟摆', survey: '自测', custom: '体验' };

  function renderActivity(a, ctx, p) {
    const sec = el(`<section class="activity" id="act-${esc(a.id)}">
      <div class="act-head"><span class="act-kind">${KIND[a.type] || '互动'}</span><h3>${esc(a.title || '')}</h3><span class="act-done" ${p && p.done[a.id] ? '' : 'hidden'}>✓ 已完成</span></div>
      ${a.prompt ? `<p class="act-prompt">${esc(a.prompt)}</p>` : ''}
      <div class="act-body"></div>
    </section>`);
    let fired = false;
    const done = () => { if (!fired) { fired = true; ctx.done(a); } };
    const fn = ACT[a.type === 'custom' ? 'custom_' + a.widget : a.type];
    if (fn) fn($('.act-body', sec), a, done, ctx);
    else $('.act-body', sec).innerHTML = `<p class="muted">（未知的互动类型：${esc(a.type)}）</p>`;
    return sec;
  }
  const onKeyClick = node => node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); node.click(); } });
  const flash = node => { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); };

  const ACT = {
    /* 分类：先点条目，再点桶 */
    sort(body, a, done) {
      const items = Util.shuffle(a.items.map((it, i) => ({ ...it, i })));
      body.innerHTML = `<div class="pool" aria-label="待分类"></div>
        <div class="buckets">${a.buckets.map(b => `<div class="bucket" role="button" tabindex="0" data-b="${esc(b.id)}"><strong>${esc(b.label)}</strong></div>`).join('')}</div>
        <div class="feedback" aria-live="polite">先点一条陈述，再点它属于的那一栏。</div>`;
      const pool = $('.pool', body), fb = $('.feedback', body);
      let sel = null; const missed = new Set();
      for (const it of items) {
        const b = el(`<button type="button" class="item" aria-pressed="false" data-i="${it.i}">${esc(it.text)}</button>`);
        b.onclick = () => {
          if (b.classList.contains('ok')) return;
          if (sel) sel.setAttribute('aria-pressed', 'false');
          sel = sel === b ? null : b;
          if (sel) sel.setAttribute('aria-pressed', 'true');
          $$('.bucket', body).forEach(x => x.classList.toggle('ready', !!sel));
        };
        pool.appendChild(b);
      }
      $$('.bucket', body).forEach(bk => {
        onKeyClick(bk);
        bk.onclick = () => {
          if (!sel) { fb.className = 'feedback'; fb.textContent = '先点一条陈述，再点它属于的那一栏。'; return; }
          const it = a.items[+sel.dataset.i];
          if (it.bucket === bk.dataset.b) {
            sel.classList.add('ok'); sel.setAttribute('aria-pressed', 'false'); sel.disabled = true;
            if (it.explain) sel.appendChild(el(`<small>${esc(it.explain)}</small>`));
            bk.appendChild(sel); sel = null;
            $$('.bucket', body).forEach(x => x.classList.remove('ready'));
            fb.className = 'feedback ok'; fb.textContent = '对了！';
            if (!pool.children.length) {
              const n = a.items.length;
              fb.textContent = `全部完成！一次就放对 ${n - missed.size}/${n} 条。`;
              done();
            }
          } else {
            missed.add(sel.dataset.i);
            flash(bk); fb.className = 'feedback bad'; fb.textContent = '不是这一栏，再想想。';
          }
        };
      });
    },

    /* 排序：上下移动，然后检查 */
    order(body, a, done) {
      let items = Util.shuffle(a.items, Math.random, true);
      let tries = 0;
      body.innerHTML = `<ol class="order-list"></ol><div class="btn-row" style="margin-top:.9rem"><button type="button" class="btn check">检查顺序</button><button type="button" class="btn ghost show" hidden>直接看答案</button></div><div class="feedback" aria-live="polite"></div>`;
      const list = $('.order-list', body), fb = $('.feedback', body);
      const draw = (marks, reveal) => {
        list.innerHTML = '';
        items.forEach((it, i) => {
          const li = el(`<li class="${marks ? (marks[i] ? 'ok' : 'bad') : ''}"><span class="yr">${reveal || (marks && marks[i]) ? it.year : '····'}</span><span class="t">${esc(it.text)}</span><span class="mv"><button type="button" aria-label="上移" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" aria-label="下移" ${i === items.length - 1 ? 'disabled' : ''}>↓</button></span></li>`);
          const [up, down] = $$('.mv button', li);
          up.onclick = () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); list.children[i - 1].querySelector('button').focus(); };
          down.onclick = () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); list.children[i + 1].querySelectorAll('button')[1].focus(); };
          list.appendChild(li);
        });
      };
      draw();
      $('.check', body).onclick = () => {
        tries++;
        const marks = Util.checkOrder(items);
        const n = marks.filter(Boolean).length;
        if (n === items.length) { draw(marks, true); fb.className = 'feedback ok'; fb.textContent = `完全正确！${tries === 1 ? '一次就排对了。' : `用了 ${tries} 次。`}`; done(); }
        else { draw(marks); fb.className = 'feedback bad'; fb.textContent = `${n}/${items.length} 个位置正确（绿色）。调整红色的再试。`; if (tries >= 2) $('.show', body).hidden = false; }
      };
      $('.show', body).onclick = () => { items = items.slice().sort((x, y) => x.year - y.year); draw(items.map(() => true), true); fb.className = 'feedback'; fb.textContent = '这是正确顺序。'; done(); };
    },

    /* 对照：点格子揭晓 */
    compare(body, a, done) {
      body.innerHTML = `<div class="cmp-wrap"><table class="cmp"><thead><tr><th></th><th>${esc(a.columns[0])}</th><th>${esc(a.columns[1])}</th></tr></thead><tbody>
        ${a.rows.map(r => `<tr><th scope="row">${esc(r.topic)}</th><td class="hide" tabindex="0">${esc(r.a)}</td><td class="hide" tabindex="0">${esc(r.b)}</td></tr>`).join('')}
        </tbody></table></div><div class="btn-row" style="margin-top:.8rem"><button type="button" class="btn ghost all">全部揭晓</button><span class="muted" style="font-family:var(--f-sans);font-size:var(--fs-0)">先猜，再点模糊的格子揭晓</span></div>`;
      const check = () => { if (!$('td.hide', body)) done(); };
      $$('td.hide', body).forEach(td => { onKeyClick(td); td.onclick = () => { td.classList.remove('hide'); check(); }; });
      $('.all', body).onclick = () => { $$('td.hide', body).forEach(td => td.classList.remove('hide')); check(); };
    },

    /* 翻牌 */
    reveal(body, a, done) {
      body.innerHTML = `<div class="flips">${a.cards.map(c => `<button type="button" class="flip" aria-pressed="false"><span class="flip-in"><span class="flip-face flip-front"><span class="tag">常听到的说法</span><span>${esc(c.front)}</span><span class="hint">点一下，翻看真相 ↻</span></span><span class="flip-face flip-back"><span class="tag">历史上其实</span><span>${esc(c.back)}</span></span></span></button>`).join('')}</div>`;
      const seen = new Set();
      $$('.flip', body).forEach((f, i) => f.onclick = () => {
        const on = f.classList.toggle('on'); f.setAttribute('aria-pressed', String(on));
        seen.add(i); if (seen.size === a.cards.length) done();
      });
    },

    /* 情境抉择 */
    scenario(body, a, done) {
      body.innerHTML = `<p class="setup">${esc(a.setup)}</p><div class="choices"></div><p class="feedback" aria-live="polite">如果是你，你会怎么选？（上课时可以先举手投票）</p>`;
      const box = $('.choices', body), fb = $('.feedback', body);
      a.choices.forEach((c, i) => {
        const wrap = el(`<div><button type="button" class="choice"><span class="k">${'ABCDE'[i]}</span><span>${esc(c.text)}</span></button></div>`);
        $('button', wrap).onclick = () => {
          $$('.choice', box).forEach(b => b.classList.remove('picked'));
          $('button', wrap).classList.add('picked');
          $$('.outcome', box).forEach(o => o.remove());
          wrap.appendChild(el(`<div class="outcome">${c.historical ? '<span class="seal">✦ 历史上的选择</span><br>' : ''}${esc(c.outcome)}</div>`));
          const hi = a.choices.findIndex(x => x.historical);
          fb.className = 'feedback';
          fb.textContent = c.historical ? '这正是历史上的选择。也可以点其他选项，看看会发生什么。' : `历史上的选择是 ${'ABCDE'[hi]}。点它看看。`;
          done();
        };
        box.appendChild(wrap);
      });
    },

    /* 配对：先左后右（或先右后左） */
    match(body, a, done) {
      const right = Util.shuffle(a.pairs.map((pr, i) => ({ text: pr.right, i })), Math.random, true);
      body.innerHTML = `<div class="match-cols"><div class="L"></div><div class="R"></div></div><div class="feedback" aria-live="polite">点左边一项，再点右边与它对应的一项。</div>`;
      const fb = $('.feedback', body);
      let pickL = null, pickR = null, matched = 0, wrong = 0;
      const mk = (text, i, side) => {
        const b = el(`<button type="button" class="item" aria-pressed="false" data-i="${i}">${esc(text)}</button>`);
        b.onclick = () => {
          if (b.classList.contains('ok')) return;
          if (side === 'L') { if (pickL) pickL.setAttribute('aria-pressed', 'false'); pickL = b; } else { if (pickR) pickR.setAttribute('aria-pressed', 'false'); pickR = b; }
          b.setAttribute('aria-pressed', 'true');
          if (pickL && pickR) {
            if (pickL.dataset.i === pickR.dataset.i) {
              [pickL, pickR].forEach(x => { x.classList.add('ok'); x.setAttribute('aria-pressed', 'false'); x.disabled = true; });
              matched++; fb.className = 'feedback ok'; fb.textContent = '配对成功！';
              if (matched === a.pairs.length) { fb.textContent = `全部配对完成！（配错 ${wrong} 次）`; done(); }
            } else {
              wrong++; flash(pickR); fb.className = 'feedback bad'; fb.textContent = '不对应，再试一次。';
              [pickL, pickR].forEach(x => x.setAttribute('aria-pressed', 'false'));
            }
            pickL = pickR = null;
          }
        };
        return b;
      };
      a.pairs.forEach((pr, i) => $('.L', body).appendChild(mk(pr.left, i, 'L')));
      right.forEach(r => $('.R', body).appendChild(mk(r.text, r.i, 'R')));
    },

    /* 旅程：地图上一站一站走 */
    journey(body, a, done, ctx) {
      // 站点可以引用别课的地点，所以从全部课里找；但只画沿途各站，地图才会缩放到这段旅程
      const ids = new Set(a.stops.map(s => s.place));
      const places = Util.mergePlaces(LESSONS).filter(p => ids.has(p.id));
      const m = mapView({ places, lessons: [ctx.L], journey: a });
      body.appendChild(m);
      const stops = m.stops || [];
      const ctl = el(`<div><div class="btn-row" style="margin-top:.8rem"><button type="button" class="btn ghost prev">← 上一站</button><button type="button" class="btn next">下一站 →</button><span class="num muted pos" style="font-family:var(--f-sans);font-size:var(--fs-0)"></span></div><div class="outcome stop-text" aria-live="polite"></div></div>`);
      body.appendChild(ctl);
      let i = 0;
      const go = n => {
        i = Math.max(0, Math.min(stops.length - 1, n));
        m.goto(i);
        const s = stops[i];
        $('.stop-text', ctl).innerHTML = `<strong><span class="lat" style="color:var(--accent)">${esc(s.year)}</span> ${esc(s.place.name)}</strong><br>${esc(s.text)}`;
        $('.pos', ctl).textContent = `第 ${i + 1} / ${stops.length} 站`;
        $('.prev', ctl).disabled = i === 0;
        $('.next', ctl).disabled = i === stops.length - 1;
        if (i === stops.length - 1) done();
      };
      $('.prev', ctl).onclick = () => go(i - 1);
      $('.next', ctl).onclick = () => go(i + 1);
      requestAnimationFrame(() => go(0));
    },

    /* 钟摆：君主更替时宗教倾向的摆动 */
    swing(body, a, done) {
      const n = a.steps.length;
      const W = 600, H = 120, px = i => 40 + i * (W - 80) / Math.max(1, n - 1), py = v => 20 + (2 - v) / 4 * (H - 50);
      body.innerHTML = `<div class="swing-tabs" role="group"></div>
        <div class="swing-gauge"><span class="needle"></span></div>
        <div class="swing-ends"><span>← ${esc(a.leftLabel || '天主教')}</span><span>${esc(a.rightLabel || '新教')} →</span></div>
        <div class="swing-body" aria-live="polite"></div>
        <svg class="swing-trail" viewBox="0 0 ${W} ${H}" role="img" aria-label="各朝宗教倾向走势">
          <line class="axis" x1="30" x2="${W - 30}" y1="${py(0)}" y2="${py(0)}"/>
          <text x="4" y="${py(2) + 4}">${esc(a.rightLabel || '新教')}</text><text x="4" y="${py(-2) + 4}">${esc(a.leftLabel || '天主教')}</text>
          <polyline class="ln" points="${a.steps.map((s, i) => `${px(i)},${py(s.value)}`).join(' ')}"/>
          ${a.steps.map((s, i) => `<circle cx="${px(i)}" cy="${py(s.value)}" r="7" data-i="${i}"/><text x="${px(i)}" y="${H - 4}" text-anchor="middle">${esc(s.name)}</text>`).join('')}
        </svg>`;
      const seen = new Set();
      const show = i => {
        const s = a.steps[i];
        $('.needle', body).style.left = ((s.value + 2) / 4 * 100) + '%';
        $$('.swing-tabs .chip', body).forEach((c, j) => c.setAttribute('aria-pressed', String(i === j)));
        $$('.swing-trail circle', body).forEach((c, j) => c.classList.toggle('on', i === j));
        $('.swing-body', body).innerHTML = `<h4>${esc(s.name)}<span class="lat">${esc(s.years || '')}</span></h4><p>${esc(s.text)}</p>${s.policies && s.policies.length ? `<ul>${s.policies.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
        seen.add(i); if (seen.size === n) done();
      };
      a.steps.forEach((s, i) => { const c = el(`<button type="button" class="chip" aria-pressed="false">${esc(s.name)}</button>`); c.onclick = () => show(i); $('.swing-tabs', body).appendChild(c); });
      $$('.swing-trail circle', body).forEach(c => c.addEventListener('click', () => show(+c.dataset.i)));
      $('.needle', body).style.left = '50%';
      requestAnimationFrame(() => setTimeout(() => show(0), 150));
    },

    /* 自测：历史上的考题 */
    survey(body, a, done) {
      body.innerHTML = `<ol class="survey">${a.questions.map((q, i) => `<li><span>${esc(q.q)}</span><label><input type="checkbox" id="sv-${esc(a.id)}-${i}"> 我会</label><div class="ans" hidden>参考答案：${esc(q.a)}</div></li>`).join('')}</ol>
        <div class="btn-row" style="margin-top:.8rem"><button type="button" class="btn ghost ans-all">显示参考答案</button><button type="button" class="btn fin">我答完了，看结果</button></div>
        <div class="result"></div>`;
      $('.ans-all', body).onclick = () => $$('.ans', body).forEach(x => x.hidden = false);
      $('.fin', body).onclick = () => {
        const k = $$('input', body).filter(x => x.checked).length;
        const st = a.stat;
        const colors = ['var(--ok)', 'var(--gold)', 'var(--bad)', 'var(--muted)'];
        let html = `<div class="feedback ok">你会 ${k}/${a.questions.length} 题。</div>`;
        if (st && st.parts) {
          const sum = st.parts.reduce((s, x) => s + x.value, 0);
          html += `<p style="margin-top:1rem;font-family:var(--f-sans);font-size:var(--fs-1)"><strong>${esc(st.text || '')}</strong>（共 ${sum} 人）</p>
            <div class="stackbar">${st.parts.map((x, i) => `<span style="flex-grow:${x.value};background:${colors[i % colors.length]}">${x.value / sum > .08 ? x.value : ''}</span>`).join('')}</div>
            <div class="stack-legend">${st.parts.map((x, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${esc(x.label)} ${x.value} 人（${Math.round(x.value / sum * 100)}%）</span>`).join('')}</div>`;
        }
        $('.result', body).innerHTML = html;
        $$('.ans', body).forEach(x => x.hidden = false);
        done();
      };
    },

    /* 赎罪券箱 */
    custom_indulgence(body, a, done) {
      const THESES = [
        [27, '他们传讲的是人的道理，说钱币一落入钱箱叮当作响，灵魂就立刻飞出炼狱。'],
        [36, '每一个真心悔改的基督徒，即使没有赎罪券，也已经得着罪与罚的完全赦免。'],
        [43, '应当教导基督徒：周济穷人、借钱给有需要的人，比购买赎罪券更好。'],
        [86, '教皇今天的财富远超最富有的克拉苏，他为什么不用自己的钱，却要用贫穷信徒的钱来建造圣彼得大教堂？'],
      ];
      body.innerHTML = `<div class="indul">
        <div class="chest" aria-hidden="true">
          <svg viewBox="0 0 200 200"><g class="chest-lid"><rect x="30" y="80" width="140" height="26" rx="4" fill="var(--gold)" stroke="var(--ink)" stroke-width="3"/><rect x="85" y="88" width="30" height="6" rx="2" fill="var(--ink)"/></g>
          <rect x="34" y="106" width="132" height="70" fill="color-mix(in srgb, var(--gold) 70%, var(--ink))" stroke="var(--ink)" stroke-width="3"/>
          <rect x="90" y="124" width="20" height="24" rx="3" fill="var(--ink)"/><path d="M34 140h132" stroke="var(--ink)" stroke-width="2"/></svg>
        </div>
        <div>
          <p class="tetzel">“钱币叮当落入箱，灵魂立刻出炼狱。”</p>
          <p class="muted" style="font-family:var(--f-sans);font-size:var(--fs-0)">—— 传说中赎罪券推销员台彻尔的口号</p>
          <div class="btn-row" style="margin:1rem 0"><button type="button" class="btn accent coin-btn">投一枚金币</button><button type="button" class="btn ghost luther-btn" hidden>看路德怎么回应 →</button></div>
          <div class="indul-stat">已投金币<b class="num coins">0</b>“为亲人减免”的炼狱年数<b class="num years">0</b></div>
        </div></div>
        <div class="theses"></div>
        <p class="verse" hidden>“你们得救是本乎恩，也因着信；这并不是出于自己，乃是神所赐的。”（以弗所书 2:8）</p>`;
      let coins = 0, years = 0, shown = 0;
      const chest = $('.chest', body);
      $('.coin-btn', body).onclick = () => {
        coins++; years += 100 * coins + Math.floor(Math.random() * 300);
        const c = el('<span class="coin"></span>'); chest.appendChild(c); setTimeout(() => c.remove(), 800);
        setTimeout(() => {
          chest.classList.add('clink'); setTimeout(() => chest.classList.remove('clink'), 160);
          const s = el('<span class="soul">🕊</span>'); chest.appendChild(s); setTimeout(() => s.remove(), 1700);
        }, 650);
        $('.coins', body).textContent = coins;
        $('.years', body).textContent = years.toLocaleString();
        if (coins >= 3) $('.luther-btn', body).hidden = false;
      };
      $('.luther-btn', body).onclick = () => {
        if (shown >= THESES.length) return;
        const [n, t] = THESES[shown++];
        $('.theses', body).appendChild(el(`<div class="thesis"><b>第 ${n} 条</b>${esc(t)}</div>`));
        if (shown === THESES.length) { $('.luther-btn', body).disabled = true; $('.verse', body).hidden = false; done(); }
        else $('.luther-btn', body).textContent = `再钉一条（${shown}/${THESES.length}）→`;
      };
    },

    /* 注入 vs 归算 */
    custom_justification(body, a, done) {
      body.innerHTML = `<div class="just-tabs" role="group"><button type="button" class="chip" aria-pressed="true" data-t="inf">中世纪：义被"注入"</button><button type="button" class="chip" aria-pressed="false" data-t="imp">宗教改革：义被"归算"</button></div><div class="just-body"></div>`;
      const host = $('.just-body', body);
      const seen = new Set();
      const tabs = $$('.just-tabs .chip', body);
      const inf = () => {
        let v = 12;
        host.innerHTML = `<p>在这个理解里，恩典像"注入"你里面的力量，你要配合它、一点点变得够义。试试看——能填满吗？</p>
          <div class="fill-meter" style="margin:1rem 0 .5rem"><b style="width:${v}%"></b><span class="goal" title="够义了"></span></div>
          <div class="btn-row"><button type="button" class="btn ghost" data-a="9">参加弥撒</button><button type="button" class="btn ghost" data-a="7">告解与补赎</button><button type="button" class="btn ghost" data-a="6">行善施舍</button><button type="button" class="btn ghost" data-a="11">去罗马朝圣</button></div>
          <p class="feedback" aria-live="polite">目标：填满到最右边那条线。</p>`;
        const fb = $('.feedback', host);
        let clicks = 0;
        $$('[data-a]', host).forEach(b => b.onclick = () => {
          clicks++;
          v = Math.min(94, v + (+b.dataset.a) * (1 - v / 100) * 1.6);
          const sin = Math.random() < .55 ? Math.round(4 + Math.random() * 9) : 0;
          v = Math.max(5, v - sin);
          $('.fill-meter b', host).style.width = v + '%';
          fb.className = 'feedback' + (sin ? ' bad' : '');
          fb.textContent = sin ? `可是你又犯了罪（-${sin}）……还差多少？没人能确定。` : `进度 ${Math.round(v)}%。够了吗？还是不知道。`;
          if (clicks >= 6) { fb.className = 'feedback'; fb.textContent = '青年路德就是这样：拼命守修道院规矩，却始终不知道自己是否够了。他后来说："如果有修士能靠修道生活进天堂，那就是我了。"'; seen.add('inf'); if (seen.size === 2) done(); }
        });
      };
      const imp = () => {
        const mine = ['骄傲', '说谎', '贪心', '没有尽心爱神', '没有爱人如己'];
        const his = ['完全顺服父', '圣洁无罪', '尽心爱神', '爱人如己', '成全了律法'];
        let swapped = false;
        host.innerHTML = `<p>路德在罗马书里发现："神的义"不是要我们自己挣的，而是神白白<strong>算给</strong>信的人。像两本账交换：</p>
          <div class="ledgers" style="margin-top:1rem"><div class="ledger me"><h4>我的账本</h4><ul></ul></div><div class="ledger him"><h4>基督的账本</h4><ul></ul></div></div>
          <div class="btn-row" style="margin-top:1rem"><button type="button" class="btn accent swap">凭信心：交换账本</button></div>
          <p class="verse">“神使那无罪的，替我们成为罪，好叫我们在他里面成为神的义。”（哥林多后书 5:21）</p>`;
        const fill = () => {
          const me = $('.me', host), him = $('.him', host);
          $('ul', me).innerHTML = (swapped ? his.map(x => `<li class="green">✓ ${x}</li>`) : mine.map(x => `<li class="red">✗ ${x}</li>`)).join('');
          $('ul', him).innerHTML = (swapped ? mine.map(x => `<li class="red">✗ ${x}</li>`) : his.map(x => `<li class="green">✓ ${x}</li>`)).join('');
          $('h4', me).textContent = swapped ? '我的账本：算为义（称义）' : '我的账本';
          $('h4', him).textContent = swapped ? '基督的账本：在十字架上担当' : '基督的账本';
          [me, him].forEach((l, i) => { l.classList.remove('swap'); void l.offsetWidth; l.classList.add('swap'); l.style.setProperty('--dx', (i ? -30 : 30) + 'px'); });
        };
        fill();
        $('.swap', host).onclick = () => {
          swapped = !swapped; fill();
          $('.swap', host).textContent = swapped ? '换回来看看' : '凭信心：交换账本';
          if (swapped && !$('.simul', host)) host.appendChild(el(`<p class="feedback ok simul">这就是"归算"：我本身仍是罪人，却因基督被神称为义——路德说，基督徒"同时是义人，又是罪人"。义在我以外，所以确据也不靠我的感觉。</p>`));
          seen.add('imp'); if (seen.size === 2) done();
        };
      };
      const show = t => { tabs.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.t === t))); (t === 'inf' ? inf : imp)(); };
      tabs.forEach(c => c.onclick = () => show(c.dataset.t));
      show('inf');
    },

    /* 教堂平面图：祭坛中心 vs 讲台中心 */
    custom_churchplan(body, a, done) {
      // 两种布局下每个元素的位置/大小；切换时用 CSS 过渡移动
      const L = {
        rome: {
          altar: [520, 190, 1.35, 1], pulpit: [340, 120, .7, 1], font: [70, 300, 1, 1], table: [300, 215, 1, 0], screen: 1,
          cap: '中世纪教堂：从西门进来先经过洗礼池，眼睛一路被引向东端高高的祭坛——弥撒是敬拜的中心。讲台（如果有）在一侧，讲道常常只有几分钟，甚至没有。',
        },
        puritan: {
          altar: [520, 190, 1, 0], pulpit: [300, 92, 1.5, 1], font: [390, 112, .7, 1], table: [300, 200, 1, 1], screen: 0,
          cap: '清教徒的会堂：高高的讲台放在长墙正中，所有座位都朝向它——神的话语被宣讲是聚会的中心。祭坛不见了，只剩讲台下一张简单的圣餐桌。',
        },
      };
      const pews = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) pews.push({ rome: [120 + c * 58, 150 + r * 40, 0], puritan: [150 + c * 60 - (r === 1 ? 0 : 0), 250 + r * 34, 0] });
      body.innerHTML = `<div class="just-tabs" role="group"><button type="button" class="chip" aria-pressed="true" data-m="rome">中世纪教堂</button><button type="button" class="chip" aria-pressed="false" data-m="puritan">清教徒会堂</button></div>
        <div class="plan"><svg viewBox="0 0 600 380" role="img" aria-label="教堂平面图">
          <rect class="wall" x="20" y="40" width="560" height="320" rx="4"/>
          <text x="300" y="28">平面图（俯视）</text>
          <text x="40" y="375" style="text-anchor:start">西门·入口</text>
          <g class="eyes"></g>
          <g class="pews">${pews.map(() => '<rect class="pew" width="46" height="14" rx="3"/>').join('')}</g>
          <line class="el screen" x1="450" y1="60" x2="450" y2="340" stroke="var(--ink)" stroke-width="4" stroke-dasharray="10 6"/>
          <text class="el screen-l" x="450" y="355">圣坛屏</text>
          <g class="el altar focus"><rect x="-30" y="-45" width="60" height="90" rx="3"/><text y="68">祭坛</text></g>
          <g class="el pulpit"><circle r="22"/><text y="40">讲台</text></g>
          <g class="el font minor"><circle r="16"/><text y="34">洗礼池</text></g>
          <g class="el table minor"><rect x="-34" y="-12" width="68" height="24" rx="2"/><text y="30">圣餐桌</text></g>
        </svg></div><p class="plan-cap" aria-live="polite"></p>`;
      const svg = $('svg', body);
      const place = (sel, [x, y, s, o]) => { const g = $(sel, svg); g.style.transform = `translate(${x}px, ${y}px) scale(${s})`; g.style.opacity = o; };
      const seen = new Set();
      const show = m => {
        const cfg = L[m];
        place('.altar', cfg.altar); place('.pulpit', cfg.pulpit); place('.font', cfg.font); place('.table', cfg.table);
        $('.pulpit', svg).classList.toggle('focus', m === 'puritan'); $('.pulpit', svg).classList.toggle('minor', m !== 'puritan');
        $('.screen', svg).style.opacity = cfg.screen; $('.screen-l', svg).style.opacity = cfg.screen;
        $$('.pew', svg).forEach((r, i) => { const [x, y] = pews[i][m]; r.style.transform = `translate(${x}px, ${y}px)`; });
        const [fx, fy] = m === 'rome' ? cfg.altar : cfg.pulpit;
        $('.eyes', svg).innerHTML = pews.filter((_, i) => i % 2 === 0).map(pw => { const [x, y] = pw[m]; return `<line class="eye" x1="${x + 23}" y1="${y + 7}" x2="${fx}" y2="${fy}"/>`; }).join('');
        $('.plan-cap', body).textContent = cfg.cap;
        $$('.just-tabs .chip', body).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.m === m)));
        seen.add(m); if (seen.size === 2) done();
      };
      $$('.just-tabs .chip', body).forEach(c => c.onclick = () => show(c.dataset.m));
      show('rome');
    },
  };

  /* ---------- 测验 ---------- */
  function quizView(questions, { onFinish } = {}) {
    const wrap = el(`<div class="quiz"></div>`);
    const draw = () => {
      wrap.innerHTML = '';
      let answered = 0, right = 0;
      const score = el(`<div class="score" hidden><span class="big num"></span><span class="msg"></span><button type="button" class="btn ghost redo">重做一遍</button></div>`);
      questions.forEach((q, qi) => {
        const card = el(`<div class="q"><h4><span class="lat">${qi + 1}.</span><span>${esc(q.q)}</span></h4><div class="opts">${q.options.map((o, oi) => `<button type="button" class="opt" data-i="${oi}">${esc(o)}</button>`).join('')}</div><p class="why" hidden></p></div>`);
        $$('.opt', card).forEach(b => b.onclick = () => {
          const i = +b.dataset.i, ok = i === q.answer;
          $$('.opt', card).forEach(x => { x.disabled = true; if (+x.dataset.i === q.answer) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          const why = $('.why', card); why.hidden = false; why.textContent = (ok ? '✓ 答对了。' : '✗ 不对。') + q.explain;
          answered++; if (ok) right++;
          if (answered === questions.length) {
            score.hidden = false;
            $('.big', score).textContent = `${right}/${questions.length}`;
            $('.msg', score).textContent = right === questions.length ? '全对！' : right >= questions.length * .7 ? '很好！看看错的那几题的解析。' : '回到正文再读一读，然后重做。';
            if (onFinish) onFinish(right, questions.length);
            score.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
        wrap.appendChild(card);
      });
      $('.redo', score).onclick = draw;
      wrap.appendChild(score);
    };
    draw();
    return wrap;
  }

  /* ================= 复习页 ================= */
  function renderReview(main) {
    let tab = store.get('reviewTab', 'flash');
    let chosen = new Set(LESSONS.map(L => L.id));
    const v = el(`<div class="view">
      <header class="lesson-head" style="grid-template-columns:1fr"><div><p class="no">Repetitio</p><h1>复习</h1><p class="sub">记住比读完更重要。选几课，挑一种方式练一练。</p></div></header>
      <div class="tl-filters lesson-pick" role="group" aria-label="选择课程" style="margin-top:1.5rem"></div>
      <div class="review-tabs" role="tablist">
        <button type="button" class="chip" data-tab="flash">关键词闪卡</button>
        <button type="button" class="chip" data-tab="order">时间线挑战</button>
        <button type="button" class="chip" data-tab="who">我是谁？</button>
        <button type="button" class="chip" data-tab="quiz">混合测验</button>
      </div>
      <div class="review-body"></div>
    </div>`);
    main.appendChild(v);
    const pick = $('.lesson-pick', v);
    LESSONS.forEach(L => {
      const c = el(`<button type="button" class="chip" aria-pressed="true" style="${accentStyle(L)}">第 ${L.no} 课 · ${esc(L.title)}</button>`);
      c.onclick = () => {
        if (chosen.has(L.id) && chosen.size === 1) return;
        chosen.has(L.id) ? chosen.delete(L.id) : chosen.add(L.id);
        c.setAttribute('aria-pressed', String(chosen.has(L.id)));
        draw();
      };
      pick.appendChild(c);
    });
    $$('.review-tabs .chip', v).forEach(c => c.onclick = () => { tab = c.dataset.tab; store.set('reviewTab', tab); draw(); });
    const body = $('.review-body', v);
    const ls = () => LESSONS.filter(L => chosen.has(L.id));

    const draw = () => {
      $$('.review-tabs .chip', v).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.tab === tab)));
      body.innerHTML = '';
      ({ flash: flashcards, order: orderGame, who: whoami, quiz: mixQuiz })[tab]();
    };

    function flashcards() {
      let deck = Util.shuffle(ls().flatMap(L => L.terms.map(t => ({ ...t, L }))));
      const total = deck.length; let known = 0;
      const box = el(`<div class="flash"><button type="button" class="flip" aria-pressed="false"><span class="flip-in"><span class="flip-face flip-front"></span><span class="flip-face flip-back"></span></span></button>
        <div class="btn-row" style="margin-top:1rem;justify-content:center"><button type="button" class="btn ghost again">还不熟，稍后再来</button><button type="button" class="btn ok">记住了</button></div><p class="flash-meta num"></p></div>`);
      body.appendChild(box);
      const card = $('.flip', box);
      const show = () => {
        card.classList.remove('on'); card.setAttribute('aria-pressed', 'false');
        if (!deck.length) { box.innerHTML = `<div class="empty">🎉 ${total} 张全部记住了！<br><br><button type="button" class="btn">再来一轮</button></div>`; $('button', box).onclick = draw; return; }
        const t = deck[0];
        card.setAttribute('style', accentStyle(t.L));
        $('.flip-front', card).innerHTML = `<span class="tag">第 ${t.L.no} 课</span><span class="term">${esc(t.term)}</span><span class="lat muted">${esc(t.en || '')}</span><span class="hint">点卡片翻面</span>`;
        $('.flip-back', card).innerHTML = `<span class="tag">${esc(t.term)}</span><span>${esc(t.def)}</span>`;
        $('.flash-meta', box).textContent = `已记住 ${known} / ${total} · 剩余 ${deck.length}`;
      };
      card.onclick = () => { const on = card.classList.toggle('on'); card.setAttribute('aria-pressed', String(on)); };
      $('.again', box).onclick = () => { deck.push(deck.shift()); show(); };
      $('.ok', box).onclick = () => { deck.shift(); known++; show(); };
      show();
    }

    function orderGame() {
      // 抽 6 件年份各不相同的事
      const pool = Util.shuffle(ls().flatMap(L => L.events));
      const pickd = [], years = new Set();
      for (const e of pool) { if (!years.has(e.year)) { years.add(e.year); pickd.push(e); } if (pickd.length === 6) break; }
      const a = { id: 'review-order-' + Date.now(), type: 'order', title: '把这几件事排出先后', items: pickd.map(e => ({ text: e.title, year: e.year })) };
      body.appendChild(renderActivity(a, { done() {} }));
      const again = el(`<div class="btn-row" style="margin-top:1rem"><button type="button" class="btn ghost">换一组</button></div>`);
      $('button', again).onclick = draw;
      body.appendChild(again);
    }

    function whoami() {
      const people = ls().flatMap(L => L.people.map(p => ({ ...p, L })));
      if (people.length < 4) { body.innerHTML = '<p class="empty">人物太少，多选几课吧。</p>'; return; }
      let score = 0, round = 0;
      const next = () => {
        round++;
        const ans = people[Math.floor(Math.random() * people.length)];
        const opts = Util.shuffle([ans, ...Util.shuffle(people.filter(p => p.name !== ans.name)).slice(0, 3)]);
        body.innerHTML = '';
        const card = el(`<div style="${accentStyle(ans.L)}"><p class="eyebrow">第 ${round} 题 · 得分 ${score}/${round - 1}</p><div class="whoami-bio" style="margin-top:.5rem"><p class="muted" style="font-family:var(--f-sans);font-size:var(--fs-0)">${esc(ans.years || '')} · ${esc(Util.maskName(ans.role || '', ans.name))}</p><p>${esc(Util.maskName(ans.bio, ans.name))}</p></div>
          <div class="opts" style="grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))">${opts.map(o => `<button type="button" class="opt">${esc(o.name)}</button>`).join('')}</div><p class="feedback" aria-live="polite"></p></div>`);
        $$('.opt', card).forEach((b, i) => b.onclick = () => {
          const ok = opts[i].name === ans.name; if (ok) score++;
          $$('.opt', card).forEach((x, j) => { x.disabled = true; if (opts[j].name === ans.name) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          const fb = $('.feedback', card); fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
          fb.innerHTML = `${ok ? '答对了！' : '是' + esc(ans.name) + '。'} <button type="button" class="btn ghost" style="margin-left:.5rem">下一位 →</button>`;
          $('button', fb).onclick = next;
        });
        body.appendChild(card);
      };
      next();
    }

    function mixQuiz() {
      const qs = Util.shuffle(ls().flatMap(L => L.quiz)).slice(0, 10);
      body.appendChild(quizView(qs));
      const again = el(`<div class="btn-row" style="margin-top:1rem"><button type="button" class="btn ghost">换 10 题</button></div>`);
      $('button', again).onclick = draw;
      body.appendChild(again);
    }

    draw();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    try { if (store.get('projector', false)) document.documentElement.classList.add('projector'); } catch (e) { /* 忽略 */ }
    const th = store.get('theme', null); if (th) document.documentElement.setAttribute('data-theme', th);
    if (!LESSONS.length) { $('#main').innerHTML = '<p class="empty">没有找到课程数据（data/lesson-XX.js）。</p>'; return; }
    renderTopbar();
    window.addEventListener('hashchange', route);
    window.addEventListener('scroll', () => {
      const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      const bar = $('#readbar'); if (bar) bar.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%';
    }, { passive: true });
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
