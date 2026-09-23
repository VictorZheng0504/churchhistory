# 参考站点调研：历史 / 宗教史 / 博物馆类互动学习网站

- **调研日期**：2026-09-23
- **目的**：为「从维滕堡到山上之城」（第 6–9 课宗教改革互动课堂）找可借鉴的设计、互动和叙事手法，重点是帮学员**记得住**。
- **对象**：中国浸信会成人主日学学员；场景是小组、投屏授课、手机阅读，要考虑国内网络。
- **约束**：纯静态，不依赖国外 CDN，内容以讲义为准。

---

## 0. 调研方法与访问状态说明（请先读）

本次调研环境的网络出口代理**拦截了所有目标站点**。WebFetch 对下面这些域名全部返回 `EGRESS_BLOCKED`，curl 也不通（Ligonier、Seterra、Google Arts & Culture 均超时/被拒）：

`www.themorgan.org`、`histography.io`、`christianhistoryinstitute.org`、`www.dpm.org.cn`、`www.khanacademy.org`、`timeline.knightlab.com`、`en.wikipedia.org`

**WebSearch 可以用**。所以下面对每个站点的描述都来自**搜索结果标题和摘要**，以及介绍这些站点的第三方文章（设计媒体、图书馆指南、新闻报道），**不是我亲自打开页面看到的**。表中「访问状态」一栏如实记录：

- **未能打开（本环境被拦截）**：本次无法直接访问，描述来自搜索摘要或二手报道。这**不代表**站点本身已下线。
- 有几项细节（颜色编码、模式名称等）是二手来源的说法。落地前建议有人在正常网络下亲自打开看一眼。

另外，「在国内能否访问」是**根据常识判断**，没有在国内网络实测：Google 系服务在国内不可用；多数欧美博物馆站点能打开但慢；YouTube/Vimeo 嵌入内容打不开。

---

## 1. 现状速览（对照用）

读 README.md 和 assets/app.js 后确认，网站已有这些功能：书架和进度（localStorage）、跨课时间轴、欧洲+新英格兰地图、分章故事、关键词弹窗、10 类互动加 3 个特制互动、复习页（闪卡、时间线挑战、我是谁、混合测验）、投影模式。复习题已经用 `shuffle`/`Math.random` 打乱，故事区用了 `IntersectionObserver`。

对比后发现**还没有**的东西：
- 错题记录，以及按间隔安排的复习
- 打印/讲义样式（`@media print`）
- 图片上的"热点"讲解
- 按地区或阵营给时间轴分轨
- "每日一题/一则"之类的回访入口

---

## 2. 站点逐一记录

### 2.1 Here I Stand（路德 500 周年数字展 + 可下载海报展）
- **网址**：https://www.here-i-stand.com （德国历史博物馆存档页：https://www.dhm.de/ausstellungen/archiv/2016/here-i-stand/ ）
- **访问状态**：未能打开（本环境被拦截）。信息来自 DHM、Luther2017、德国历史教师协会、萨克森-安哈尔特考古局的介绍页。
- **值得借鉴**：
  1. **"实物+信息图"双轨**：用 3D 扫描文物讲路德生平，例如路德曼斯费尔德老家出土的儿童玩具、据称属于路德的奥古斯丁会修士袍、维滕堡路德居室的陈设。配合信息图解释背景。抽象的"因信称义"由此落到一个个具体物件上。
  2. **可下载、可订购的海报版（9–30 张）**，明确说是为学校和社区（Gemeinden，也就是教会/堂区）设计的。线上内容和线下张贴、讲台用的是同一套材料。
- **适合我们吗**：很合适。它本来就面向教会和社区。我们做不了 3D，但可以借两点：一是"一课一件实物"（一张图加三句话），二是"一课一张可打印海报/讲义"。

### 2.2 Luther2017 官方站 / "Luther to go" 应用 / 路德之路（Lutherweg）
- **网址**：https://www.luther2017.de/ （如 https://www.luther2017.de/erleben/auf-lutherwegen/lutherweg-1521-in-hessen/index.html ）
- **访问状态**：未能打开（本环境被拦截）。信息来自搜索摘要。
- **值得借鉴**：
  1. **按真实路线讲故事**。黑森州的"1521 路德之路"沿路德从维滕堡去沃尔姆斯帝国会议的路线设置；萨安州一段连接维滕堡和艾斯莱本（出生与去世之地）。一个人的生平就是地图上的一条线。
  2. **把地点分层**：20 个重要路德地点、180 座教堂、400 个景点，用分级标注区分主次。
