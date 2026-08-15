# LINGUA & LASTBROADCAST · 改进优化与内容扩充清单

> 评审对象：两个纯前端零依赖项目（双击 index.html 即玩，node --test test/*.test.js 跑测试）。
> 本清单基于对两份代码的实际阅读与核实，不会重复推荐已经实现的功能。
A. LINGUA：106词/13类别；24条音变+现实注释；14语法事件；3次分裂7分支；2波借词；文字三阶段+甲骨展柜；语系树（悬停/拖拽/刻度/×1×2×4/键盘）；词表（搜索+类别过滤+音系档案）；同源词+双分支对比；语法/大事记/借词展厅；词源追踪；名语言馆6预设；种子复现/URL分享/导出JSON/馆藏/记住位置/首访导览。
B. LASTBROADCAST：12回合/15听众/20首歌/14来电（4双来电+点歌联动+未接来电）；军队切频与FREQUENCY X；精力条；6结局+图鉴；Web Audio合成（20首歌+底噪+VU+示波器）；城市窗口动画；情绪曲线；广播日志下载；终局留言；音量记忆；第N夜统计；首访导览.

---
## A. 内容扩充
- 【A1】【LINGUA】补全动作等短词目 --- lexicon现约106词，动作/抽象/方向类偏薄。为动作/抽象/方向各补8~12高频词目（跑坐给拿看听怕梦上上下里外），并在glyphs.js的GLOSS_GLYPHS同步补三阶段字形图元。扩充后同源词/词源/音系档案含金量提升，不动引擎零风险。工作量L。涉及js/shared/lexicon.js、js/glyphs.js、test/。
- 【A2】【LINGUA】新增第4~6波时代借词 --- 现仅2波（北骑、海商）。在公元900年加传教士/官府借词（书纸法信），或让分裂后分支互借，丰富后期词汇层与事件密度。工作量M。涉及js/shared/world.js、js/main.js（借词展厅）。
- 【A3】【LINGUA】语法事件扩至20~24条并分层触发 --- 补拟声/叠词、量词、体貌、复数不规则化、代词系统、敬语、复合词化、后置词等真实演化概念；并让早期多触发音系简化、后期多语法化，增强演化叙事层次。工作量L。涉及js/shared/grammar.js、js/main.js（语法展厅）、test/。
- 【A4】【LINGUA】3~5首语言歌谣/谚语彩蛋 --- 新增歌谣板块，让每类音变/语法附带一两句用演化词形拼成的短句（如SOV语序演示"狼猎人杀"），纯展示无需引擎参与，强化"活的声音"沉浸感。工作量S。涉及js/main.js、(新)js/shared/lyrics.js。
- 【A5】【LASTBROADCAST】听众剧情支线 --- 现15听众靠likes/state与14通电话驱动，个体间缺持续互动。为每人写1~2条进线后浮现的私信/跨回合伏笔（阿芸的孩子、罗老师的琴、小雨的星星），让结局fate更有分量。工作量M。涉及js/shared/data.js、engine.js、main.js。
- 【A6】【LASTBROADCAST】末日新闻碎片轮换 --- 12回合只吃TURN_INTERLUDES与CITY_OBSERVATIONS两组固定文案，重玩感弱。做每日头条/隔离/物资/天空谣言碎片池，每局随机组合，显著提升重播价值。工作量S。涉及js/shared/data.js、main.js。
- 【A7】【LASTBROADCAST】歌曲池扩至30+并加限定曲 --- 补10首事件专属曲（军队进行曲、停电应急曲、终局告别曲），并在特定回合开放限定歌曲入口，与现有synth根因完全兼容。工作量M。涉及js/shared/data.js、js/synth.js。
- 【A8】【双项目】可展开考据卡 --- LINGUA已有real注释但只内嵌文字，升级为可点开详情浮层（来源语言/例词/音标）；LB为隔离/军队/FREQUENCY X补世界观设定文本。工作量S。涉及js/main.js、(新)css。

## B. UI/UX 优化
- 【B1】【双项目】真正响应式移动端 --- 现CSS仅1个max-width断点拍单列，触屏/小屏下canvas交互（拖拽刮擦、VU/示波器、滑块）几乎不可用。补>=2断点+触摸事件分支+canvas视口缩放，PC/移动双布局。这是"双击即玩"项目最重要补齐。工作量L。涉及css/style.css、js/main.js、js/treeview.js。
- 【B2】【LINGUA】画布事件标尺与颜色图例 --- 语系树已支持拖拽/刻度/播放，但顶部未把借词/文字/分裂刻度可视化，多分支颜色无图外图例。补事件刻度条+颜色图例，降低读树门槛。工作量S。涉及js/treeview.js、css/style.css。
- 【B3】【LINGUA】词表"音爆"试听 --- 既有音系档案，可给每词配"听发音"按钮（Web Audio拼读当前词形），让博物馆更具声感（LB已示范可行）。工作量M。涉及(new)js/tts.js、js/main.js、index.html。
- 【B4】【LASTBROADCAST】动作副作用预览 --- 按钮只有标签+副文案，玩家靠记忆猜副作用。播放歌曲/新闻/信号按钮悬浮显示预估hope/mood/stamina变化，提升决策质量。工作量S。涉及js/main.js、js/shared/data.js。
- 【B5】【双项目】可访问性与动效偏好 --- 已有toast/首访导览，但缺aria标注、键盘焦点、reduced-motion。补:focus-visible、aria-live、prefers-reduced-motion，保证纯键盘与读屏可玩。工作量S。涉及css/style.css、index.html、js/main.js。
- 【B6】【LASTBROADCAST】快速重开+存档继续 --- 现在全凭一次通关；加"快速重开"与"自动存档/继续上局"（localStorage存game快照），中断可回、重播成本低。工作量M。涉及js/main.js、engine.js（序列化）。
- 【B7】【LINGUA】空态/加载态与返回顶部 --- 切年代/分支时空态只有一行红字；补友好空态文案与"回到顶部""当前分支高亮跳转"。工作量S。涉及js/main.js、css/style.css。

## C. 技术/性能优化
- 【C1】【双项目】数据与逻辑解耦 --- LINGUA把规则/事件/词表硬编码，LB把剧情全放data.js。可把展示文案与计算逻辑拆分到JSON数据文件（language.json/broadcast.json），让内容扩充与测试互不污染。工作量M。涉及两项目data/目录、js/shared/*.js、test/。
- 【C2】【LASTBROADCAST】AudioContext按需复用与释放 --- 现首次pointerdown才建ctx，但重播未显式suspend/关旧节点，长时间可能累积内存。补局间cleanup（stop全部osc/gain、suspend/resume），标签页隐藏降耗。工作量S。涉及js/synth.js、js/main.js。
- 【C3】【LINGUA】renderAll增量渲染 --- 拖动/播放时整个main重绘（树+6tab+馆藏+词源），词多易卡。只重绘受cursor影响区域（树+当前tab），canvas用rAF合帧。工作量M。涉及js/main.js。
- 【C4】【双项目】去内联onclick与全局泄漏 --- LINGUA词源关闭用inline onclick，两项目部分函数挂window。统一addEventListener+封装命名空间，顺带降低CSP风险。工作量S。涉及js/main.js、index.html。
- 【C5】【双项目】查询memo与惰性初始化 --- 音系档案/同源词/词源链以epoch+branch+gloss为key加memo避免重复计算；LB的20首歌按播放时创建。工作量S。涉及js/shared/world.js、js/synth.js。
- 【C6】【双项目】npm test脚本 --- 现依赖node --test test/*.test.js；补package.json（scripts.test）+ .gitignore，一键回归跑法，便于扩充。工作量S。涉及两项目package.json(新)。

## D. 玩法/体验增强
- 【D1】【LASTBROADCAST】结局路线图/多周目引导 --- 6结局图鉴已有，缺解锁条件预览。加"结局路线"面板显示每条还差哪些flag（lullaby/signalDecoded/从未沉默），把通关变成可探索谜题。工作量M。涉及js/shared/data.js、js/main.js。
- 【D2】【LASTBROADCAST】精力多层压力玩法 --- 精力只0-100+次档提醒。引入疲惫惩罚（低精力时歌单/新闻成本陡增、甚至强制沉默一回合），让"省精力vs持续广播"成核心张力。工作量M。涉及engine.js、main.js。
- 【D3】【LINGUA】自定义词根+可编辑规则沙盒 --- 给进阶用户迷你编辑器：输词根、调音变概率、手动分裂实时预览，让语言演化从参观变创作台，差异潜力最大。工作量L。涉及(new)js/sandbox.js、world.js、main.js。
- 【D4】【LINGUA】语系史一键叙事导出（含图） --- 现只能导出JSON；加"导出Markdown/HTML页面"（语系树PNG快照+编年史+词表+借词史），一键分享为"一门语言的维基"。工作量M。涉及js/main.js、(new)js/export2.js。
- 【D5】【双项目】成就/徽章 --- LINGUA做"首次播放/首次借词/首次文字/三语系全览"徽章，LB做"从未沉默/全听众高希望/真相路线"，存localStorage展示，小幅投入显著提升黏性。工作量M。涉及(new)js/shared/achievements.js、js/main.js。
- 【D6】【LASTBROADCAST】点歌预览与收藏歌单 --- 播放前试听副歌，支持收藏歌单（影响精力/希望兑换），给20首合成曲建立玩家-曲目记忆。工作量M。涉及js/synth.js、main.js、data.js。

## E. 风险与打磨
- 【E1】【双项目】UMD全局加载烟雾测试 --- 两项目都写浏览器+CommonJS UMD头，浏览器直接引入依赖window/self存在挂点风险。加"浏览器式全局环境加载"烟雾测试防回归。工作量S。涉及test/*.test.js。
- 【E2】【LINGUA】字形缺失兜底+完整性测试 --- GLOSS_GLYPHS按中文释义手写，新增词未补图元会静默空白。加通用占位图元+console警告，并把"字典-字形完整性"纳入测试。工作量S。涉及js/glyphs.js、test/。
- 【E3】【LASTBROADCAST】charFate分支覆盖不全 --- 有的听众命运只看hope阈值，同结局下可能撞车。为每位听众建"来电/未接/好感三态命运矩阵"，测试断言保证唯一。工作量M。涉及data.js、engine.js、test/。
- 【E4】【双项目】storage集中封装+降级提示 --- 已部分try/catch，但收藏上限30/结局去重/lb-vol等隐私模式可能静默失败。集中storage模块+不可用提示位。工作量S。涉及js/main.js、(new)js/shared/storage.js。
- 【E5】【LASTBROADCAST】canvas高DPI/布局 --- 城市窗口与VU/示波器用固定560/240，高分屏会模糊；LINGUA已用devicePixelRatio，LB尚未。统一dpr缩放。工作量M。涉及js/main.js、js/synth.js。
- 【E6】【双项目】reduced-motion与动效上限 --- LB极光/闪电/脉冲、LINGUA播放动画高频可能诱发晕动；补全局"降低动效"开关，长播放自动降帧。工作量S。涉及css/style.css、js/main.js。
- 【E7】【双项目】文档/版本一致性 --- README/DESIGN与实际数值可能漂移（词数/事件数/结局数）。加"现状核对脚本"比对标注数字与代码得数，或落地本清单后回写README。工作量S。涉及README.md、docs/*.md。

## 快速见效 TOP 10（按投入产出比排序）
1. 【B7/LINGUA】友好空态与返回顶部 --- 只改渲染+CSS，即点即见。工作量S。
2. 【E2/LINGUA】字形缺失兜底+完整性测试 --- 防内容扩充踩雷，成本极低。工作S。
3. 【A6/LB】末日新闻碎片池 --- 纯数据+随机文案，显著提升重玩差异。工作量S。
4. 【B4/LB】按钮副作用预览 --- 纯UI文案渲染，大幅降低决策试错。工作量S。
5. 【E4/双项目】storage集中封装+降级提示 --- 收口散fallback，防隐私模式静默失败。工作S。
6. 【C2/LB】音效节点按局清理 --- 防长期内存累积，改动小。工作量S。
7. 【C6/双项目】package.json test脚本 --- 标准化回归跑法，便于扩充。工作量S。
8. 【A8/LINGUA+LB】考据卡弹出层 --- 提升内容厚度，纯展示。工作量S~M。
9. 【B2/LINGUA】语系树事件刻度+颜色图例 --- 让最核心可视化更易读。工作量S~M。
10. 【C5/双项目】memo化查询/按需合成 --- 中等收益但改动小，扩充前先止血。工作量S~M。

> 排列依据：可用纯前端局部改动完成、不破坏既有26+16项测试、对"双击即玩"与"重玩/分享"价值加成最大者优先；大方向（D3沙盒、A1全量补词、D1结局路线）值得单独立项推进。