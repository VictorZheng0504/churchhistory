// 校验课程数据：格式、引用关系、测验答案。运行：node --test tests/  或  node tests/data.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = path.join(__dirname, '..', 'data');

// 用和浏览器相同的方式加载数据文件（它们只往 window 上挂东西）
function loadLessons() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  const files = fs.readdirSync(DATA).filter(f => /^lesson-\d+\.js$/.test(f)).sort();
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), sandbox, { filename: f });
  return { files, lessons: sandbox.window.COURSE_LESSONS || [] };
}

const ACTIVITY_FIELDS = {
  sort: ['buckets', 'items'],
  order: ['items'],
  compare: ['columns', 'rows'],
  reveal: ['cards'],
  scenario: ['setup', 'choices'],
  match: ['pairs'],
  journey: ['stops'],
  swing: ['steps'],
  survey: ['questions'],
  custom: ['widget'],
};
const WIDGETS = ['indulgence', 'justification', 'churchplan'];

const { files, lessons } = loadLessons();

test('每个数据文件恰好注册一课', () => {
  assert.ok(files.length > 0, '没有找到 data/lesson-XX.js');
  assert.strictEqual(lessons.length, files.length);
});

test('课程 id 和课次唯一', () => {
  const ids = lessons.map(l => l.id);
  const nos = lessons.map(l => l.no);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(new Set(nos).size, nos.length);
});