- **适合我们吗**：思路合适。我们已经有加尔文的"地图旅程"，可以给路德补一条"1521 沃尔姆斯之行 → 瓦特堡"的路线，再给清教徒补一条"英格兰 → 荷兰 → 新英格兰"的路线。站点本身是旅游导向，不用照搬。

### 2.3 Google Arts & Culture："The Life of Martin Luther" 故事（萨安州政府出品）
- **网址**：https://artsandculture.google.com/story/the-life-of-martin-luther-staatskanzlei-sachsen-anhalt/-wWRHCKpy0fNLQ?hl=en
- **访问状态**：未能打开（本环境被拦截）。搜索只拿到标题和"修士、家庭中的人、神学教授、改革者、翻译家、写诗歌的人"这段简介，**没有拿到页面交互细节**。
- **值得借鉴**：一般印象中 Arts & Culture 的 Story 格式是"一屏一图+一段文字，横向或纵向翻页，图可放大"，但这次无法核实，这里不展开。能确认的是它的切入方式：从**多重身份**讲路德（修士/丈夫父亲/教授/改革者/翻译者/作词者），而不是按年份平铺。
- **适合我们吗**：国内打不开，不能引用或嵌入。"多重身份"的切入方式可以直接用到人物卡上。

### 2.4 大英博物馆 × Google："The Museum of the World"
- **网址**：https://artsandculture.google.com/experiment/the-museum-of-the-world/zgGAGPpSNAynjg （实验介绍：https://experiments.withgoogle.com/the-museum-of-the-world ）
- **访问状态**：未能打开（本环境被拦截）。信息来自 Design Week、Internet Archaeology 书评、Google Experiments 介绍。
- **值得借鉴**：
  1. **分轨时间轴**：横向时间轴分成几条"轨道"，每条轨道用一种颜色的点代表一个地区（非洲黄、美洲橙、亚洲绿、欧洲蓝、大洋洲紫）。一眼能看出"同一时间别处在发生什么"。
  2. **物件之间可以连线**，点开能听策展人讲解。
- **适合我们吗**：交互思路合适。站点本身基于 WebGL，只支持桌面，又在 Google 域下，国内不可用。我们可以把首页时间轴改成 **4 条轨道：德意志 / 瑞士 / 英格兰 / 新英格兰（或按课分轨）**，用纯 CSS 就能实现。成本低，对"建立同时性"帮助很大（例如 1534 年亨利八世《至尊法案》时，加尔文在做什么？）。

### 2.5 Histography
- **网址**：https://histography.io/
- **访问状态**：未能打开（本环境被拦截）。信息来自 Adobe Blog、Smashing Magazine 专访、Information is Beautiful Awards。
- **值得借鉴**：
  1. **每个事件是一个点**，点密集在时间轴上，悬停或点击展开图文。可以按年代缩放，也可以按主题筛选（音乐、政治、灾难等）。
  2. **"手气不错"随机按钮**：随机跳到一个事件。探索成本很低，容易引出偶然发现。
- **适合我们吗**：大尺度数据可视化对 4 课内容来说太重。但**"随便看一个"按钮**值得借：在首页或复习页加一个"随机抽一张人物卡/一个事件"，适合课前暖场和投屏抽题。

### 2.6 Knight Lab：TimelineJS / StoryMapJS
- **网址**：https://timeline.knightlab.com/ 、https://storymap.knightlab.com/
- **访问状态**：未能打开（本环境被拦截）。信息来自 Knight Lab 博客、多所大学图书馆的使用指南（Trinity、UT Austin、GMU）。
- **值得借鉴**：
  1. **StoryMapJS 的"幻灯片 ↔ 地图"联动**：每张幻灯片绑定一个地点，翻到下一张时地图**自动平移、缩放**到该地点，叙事和空间同步推进。
  2. **TimelineJS 用一张表格生成时间线**：内容作者只填表，不碰代码。
- **适合我们吗**：两个库本身都依赖国外 CDN 加载瓦片和媒体（Flickr/YouTube 等），**不适合直接用**。手法很合适：我们已经有本地 `map-data.js`，可以做"故事章节滚动到哪，本地 SVG 地图就高亮/缩放到哪"。我们的 `data/lesson-XX.js` 本来就是"表格化内容"，符合 TimelineJS 的思路，不用改。

