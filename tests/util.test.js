// 引擎纯函数的单元测试
const test = require('node:test');
const assert = require('node:assert');
const U = require('../assets/app.js');

test('esc 转义 HTML', () => {
  assert.strictEqual(U.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.strictEqual(U.esc(null), '');
});

test('shuffle 保留全部元素，avoidIdentity 不会返回原顺序', () => {
  const a = [1, 2, 3, 4, 5];
  const s = U.shuffle(a, Math.random, true);
  assert.deepStrictEqual(s.slice().sort(), a);
  assert.notDeepStrictEqual(s, a);
  // 最坏情况：随机数恒为 0.999 → 每轮都是原顺序？验证兜底不会死循环
  assert.strictEqual(U.shuffle([1], () => 0, true).length, 1);
});

test('checkOrder 标出位置对错', () => {
  assert.deepStrictEqual(U.checkOrder([{ year: 1 }, { year: 3 }, { year: 2 }]), [true, false, false]);
  assert.deepStrictEqual(U.checkOrder([{ year: 1 }, { year: 2 }]), [true, true]);
});

test('timeScale 单调、落在画布内，事件密的年代更宽', () => {
  const years = [30, 64, 313, 325, 451, 1054, 1517, 1520, 1521, 1521, 1525, 1530, 1536, 1541];
  const X = U.timeScale(years, 1000);
  let prev = -1;
  for (let y = 0; y <= 1600; y += 5) {
    const x = X(y);
    assert.ok(x >= prev && x >= 40 && x <= 960, `year ${y} → ${x}`);
    prev = x;
  }
  assert.ok(X(1525) - X(1500) > X(1100) - X(1075), '1500–1525 应比空白的 1075–1100 宽');
  assert.strictEqual(X(-100), X(X.lo));
});

test('mainView 地点都在欧洲图内才用欧洲图', () => {
  const V = { europe: { lon0: -11, lon1: 26, lat0: 40, lat1: 58.5 }, newEngland: { lon0: -74, lon1: -69, lat0: 40, lat1: 43 } };
  const wittenberg = { lon: 12.6, lat: 51.9 }, boston = { lon: -71, lat: 42.4 }, jerusalem = { lon: 35.2, lat: 31.8 };
  assert.strictEqual(U.mainView(V, [wittenberg, boston]), 'europe');
  assert.strictEqual(U.mainView(V, [wittenberg, jerusalem]), 'mediterranean');
});

test('assignLanes 不重叠', () => {
  const lanes = U.assignLanes([0, 10, 20, 200], [100, 100, 100, 50], 5);
  assert.deepStrictEqual(lanes, [0, 1, 2, 0]);
});

test('project 与地图边界一致', () => {
  const v = { lon0: -10, lon1: 20, lat0: 40, lat1: 60, cos: 0.5, k: 10 };
  assert.deepStrictEqual(U.project(v, -10, 60), [0, 0]);
  assert.deepStrictEqual(U.project(v, 20, 40), [150, 200]);
  assert.ok(U.inView(v, 0, 50) && !U.inView(v, -70, 42));
});

test('lessonProgress 三项平均', () => {
  const L = { chapters: [{ id: 'a' }, { id: 'b' }], activities: [{ id: 'x' }] };
  assert.strictEqual(U.lessonProgress(L, null), 0);
  assert.strictEqual(U.lessonProgress(L, { seen: { a: 1, b: 1 }, done: { x: 1 }, quiz: { best: 1 } }), 1);
  assert.strictEqual(U.lessonProgress(L, { seen: { a: 1 }, done: {}, quiz: null }), 0.5 / 3);
});

test('maskName 遮住全名和姓', () => {
  assert.strictEqual(U.maskName('马丁·路德生于艾斯莱本，路德后来……', '马丁·路德'), '＿＿生于艾斯莱本，＿＿后来……');
  assert.strictEqual(U.monogram('约翰·加尔文'), '加');
  assert.strictEqual(U.monogram('慈运理'), '慈');
});

test('mergePlaces 按 id 去重并记录所属课程', () => {
  const A = { id: 'A', places: [{ id: 'london' }] }, B = { id: 'B', places: [{ id: 'london' }, { id: 'leiden' }] };
  const m = U.mergePlaces([A, B]);
  assert.strictEqual(m.length, 2);
  assert.deepStrictEqual(m[0].lessons.map(l => l.id), ['A', 'B']);
});
