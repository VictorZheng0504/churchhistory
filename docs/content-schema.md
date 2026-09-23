# 课程内容数据格式

每一课一个文件：`data/lesson-XX.js`。网站引擎只读这些数据来渲染页面，**改内容不需要碰代码**。
改完运行 `node tests/data.test.js` 检查格式。

## 文件骨架

```js
(window.COURSE_LESSONS = window.COURSE_LESSONS || []).push({
  id: 'luther',            // 英文短 id，用于网址 #/lesson/luther
  no: 6,                   // 课次
  title: '马丁·路德与宗教改革',
  subtitle: '一位修士与一把锤子',
  years: [1483, 1546],
  accent: '#b3261e',       // 本课主题色
  icon: '🔨',              // 一个 emoji
  scripture: { text: '……（和合本）', ref: '加拉太书 2:16' },
  epigraph: { text: '……', source: '路德，《讲道集》' },   // 可选
  summary: '一句话概括本课',
  keyPoints: ['本课要带走的 3–5 个要点'],

  chapters: [              // 故事正文，按顺序
    {
      id: 'need',
      title: '引言：教会为何需要改革',
      years: '约 1500',                 // 可选，字符串
      body: ['段落1', '段落2'],          // 每段 60–180 字
      highlight: { type: 'quote' | 'fact' | 'note', text: '…', source: '…' },  // 可选
      activity: 'indulgence',           // 可选：在本章后插入的 activity id
      notes: ['另有资料作……']            // 可选：讲义与通行史料不一致时的小字批注（正文照讲义写）
    }
  ],

  people: [ { id, name, nameEn, years: '1483–1546', role: '一句话身份', bio: '2–4 句', quote: { text, source } /*可选*/ } ],
  events: [ { id, year: 1517, title, desc, place: 'wittenberg' /*可选，对应 places.id*/ } ],
  places: [ { id, name, nameEn, lat, lon, note } ],
  terms:  [ { term: '因信称义', en: 'Justification by faith', def: '1–2 句解释' } ],  // 也会变成闪卡
  quotes: [ { text, source } ],

  activities: [ /* 见下文，每项必须有 id 和 type */ ],

  quiz: [ { q: '题干', options: ['A', 'B', 'C', 'D'], answer: 0, explain: '为什么' } ],
  discussion: ['小组讨论问题'],
  reading: [ { title, author, note } ],

  meta: {}   // 扩展字段：以后要加的东西先放这里（例如讲员、日期、音频链接）
});
```

所有对象都可以带 `meta: {}`，引擎会忽略未知字段。

## activity 类型

| type | 用途 | 字段 |
|---|---|---|
| `sort` | 分类：点选条目放进正确的桶 | `title, prompt, buckets:[{id,label}], items:[{text, bucket, explain}]` |
| `order` | 排序：把事件排成时间顺序 | `title, prompt, items:[{text, year}]` |
| `compare` | 对照表，可逐行揭晓 | `title, prompt, columns:[左标题,右标题], rows:[{topic, a, b}]` |
| `reveal` | 翻牌：误解 → 真相 | `title, prompt, cards:[{front, back}]` |
| `scenario` | 情境抉择：你会怎么选 | `title, setup, choices:[{text, outcome, historical:true/false}]` |
| `match` | 配对 | `title, prompt, pairs:[{left, right}]` |
| `journey` | 在地图上跟着人物走 | `title, prompt, stops:[{place /*places.id*/, year, text}]` |
| `swing` | 王朝更替 / 摇摆 | `title, prompt, leftLabel, rightLabel, steps:[{name, years, value /* -2 天主教 … +2 新教 */, text, policies:[…]}]` |
| `survey` | 自测：历史上的考题 | `title, prompt, questions:[{q, a}], stat:{text, parts:[{label, value}]}` |
| `custom` | 引擎内置的特制互动 | `title, widget: 'indulgence' \| 'justification' \| 'churchplan'` |