### 2.7 Seterra（现属 GeoGuessr）地理问答
- **网址**：https://www.geoguessr.com/quiz/seterra （原 seterra.com；此外有多个第三方镜像站，不建议引用）
- **访问状态**：未能打开（本环境被拦截）。信息来自 Classwork.com 评测、Google Play 页面和搜索摘要。
- **值得借鉴**：
  1. **同一张地图三种难度**：Pin（给地名 → 点地图）、Type（给地点 → 打字填名）、Place the labels（把标签拖到针上）。从"认出"到"回忆"逐级加难。
  2. **即时纠错**：点错后**立刻闪出正确位置**再继续，不让错误印象留下来；最后显示用时和正确率，可以反复刷。
- **适合我们吗**：很合适，而且我们已经有本地地图数据。可以在复习页加"地图点点看"：出题"沃尔姆斯在哪？""日内瓦在哪？""普利茅斯在哪？"，点错就高亮正确点。纯 SVG 实现，成本低。

### 2.8 Smithsonian Learning Lab
- **网址**：https://learninglab.si.edu/
- **访问状态**：未能打开（本环境被拦截）。信息来自 Smithsonian 新闻稿、Common Sense Education 评测和官方入门指南 PDF 的摘要。
- **值得借鉴**：
  1. **图片热点（hotspot）**：在一张图的某个细节上放可点的标记，点开出现说明**或一个问题**，引导学员"看细节"。
  2. **在光谱上排序或分类**：把几张图拖到一条"从 A 到 B"的轴上，再讨论为什么这样放。
- **适合我们吗**：很合适。第 8 课"宗教钟摆"就是光谱思路，已经有了。**热点**我们还没有：可以给克拉纳赫的《维滕堡祭坛画》（路德讲道那一联）、《殉道者之书》插图、清教徒会堂内景等**公有领域图片**加 3–5 个热点。每个热点一句讲解加一个小问题，投屏时老师一个个点开讲。

### 2.9 Ligonier《A Survey of Church History》（W. Robert Godfrey）学习指南
- **网址**：https://store.ligonier.org/a-survey-of-church-history-part-3-study-guide （第 3 部分：主后 1500–1620，正好覆盖宗教改革）
- **访问状态**：未能打开（本环境被拦截）。信息来自 Ligonier 商店、Amazon、AbeBooks 商品页摘要。
- **值得借鉴**：
  1. **固定的四段式学习指南**：Lesson Objectives（本课目标）→ Message Outline（信息提纲）→ Study Questions（事实性复习题）→ Discussion Questions（讨论/应用题）。明确说"适合个人或小组"。
  2. **事实题和讨论题分开**：先确认"记住了什么"，再问"对我们意味着什么"。
- **适合我们吗**：非常合适，是同类受众（改革宗/福音派成人主日学）。我们已经有"测验"和"小组讨论"。可以借的是在**课首加一个"本课学完你能……"的 3 条目标**，课末测验逐条呼应这 3 条，形成闭环。

### 2.10 Christian History Institute（基督教历史杂志）时间线
- **网址**：https://christianhistoryinstitute.org/magazine/article/important-events-timeline ；宗教改革时间线 PDF（第 120 期）：https://christianhistoryinstitute.org/resources/PDF/timeline120links.pdf
- **访问状态**：未能打开（本环境被拦截）。信息来自搜索摘要。
- **值得借鉴**：每期杂志配一条**专题时间线**（如"圣灵、福音与祷告""早期教会的日常生活""教会史中的呼召/职业"），而不是一条大而全的总表。宗教改革那期的 PDF 时间线**带可点击链接**，打印可以用，屏幕上也能跳转。
- **适合我们吗**：合适。**专题时间线**的思路可以用到复习页：同一批事件，按"圣经翻译""殉道""信条与教理问答"等主题筛出子时间线，帮学员从不同角度再过一遍。