for (const L of lessons) {
  test(`第 ${L.no} 课 ${L.id}`, async t => {
    await t.test('必填字段', () => {
      for (const k of ['id', 'no', 'title', 'summary', 'accent'])
        assert.ok(L[k] !== undefined && L[k] !== '', `缺少 ${k}`);
      assert.ok(L.scripture && L.scripture.text && L.scripture.ref, '缺少 scripture');
      for (const k of ['keyPoints', 'chapters', 'people', 'events', 'places', 'terms', 'activities', 'quiz', 'discussion'])
        assert.ok(Array.isArray(L[k]) && L[k].length > 0, `${k} 必须是非空数组`);
      assert.ok(Array.isArray(L.years) && L.years.length === 2);
    });

    await t.test('章节', () => {
      const ids = new Set();
      for (const c of L.chapters) {
        assert.ok(c.id && !ids.has(c.id), `章节 id 重复或缺失: ${c.id}`);
        ids.add(c.id);
        assert.ok(c.title, `章节 ${c.id} 缺标题`);
        assert.ok(Array.isArray(c.body) && c.body.length > 0, `章节 ${c.id} 没有正文`);
        for (const p of c.body) assert.strictEqual(typeof p, 'string');
        if (c.notes !== undefined) assert.ok(Array.isArray(c.notes) && c.notes.every(n => typeof n === 'string' && n), `章节 ${c.id} 的 notes 须为非空字符串数组`);
        if (c.figures !== undefined) {
          assert.ok(Array.isArray(c.figures), `章节 ${c.id} 的 figures 须为数组`);
          for (const f of c.figures) {
            assert.ok(f.src && f.caption, `章节 ${c.id} 的插图缺 src/caption`);
            // 引用的图片必须真的在仓库里，否则网页上是一张裂图
            assert.ok(fs.existsSync(path.join(__dirname, '..', f.src)), `章节 ${c.id} 的插图不存在: ${f.src}`);
          }
        }
      }
    });

    const placeIds = new Set(L.places.map(p => p.id));
    await t.test('地点坐标', () => {
      for (const p of L.places) {
        assert.ok(p.id && p.name, '地点缺 id/name');
        // 范围与 tools/build-map.mjs 的世界视图一致；超出的地点画不出来
        assert.ok(p.lat > -40 && p.lat < 66, `${p.id} 纬度超出地图: ${p.lat}`);
        assert.ok(p.lon > -130 && p.lon < 150, `${p.id} 经度超出地图: ${p.lon}`);
      }
    });

    await t.test('事件', () => {
      for (const e of L.events) {
        assert.ok(Number.isInteger(e.year), `事件年份须为整数: ${e.title}`);
        assert.ok(e.title && e.desc, `事件缺标题或说明: ${e.id}`);
        if (e.place) assert.ok(allPlaceIds().has(e.place), `事件 ${e.id} 引用了不存在的地点 ${e.place}`);
      }
    });

    await t.test('互动活动', () => {
      const ids = new Set();
      for (const a of L.activities) {
        assert.ok(a.id && !ids.has(a.id), `活动 id 重复或缺失: ${a.id}`);
        ids.add(a.id);
        assert.ok(ACTIVITY_FIELDS[a.type], `未知活动类型: ${a.type}`);
        for (const f of ACTIVITY_FIELDS[a.type]) assert.ok(a[f] !== undefined, `${a.id} 缺少 ${f}`);
        if (a.type === 'sort') {
          const b = new Set(a.buckets.map(x => x.id));
          for (const it of a.items) assert.ok(b.has(it.bucket), `${a.id}: "${it.text}" 指向不存在的桶`);
        }
        if (a.type === 'order') {
          for (const it of a.items) assert.ok(Number.isFinite(it.year), `${a.id}: 缺年份`);
          assert.strictEqual(new Set(a.items.map(i => i.year)).size, a.items.length, `${a.id}: 年份重复会导致排序答案不唯一`);
        }
        if (a.type === 'journey') for (const s of a.stops) assert.ok(allPlaceIds().has(s.place), `${a.id}: 地点 ${s.place} 不存在`);
        if (a.type === 'swing') for (const s of a.steps) assert.ok(s.value >= -2 && s.value <= 2, `${a.id}: value 超出 -2..2`);
        if (a.type === 'custom') assert.ok(WIDGETS.includes(a.widget), `${a.id}: 未知 widget ${a.widget}`);
        if (a.type === 'scenario') assert.ok(a.choices.some(c => c.historical), `${a.id}: 至少一个选项标注 historical`);
      }
      for (const c of L.chapters)
        if (c.activity) assert.ok(ids.has(c.activity), `章节 ${c.id} 引用了不存在的活动 ${c.activity}`);
    });

    await t.test('测验', () => {
      for (const q of L.quiz) {
        assert.ok(q.q && Array.isArray(q.options) && q.options.length >= 2, `题目格式错: ${q.q}`);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `答案下标越界: ${q.q}`);
        assert.ok(q.explain, `缺解析: ${q.q}`);
      }
    });

    await t.test('人物', () => {
      const ids = new Set();
      for (const p of L.people) {
        assert.ok(p.id && !ids.has(p.id), `人物 id 重复或缺失: ${p.id}`);
        ids.add(p.id);
        assert.ok(p.name && p.bio, `人物缺名字或简介: ${p.id}`);
      }
    });
  });
}

// 地点可以跨课引用（例如第 9 课提到第 8 课的伦敦）
function allPlaceIds() {
  return new Set(lessons.flatMap(l => l.places.map(p => p.id)));
}

// 导论页：每课恰好一件代表事件，五个时代不重不漏地覆盖所有课
test('导论：两千年一览', () => {
  for (const L of lessons) {
    const ms = L.events.filter(e => e.milestone);
    assert.strictEqual(ms.length, 1, `第 ${L.no} 课应恰好有 1 个 milestone 事件，现有 ${ms.length} 个`);
  }
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(DATA, 'overview.js'), 'utf8'), sandbox, { filename: 'overview.js' });
  const O = sandbox.window.COURSE_OVERVIEW;
  assert.ok(O && O.title && Array.isArray(O.eras) && O.eras.length, 'overview.js 缺 title 或 eras');
  // Array.from：沙箱里的数组原型不同，deepStrictEqual 会误判
  const covered = Array.from(O.eras.flatMap(e => e.lessons));
  assert.deepStrictEqual(covered.slice().sort((a, b) => a - b), Array.from(lessons, l => l.no).sort((a, b) => a - b), '时代划分必须恰好覆盖每一课一次');
  assert.deepStrictEqual(covered, covered.slice().sort((a, b) => a - b), '时代内的课次须按顺序排列');
  // 同一时代内按课次列出，代表事件的年份也要递增，否则列表读起来是倒着的
  for (const era of O.eras) {
    const ys = Array.from(era.lessons, no => lessons.find(l => l.no === no).events.find(e => e.milestone).year);
    assert.deepStrictEqual(ys, ys.slice().sort((a, b) => a - b), `${era.name}：代表事件年份不是递增的 ${ys.join(', ')}`);
  }
});

