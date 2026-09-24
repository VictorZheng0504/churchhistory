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
  assert.strictEqual(U.mainView(V, [wittenberg, jerusalem]), 'world', '缺少的视图跳过，最后兜底 world');
});

test('mainView 从小到大选第一张装得下的图', () => {
  const V = {
    europe: { lon0: -11, lon1: 30, lat0: 40, lat1: 58.5 }, mediterranean: { lon0: -11, lon1: 50, lat0: 20, lat1: 56 },
    usa: { lon0: -125, lon1: -66, lat0: 24, lat1: 50 }, atlantic: { lon0: -125, lon1: 35, lat0: 22, lat1: 62 },
    world: { lon0: -130, lon1: 150, lat0: -40, lat1: 66 }, newEngland: { lon0: -74.2, lon1: -69.6, lat0: 40.8, lat1: 43.2 },
  };
  const london = { lon: -0.13, lat: 51.5 }, boston = { lon: -71.06, lat: 42.36 }, jerusalem = { lon: 35.2, lat: 31.8 };
  const dc = { lon: -77.0, lat: 38.9 }, serampore = { lon: 88.34, lat: 22.75 };
  assert.strictEqual(U.mainView(V, [london, boston]), 'europe', '波士顿进新英格兰小图');
  assert.strictEqual(U.mainView(V, [london, jerusalem, boston]), 'mediterranean');
  assert.strictEqual(U.mainView(V, [dc, boston]), 'usa');
  assert.strictEqual(U.mainView(V, [london, dc]), 'atlantic', '美国大图不配新英格兰小图，伦敦得进主图');
  assert.strictEqual(U.mainView(V, [london, serampore]), 'world');
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

test('regionKeys 把地区归组，多地区去重，未知算全球', () => {
  assert.deepStrictEqual(U.regionKeys('中国'), ['cn']);
  assert.deepStrictEqual(U.regionKeys('中国 / 罗马'), ['cn', 'eu']);
  assert.deepStrictEqual(U.regionKeys('英国 / 欧洲'), ['eu']);
  assert.deepStrictEqual(U.regionKeys('欧亚'), ['gl']);
  assert.deepStrictEqual(U.regionKeys(''), ['gl']);
});

test('laneRows 让重叠的时间段分行', () => {
  assert.deepStrictEqual(U.laneRows([[30, 313], [30, 367], [312, 500], [451, 1054]]), [0, 1, 2, 0]);
  assert.deepStrictEqual(U.laneRows([[1483, 1546], [1525, 1892], [1550, 1701]]), [0, 1, 0]);
  // 设了最短长度：1483 起算 130 年到 1613，1550 就放不进第 0 行
  assert.deepStrictEqual(U.laneRows([[1483, 1546], [1525, 1892], [1550, 1701]], 130), [0, 1, 2]);
});