### 2.11 Khan Academy：宗教改革单元
- **网址**：https://www.khanacademy.org/humanities/world-history/renaissance-and-reformation/protestant-reformation
- **访问状态**：未能打开（本环境被拦截）。信息来自搜索结果列出的该单元视频、文章、练习页标题。
- **值得借鉴**：**短视频/短文 → 紧接一组练习**（"Protestant Reformation (practice)"），另有一篇 "Read & Discuss" 文章页，把"读"和"讨论"排在一起。节奏是小块输入、马上检索。
- **适合我们吗**：节奏合适，我们的"故事中穿插互动"已经是这种结构。视频依赖 YouTube，国内不可用，也不需要。

### 2.12 Snow Fall（纽约时报，2012）及 scrollytelling 手法（The Pudding / Scrollama）
- **网址**：https://www.nytimes.com/projects/2012/snow-fall/ ；手法综述：https://pudding.cool/process/how-to-implement-scrollytelling/
- **访问状态**：未能打开（本环境被拦截）。信息来自 OpenNews《How We Made Snow Fall》、Nightingale 综述、The Pudding 技术文章的摘要。
- **值得借鉴**：
  1. **滚动驱动的"固定画面 + 文字卡片"**：一侧（手机上是背景）固定一张图或地图，文字段落滚过时，画面随之切换或高亮。The Pudding 的 Scrollama 就是基于 `IntersectionObserver` 做的，不需要监听 scroll 事件。
  2. **开头分岔**（The Pudding 的 IVF 作品）：先选"父母视角 / 孩子视角"，同一套数据按两种情感路线讲，不同路线用不同强调色。
- **适合我们吗**：手法 1 合适，而且我们已经在用 `IntersectionObserver`，把它接到"章节 ↔ 地图/时间轴高亮"上是自然的延伸。全屏视频、视差这类重效果**不建议**：成人手机阅读、国内网络、投屏都受影响。手法 2 可以用在"情境抉择"里，例如"以农民 / 诸侯 / 修士的身份看 1525"。但要严守讲义，不要扩写史料。

### 2.13 故宫博物院：《每日故宫》App、数字文物库、数字多宝阁
- **网址**：https://www.dpm.org.cn/ （数字文物库、数字多宝阁由官网"数字故宫"入口进入）；《每日故宫》见各应用商店
- **访问状态**：未能打开（本环境被拦截）。信息来自少数派、简书产品报告、故宫官网新闻、数英的摘要。
- **值得借鉴**：
  1. **《每日故宫》的"一天一件"**：以日历形式每天推一件藏品，配工艺要点、背景故事和高清细节图。App 从 2015 年上架到 2026 年仍在更新。**一次只给一点**，靠频率而不是分量留住用户；还配有"心情笔记"让用户写一句自己的感受。
  2. **数字多宝阁的"细看"**：文物可以旋转、放大，360 度看，重点是看细节。
- **适合我们吗**：非常合适，而且是国内用户熟悉的习惯。**"每日一则"**特别适合主日学：两次聚会之间隔一周，最容易遗忘。可以在首页做"今日一则"：按日期轮换一句名言、一个人物或一道小题，完全在本地由日期算出来，**不需要推送或后端**。

### 2.14 全历史（allhistory.com）
- **网址**：https://www.allhistory.com/ （时空地图：https://www.allhistory.com/map ）
- **访问状态**：未能打开（本环境被拦截）。信息来自知乎、极客公园的介绍。
- **值得借鉴**：
  1. **时空地图**：拖动时间，地图上的势力、人物、事件跟着变化。
  2. **关系图谱 / "AB 路径"**：任选两个人物，显示他们之间的关系链。所有条目互相超链。
- **适合我们吗**：规模不适合（它是 AI 知识图谱），而且内容是通用百科，不以讲义为准，不能引用给学员。**人物关系链**的小规模版本很适合：第 6–9 课的人物本来就连成网，例如胡斯 → 路德、法勒尔 → 加尔文、布林格 ↔ 英格兰流亡者、诺克斯 ↔ 日内瓦、丁道尔 → 英文圣经 → 清教徒。一张手工绘制的 SVG 关系图就够。

### 2.15 腾讯 × 中国文物保护基金会："云游长城"小程序
- **网址**：微信小程序"云游长城"（无网页地址）
- **访问状态**：未能打开（小程序，本环境也无法访问相关网页）。信息来自新华网、中国日报、数英的报道。
- **值得借鉴**：**把学习嵌进"做一件事"的流程**：用户按真实修缮步骤"清理 → 砌砖 → 勾缝 → 补墙 → 加固"动手做一遍；答题、"逛长城"都能攒积分升级。
- **适合我们吗**：3D 引擎和积分体系都太重，也不符合教会场景的气质。可以借**"按真实步骤做一遍"**：比如"把 1520 年代一场改革宗崇拜的顺序排出来"，或者"1662 年《统一法令》后一位被逐牧师要面对的几步抉择"。本质上就是我们已有的"排序"和"情境抉择"，这里只是验证方向对了。