// 世界史视角：每篇对应一个存在的课，两种讲法、三栏对照、对照框都齐全
test('世界史视角 data/world-XX.js', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  const wfiles = fs.readdirSync(DATA).filter(f => /^world-\d+\.js$/.test(f)).sort();
  for (const f of wfiles) vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), sandbox, { filename: f });
  const W = sandbox.window.COURSE_WORLD || [];
  assert.strictEqual(W.length, wfiles.length, '每个 world 文件恰好注册一篇');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const f of wfiles) assert.ok(html.includes(`data/${f}`), `index.html 没有加载 ${f}`);
  const seen = new Set();
  for (const w of W) {
    const L = lessons.find(l => l.id === w.lesson);
    assert.ok(L, `world 篇目对应的课不存在: ${w.lesson}`);
    assert.ok(!seen.has(w.lesson), `同一课有两篇世界史: ${w.lesson}`);
    seen.add(w.lesson);
    for (const k of ['title', 'summary']) assert.ok(w[k], `${w.lesson} 缺 ${k}`);
    assert.ok(Array.isArray(w.keyPoints) && w.keyPoints.length, `${w.lesson} 缺 keyPoints`);
    assert.ok(Array.isArray(w.chapters) && w.chapters.length, `${w.lesson} 缺叙述 chapters`);
    for (const c of w.chapters) assert.ok(c.id && c.title && Array.isArray(c.body) && c.body.length, `${w.lesson} 叙述章节格式错: ${c.id}`);
    // 叙述篇幅约为本课正文的 1/3：太短讲不清，太长就喧宾夺主
    const len = cs => cs.reduce((n, c) => n + c.body.join('').length, 0);
    const ratio = len(w.chapters) / len(L.chapters);
    assert.ok(ratio >= 0.2 && ratio <= 0.5, `${w.lesson} 叙述篇幅是本课的 ${ratio.toFixed(2)}，应在 0.2–0.5 之间`);
    assert.ok(Array.isArray(w.world) && w.world.length, `${w.lesson} 缺同时期大事`);
    for (const e of w.world) assert.ok(Number.isInteger(e.year) && e.region && e.text, `${w.lesson} 同时期大事格式错: ${e.text}`);
    assert.ok(Array.isArray(w.views) && w.views.length >= 2, `${w.lesson} 至少两种讲法`);
    for (const v of w.views) {
      assert.ok(v.id && v.label && v.frame, `${w.lesson} 讲法缺 id/label/frame`);
      assert.ok(v.points.length && v.points.every(p => p.title && p.body), `${w.lesson}/${v.id} 要点格式错`);
      assert.ok(v.sources.length && v.sources.every(s => s.title), `${w.lesson}/${v.id} 缺代表著作`);
    }
    assert.ok(w.table && w.table.rows.length, `${w.lesson} 缺对照表`);
    for (const r of w.table.rows) assert.strictEqual(r.cells.length, w.table.columns.length, `${w.lesson} 对照表「${r.topic}」列数不对`);
    for (const k of ['agree', 'differ', 'questions']) assert.ok(w.contrast && w.contrast[k] && w.contrast[k].length, `${w.lesson} 对照框缺 ${k}`);
  }
});
