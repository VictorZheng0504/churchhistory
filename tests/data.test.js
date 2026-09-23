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
      }
    });

    const placeIds = new Set(L.places.map(p => p.id));
    await t.test('地点坐标', () => {
      for (const p of L.places) {
        assert.ok(p.id && p.name, '地点缺 id/name');
        assert.ok(p.lat > 20 && p.lat < 70, `${p.id} 纬度可疑: ${p.lat}`);
        assert.ok(p.lon > -80 && p.lon < 40, `${p.id} 经度可疑: ${p.lon}`);
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