### 附：学习科学依据（非站点，供理解"为什么记得住"）
- 来源：Agarwal & Carpenter 等关于**检索练习、间隔练习、交错练习**的综述（retrievalpractice.org、澳大利亚教育研究组织 AERO 的实践指南、Evidence Based Education）。以上为搜索摘要，**未打开原文**。
- 要点：低风险的小测（retrieval practice）在各年龄段都能提高成绩，还能降低考试焦虑；把复习分散到多次（spacing）效果更好；**混合不同主题**练习（interleaving）优于集中练一种。摘要中提到提升约 30%，该数字来自单一二手摘要，仅供参考。
- 对我们的意义：主日学一周一次，天然是"间隔"。缺的是**让上周的内容在本周被再次提取**的机制。

---

## 3. 适配性总表

| # | 站点 | 访问状态（本环境） | 国内可用性（推断） | 成人/小组 | 投屏 | 手机 | 可借鉴程度 |
|---|---|---|---|---|---|---|---|
| 1 | Here I Stand | 未能打开 | 可能可用 | ★★★ | ★★★ | ★★ | 高 |
| 2 | Luther2017 / 路德之路 | 未能打开 | 可能可用 | ★★ | ★★ | ★★ | 中 |
| 3 | Google A&C 路德故事 | 未能打开 | **不可用** | ★★ | ★★ | ★★ | 低（只借切入角度） |
| 4 | Museum of the World | 未能打开 | **不可用** | ★★ | ★★★ | ✗（仅桌面） | 高（借分轨时间轴） |
| 5 | Histography | 未能打开 | 未知 | ★ | ★★ | ★ | 中（借随机按钮） |
| 6 | TimelineJS / StoryMapJS | 未能打开 | 依赖国外 CDN | ★★ | ★★★ | ★★ | 高（借手法，不用库） |
| 7 | Seterra | 未能打开 | 未知 | ★★★ | ★★★ | ★★★ | 高 |
| 8 | Smithsonian Learning Lab | 未能打开 | 可能可用但慢 | ★★★ | ★★★ | ★★ | 高（借热点） |
| 9 | Ligonier 学习指南 | 未能打开 | 可能可用 | ★★★ | ★★ | ★★ | 高（借结构） |
| 10 | Christian History Institute | 未能打开 | 可能可用 | ★★★ | ★★ | ★★ | 中 |
| 11 | Khan Academy | 未能打开 | 部分可用（视频不可） | ★★ | ★★ | ★★ | 中 |
| 12 | Snow Fall / Scrollama 手法 | 未能打开 | NYT 常不稳定 | ★★ | ★★ | ★★★ | 中高（只借轻量部分） |
| 13 | 故宫（每日故宫/多宝阁） | 未能打开 | 可用 | ★★★ | ★★ | ★★★ | 高 |
| 14 | 全历史 | 未能打开 | 可用 | ★★ | ★★ | ★★ | 中（借关系链） |
| 15 | 云游长城 | 未能打开 | 可用（微信） | ★ | ★ | ★★★ | 低（方向验证） |

---

## 4. 建议清单（按"对记得住的帮助 ÷ 成本"排序）

> 全部可以用纯静态 HTML/CSS/JS 加本地数据实现，**不需要任何外部依赖或 CDN**。新增文字（热点说明、每日一则、目标）一律取自现有讲义和 `data/lesson-XX.js`，不另写史实。

### ① 错题本 + "上周回顾"间隔复习
- **做什么**：各类测验和复习答错的题目 id 记到 localStorage。下次打开任一课或复习页时，先弹出"上次答错的 3 题"。进入第 N 课时，课首自动出 3 道**第 N−1 课**的题（混在一起，不分课）。
- **为什么有助于记得住**：同时用上检索练习、间隔和交错。主日学隔一周一次，这正好让上周内容被再提取一遍。借鉴 Seterra 的"反复刷到全对"和学习科学综述。
- **成本**：低到中（复用现有题库和 `store.get/set`）。
- **外部依赖**：无。

