// 端到端冒烟测试：打开每个页面、操作每种互动，确认没有 JS 错误。
// 运行：node tests/smoke.mjs [--shots]   （--shots 会把截图存到 screenshots/）
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL0 = pathToFileURL(path.join(ROOT, 'index.html')).href;
const SHOTS = process.argv.includes('--shots');
if (SHOTS) fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });

// 课程列表从 index.html 实际加载的数据文件里读，新增一课不用改这里
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const [, f] of fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/src="(data\/lesson-\d+\.js)"/g))
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox);
const IDS = sandbox.window.COURSE_LESSONS.map(l => l.id);

const browser = await playwright.chromium.launch();
const failures = [];
async function run(name, width, fn) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_/.test(m.text())) errors.push(m.text()); });
  try { await fn(page); } catch (e) { errors.push('步骤失败：' + e.message.split('\n')[0]); }
  if (errors.length) failures.push(`${name}: ${errors.join(' | ')}`);
  console.log(errors.length ? '✗' : '✓', name);
  await page.close();
}
const shot = (page, n, full = false) => SHOTS && page.screenshot({ path: path.join(ROOT, 'screenshots', n + '.png'), fullPage: full });

await run('首页', 1280, async page => {
  await page.goto(URL0);
  await page.waitForSelector('.book');
  // 导论也是一本书
  if ((await page.$$('.book')).length !== IDS.length + 1) throw new Error(`书架不是 ${IDS.length + 1} 本书`);
  await page.click('.tl-ev');
  await page.click('.map-pt');
  await shot(page, 'home');
  await shot(page, 'home-full', true);
});

for (const id of IDS) {
  await run(`课程 ${id}`, 1280, async page => {
    await page.goto(URL0 + '#' + id);
    await page.waitForSelector('.chapter');
    await shot(page, id);
    // 每个互动都点几下
    for (const act of await page.$$('.activity')) {
      await act.scrollIntoViewIfNeeded();
      const btns = await act.$$('button:not([disabled]), .bucket, td.hide');
      for (const b of btns.slice(0, 8)) { if (await b.isVisible()) await b.click({ timeout: 2000 }).catch(() => {}); }
    }
    // 测验全部作答
    for (const q of await page.$$('.q')) { const o = await q.$('.opt'); await o.click(); }
    if (!(await page.isVisible('.score'))) throw new Error('测验做完没有显示分数');
    const termRef = await page.$('.term-ref');
    if (termRef) { await termRef.click(); if (!(await page.isVisible('.popover'))) throw new Error('名词弹窗未出现'); }
    await shot(page, id + '-full', true);
  });
}

await run('导论', 1280, async page => {
  await page.goto(URL0 + '#overview');
  await page.waitForSelector('.gantt');
  const rows = (await page.$$('.g-row')).length, dots = (await page.$$('.g-dot')).length, items = (await page.$$('.ov-list li')).length;
  if (rows !== IDS.length || dots !== IDS.length || items !== IDS.length) throw new Error(`行 ${rows} / 圆点 ${dots} / 条目 ${items}，应各为 ${IDS.length}`);
  await shot(page, 'overview-full', true);
});