### ② 复习页"地图点点看"（Seterra 式）
- **做什么**：用现有 `map-data.js` 的 SVG 地图出题："沃尔姆斯在哪？""苏黎世在哪？""普利茅斯在哪？"。学员点地图作答，点错立刻闪出正确位置，最后给出正确率。可以加第二档难度：高亮一个点，从 4 个地名里选。
- **为什么有助于记得住**：地点是事件的"挂钩"。从"认得"升级到"自己找到"是更深的提取，即时纠错也避免错误印象固化。
- **成本**：低。
- **外部依赖**：无。

### ③ 分轨时间轴（Museum of the World 式）
- **做什么**：首页跨课时间轴改为 4 条并行轨道（德意志 / 瑞士 / 英格兰 / 苏格兰与新英格兰，或按第 6–9 课分），每轨一种颜色。点一个事件时，其他轨道上同一时期的事件淡淡高亮。
- **为什么有助于记得住**：学员最容易混淆的是"同一时期各地在发生什么"。空间化的并行结构帮他们建立同时性，可以看出 1530 年代的英格兰和日内瓦是同步推进的。
- **成本**：低到中（纯 CSS 网格；事件数据已有年份，只需补"地区"字段）。
- **外部依赖**：无。

### ④ 图片热点（Smithsonian Learning Lab 式）
- **做什么**：每课挑 1 张公有领域图片（如克拉纳赫《维滕堡祭坛画》讲道联、福克斯《殉道者之书》插图、清教徒会堂内景），放 3–5 个编号热点。点开是一句讲解加一个"你看到了什么？"的小问题。投影模式下热点放大，老师可以按编号逐个点。图片**本地存放**。
- **为什么有助于记得住**：图像加自己发现的细节，比纯文字更容易编码进记忆（Here I Stand 的"一课一件实物"也是这个思路）。投屏时它还是现成的讨论开场。
- **成本**：中（主要花在挑图和核对版权；代码是一个新的互动类型）。
- **外部依赖**：无，但图片必须自托管并确认是公有领域。

### ⑤ 首页"今日一则"
- **做什么**：首页顶部一张小卡，根据当天日期从 4 课的名言、人物、关键词、题目里确定性地选一条，所有人同一天看到同一条，方便小组微信群里讨论。附一个"随机再来一则"按钮（Histography 的"手气不错"）。
- **为什么有助于记得住**：两次聚会之间提供低成本的回访理由。"每日故宫"证明了"一天一点"能长期留住用户，而且国内用户熟悉这种习惯。
- **成本**：低。
- **外部依赖**：无，不用推送，不用后端。

### ⑥ 故事章节与地图/时间轴的滚动联动（StoryMapJS / Scrollama 式，轻量版）
- **做什么**：桌面宽屏时，分章故事旁边固定一张本课小地图（或本课时间轴）。读到哪一章，地图就高亮哪个城市，时间轴就亮起哪一年。手机上改成每章顶部一个小"定位条"（地点 · 年份），不做固定侧栏。复用现有的 `IntersectionObserver`。
- **为什么有助于记得住**：叙事、地点、时间三者同时出现，形成"何人、何时、何地"的组合记忆。
- **成本**：中。
- **外部依赖**：无。不引入 Scrollama 或 Leaflet，自己写几十行即可。

### ⑦ 课首"本课学完你能……"三条目标 + 课末逐条呼应（Ligonier 学习指南式）
- **做什么**：每课开头列 3 条可检验的目标（如"说出路德三篇 1520 年论著的主旨"）。课末测验题标注对应哪条目标，完成后显示"目标 1 ✔ 目标 2 ✔ 目标 3 ✖（回看第 3 章）"。
- **为什么有助于记得住**：先知道要记什么，注意力就有方向；结尾按目标检查，缺口会直接指回对应章节。成人学员也喜欢清楚的结构。
- **成本**：低（数据加一个字段；目标文字由老师按讲义确认）。
- **外部依赖**：无。

### ⑧ 可打印的"一课一页"讲义/海报（Here I Stand 海报展 + CHI 可打印时间线式）
- **做什么**：加 `@media print` 样式，或者每课一个"打印版"视图，自动把要点、本课时间轴、关键词、3 道讨论题排成 A4 一页，隐藏互动。
- **为什么有助于记得住**：很多成年学员（尤其年长的）习惯纸本。带回家放在圣经里的一页纸，本身就是间隔复习的载体。
- **成本**：低到中。
- **外部依赖**：无。

---

## 5. 不建议做的

- **嵌入 YouTube、Google Arts & Culture、TimelineJS/StoryMapJS 官方托管版**：国内打不开，也违反"不依赖国外 CDN"的约束。
- **全屏视频、视差滚动、3D 模型**：流量大，手机和投屏体验差，对"记得住"的边际价值低。
- **积分、等级、排行榜**：教会小组场景里容易变味。现有的"进度"加上 ①错题本已经足够。
- **大规模知识图谱或引用百科内容**：会偏离"内容以讲义为准"。关系图只用手工绘制的小图，人物限于讲义里出现的。

---

## 6. 参考来源（搜索结果中实际出现的链接）

- Here I Stand：https://www.dhm.de/ausstellungen/archiv/2016/here-i-stand/ ；https://geschichtslehrerverband.de/www-here-i-stand-com-luther-online-ausstellung-der-wittenberger-konferenz/ ；http://www.lda-lsa.de/aktuelles/meldung/datum/2017/03/29/aktuelles_zur_digital_und_downloadausstellung_hereistand/
- Luther2017：https://www.luther2017.de/neuigkeiten/luther-to-go-fuer-smartphone-und-tablet/ ；https://www.luther2017.de/erleben/auf-lutherwegen/lutherweg-1521-in-hessen/index.html
- Google A&C 路德故事：https://artsandculture.google.com/story/the-life-of-martin-luther-staatskanzlei-sachsen-anhalt/-wWRHCKpy0fNLQ?hl=en
- Museum of the World：https://www.designweek.co.uk/issues/16-22-november-2015/british-museum-moves-its-collection-online-with-museum-of-the-world-timeline/ ；https://experiments.withgoogle.com/the-museum-of-the-world ；https://intarch.ac.uk/journal/issue44/13/index.html
- Histography：https://histography.io/ ；https://www.smashingmagazine.com/2016/09/interview-with-matan-stauber/ ；https://blog.adobe.com/en/publish/2015/12/03/data-meets-design
- Knight Lab：https://storymap.knightlab.com/ ；https://libguides.trinity.edu/storytelling/storymap ；https://libguides.trinity.edu/storytelling/timeline
- Seterra：https://classwork.com/seterra-hundreds-of-interactive/ ；https://www.geoguessr.com/quiz/seterra
- Smithsonian Learning Lab：https://www.commonsense.org/education/reviews/smithsonian-learning-lab ；https://www.smithsonianmag.com/blogs/smithsonian-education/2023/02/14/smithsonian-learning-lab/
- Ligonier：https://store.ligonier.org/a-survey-of-church-history-part-3-study-guide
- Christian History Institute：https://christianhistoryinstitute.org/magazine/article/important-events-timeline ；https://christianhistoryinstitute.org/resources/PDF/timeline120links.pdf
- Khan Academy：https://www.khanacademy.org/humanities/world-history/renaissance-and-reformation/protestant-reformation/e/protestant-reformation-quiz
- Snow Fall / scrollytelling：https://source.opennews.org/articles/how-we-made-snow-fall/ ；https://nightingaledvs.com/the-past-present-and-future-of-scrollytelling/ ；https://pudding.cool/process/how-to-implement-scrollytelling/
- 故宫：https://sspai.com/post/28953 ；https://www.jianshu.com/p/fe86c2a15f4f ；https://www.digitaling.com/projects/152887.html ；https://m.thepaper.cn/kuaibao_detail.jsp?contid=3928966&from=kuaibao
- 全历史：https://www.geekpark.net/news/240991 ；https://zhuanlan.zhihu.com/p/95313578
- 云游长城：https://www.digitaling.com/projects/211252.html ；http://www.xinhuanet.com/tech/20220612/387d723bd203493ab3907d04fdc60077/c.html
- 学习科学：https://www.edresearch.edu.au/guides-resources/practice-guides/spacing-and-retrieval-practice-guide-full-publication ；https://pdf.retrievalpractice.org/SpacingGuide.pdf ；https://mlpp.pressbooks.pub/mavlearn/chapter/spaced-and-interleaved-practice/