const WIDS = [...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/src="(data\/world-\d+\.js)"/g)].map(m => {
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(ROOT, m[1]), 'utf8'), sb);
  return sb.window.COURSE_WORLD[0].lesson;
});
await run('世界史视角', 1280, async page => {
  await page.goto(URL0 + '#world');
  await page.waitForSelector('.wx-dests');
  if ((await page.$$('.wx-dest')).length !== WIDS.length) throw new Error('目录卡片数和篇数不符');
  if ((await page.$$('.wx-seg')).length !== WIDS.length) throw new Error('时间长河段数和篇数不符');
  if (await page.evaluate(() => document.documentElement.dataset.section) !== 'world') throw new Error('世界史页面没有切换主题');
  for (const id of WIDS) {
    await page.goto(URL0 + '#world/' + id);
    await page.waitForSelector('.world-views');
    if (!(await page.$('.world-story .chapter'))) throw new Error(`${id}: 没有叙述章节`);
    if ((await page.$$('.world-view')).length < 2) throw new Error(`${id}: 讲法少于两种`);
    if (!(await page.$('.world-contrast'))) throw new Error(`${id}: 没有对照框`);
    // 标签页：点第二个，第二个面板显示、第一个隐藏
    await page.click('.wx-tabs [role="tab"]:nth-child(2)');
    if (await page.$eval('.world-view:nth-of-type(1)', e => !e.hidden)) throw new Error(`${id}: 标签页没有切换`);
    // 地区筛选：点第一个地区，剩下的卡片都属于该地区
    const rg = await page.$eval('.wx-filter [data-rg]:not([data-rg=""])', b => b.dataset.rg);
    await page.click(`.wx-filter [data-rg="${rg}"]`);
    const bad = await page.$$eval('.wx-ev:not([hidden])', (lis, rg) => lis.filter(li => !li.dataset.rg.split(' ').includes(rg)).length, rg);
    if (bad || !(await page.$('.wx-ev:not([hidden])'))) throw new Error(`${id}: 地区筛选不对`);
    await page.click('.wx-filter [data-rg=""]');
    // 翻卡
    await page.click('.wx-flip');
    if (await page.$eval('.wx-flip', b => b.getAttribute('aria-pressed')) !== 'true') throw new Error(`${id}: 关键词卡翻不过来`);
    await shot(page, 'world-' + id + '-full', true);
    // 课程页上有入口
    await page.goto(URL0 + '#' + id);
    await page.waitForSelector(`.world-link[href="#world/${id}"]`);
    if (await page.evaluate(() => document.documentElement.dataset.section)) throw new Error('离开世界史后主题没有恢复');
  }
});

await run('复习页', 1280, async page => {
  await page.goto(URL0 + '#review');
  for (const tab of ['flash', 'order', 'who', 'quiz']) {
    await page.click(`.review-tabs [data-tab="${tab}"]`);
    await page.waitForTimeout(100);
    const b = await page.$('.review-body button:not([disabled])');
    if (!b) throw new Error(`复习 ${tab} 没有可点按钮`);
    await b.click();
  }
  await shot(page, 'review');
});

await run('手机宽度无横向滚动', 390, async page => {
  for (const h of ['', '#overview', '#luther', '#puritans', '#review', '#world', '#world/luther']) {
    await page.goto(URL0 + h);
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) throw new Error(`${h || '首页'} 页面横向溢出 ${over}px`);
  }
  // 投影模式放大根字号，rem 写死的最小宽度最容易在这里撑破页面
  await page.evaluate(() => localStorage.setItem('ch:projector', 'true'));
  for (const h of ['', '#overview', ...IDS.map(id => '#' + id), '#review', '#world', '#world/luther']) {
    await page.goto(URL0 + h);
    await page.waitForTimeout(200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) throw new Error(`投影模式 ${h || '首页'} 页面横向溢出 ${over}px`);
  }
  await page.evaluate(() => localStorage.removeItem('ch:projector'));
  // 时间长河：窄屏上同一行的段不能互相压住
  await page.goto(URL0 + '#world');
  await page.waitForSelector('.wx-seg');
  const segOverlap = await page.$$eval('.wx-seg', as => {
    const r = as.map(a => a.getBoundingClientRect());
    return r.some((x, i) => r.some((y, j) => j > i && x.top === y.top && x.left < y.right - 1 && y.left < x.right - 1));
  });
  if (segOverlap) throw new Error('时间长河在手机宽度下有重叠');
  await page.goto(URL0 + '#england');
  await shot(page, 'mobile-england');
});

await browser.close();
if (failures.length) { console.error('\n失败：\n' + failures.join('\n')); process.exit(1); }
console.log('\n全部通过');
