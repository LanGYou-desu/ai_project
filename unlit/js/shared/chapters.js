/* UNLIT · 无光之城 — 章节内容（地图、对象、剧情、知识卡、谜题数据）
 * 与 world.js 配合：register() 注册 6 章。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./world.js'));
  else root.UNLIT_CHAPTERS = factory(root.UNLIT_WORLD);
})(typeof self !== 'undefined' ? self : this, function (world) {
  'use strict';

  // ---------------- 助盲知识卡 ----------------
  const FACTS = {
    whitecane: { id: 'whitecane', icon: '🦯', title: '白杖', body: '白杖不是玩具，它是视障者"看得见"的手：敲击声反馈地面材质，扫动探测障碍物。看到持白杖的人，请不要随意拿走或触碰它。' },
    tactile: { id: 'tactile', icon: '🚏', title: '盲道', body: '地面上的条形凸起引导直行，圆点凸起提示转弯或危险。盲道是视障者的"道路语言"——请勿在盲道上停车或堆放杂物。' },
    guidedog: { id: 'guidedog', icon: '🐕‍🦺', title: '导盲犬', body: '导盲犬工作时戴着专用鞍具，正在引导主人。请不要喂食、抚摸或呼唤工作中的导盲犬——那会分散它的注意力。' },
    crossing: { id: 'crossing', icon: '🚦', title: '过街音响提示器', body: '路口会发出声音提示红绿灯：慢节奏表示红灯请等待，急促的"嗒嗒嗒"表示绿灯可以通行。这正是你刚刚学会的"第二双眼睛"。' },
    braille: { id: 'braille', icon: '⠓', title: '盲文', body: '盲文用 6 个凸点（2×3 矩阵）拼出 63 种组合，覆盖字母、数字与标点。摸读速度可达每分钟 100 字——你刚才体验的，是他们每天都要做的事。' },
    pay: { id: 'pay', icon: '💳', title: '无障碍支付', body: '现金纸币有盲文面额标记；如今扫码支付可以语音播报金额。但仍有视障者依赖现金与纸币识别——设计"无障碍"，是让所有人都能参与生活。' },
    etiquette: { id: 'etiquette', icon: '🤝', title: '助盲礼仪', body: '帮助视障者：先开口询问是否需要帮助；需要引路时，让他们扶住你的手肘，你在前半步带路；不要一把抓住他们的手臂或白杖。' },
    job: { id: 'job', icon: '🎙️', title: '视障就业', body: '视障者可以做程序员、调音师、电台主持人、心理咨询师……许多视障程序员用读屏软件写代码，代码质量不输任何人。' },
    audiodesc: { id: 'audiodesc', icon: '🎬', title: '口述影像', body: '在电影或展览中，用旁白描述画面内容，让视障者"看"到情节。好的口述影像，是把视觉变成语言的艺术。' },
    screenreader: { id: 'screenreader', icon: '🔊', title: '读屏软件', body: '读屏软件把屏幕上的文字朗读出来，是视障者使用电脑和手机的眼睛。你听到的每一句语音，背后都可能是他们的日常。' }
  };

  // ---------------- 通用对象工具 ----------------
  const BLOCK = { block: true };

  // ---------------- CH0 序章·醒来（卧室） ----------------
  const ch0 = {
    id: 'ch0', index: 0,
    name: '序章 · 醒来',
    entryMap: 'bedroom',
    goal: '关掉闹钟 → 穿上外套 → 摸到卧室门走出去',
    hints: [
      '用 W / ↑ 前进，←→ / A / D 转身，Space 敲白杖听回声。',
      '闹钟在床头柜上，跟着"叮叮"声走过去，贴近后按 E 关掉它。',
      '出门前记得穿外套：摸一摸衣柜（右上角），按 E 穿上。',
      '门在左下角，先穿好外套再按 E 开门。',
      '想确认方向，按 M 打开心灵地图，把听到的方位记下来。'
    ],
    facts: ['whitecane', 'braille'],
    next: { chapter: 'ch1', map: 'apt', x: 11, y: 8, facing: Math.PI },
    intro: [
      '三个月前，一场意外带走了你的视力。',
      '今天是你出院后重学日常的第一天。',
      '你叫墨。你记得这个家——记得床、衣柜、窗和那扇门。',
      '现在，它们都在黑暗里等着你。'
    ],
    outro: [
      '你关上了卧室的门。',
      '黑暗里，你听见自己的心跳——原来你比自己以为的，更熟悉这个家。'
    ],
    maps: {
      bedroom: {
        raw: [
          '##################',
          '#....a...........#',
          '#..............d.#',
          '#..bbbb..........#',
          '#..bbbb..........#',
          '#..bbbb........c.#',
          '#..bbbb..........#',
          '#..........ee....#',
          '#..........ee....#',
          '#..ff............#',
          '#..ff.....P......#',
          '##################'
        ].join('\n'),
        legend: { a: 'alarmPhone', b: 'bed', c: 'window', d: 'closet', e: 'desk', f: 'door' },
        ambience: 'bedroom'
      }
    },
    objects: {
      alarmPhone: { name: '手机', kind: 'device', block: false, loopSound: 'alarm', touch: '冰凉的屏幕贴着你的手指，还在"叮叮"地响。', interact: { type: 'flag', key: 'alarmOff', value: true, after: '你摸到熟悉的按键，按了下去。世界安静了。' } },
      bed: { name: '床', kind: 'furniture', ...BLOCK, touch: '被角还是你走那天叠好的样子。你记得它。' },
      closet: { name: '衣柜', kind: 'furniture', ...BLOCK, touch: '木门上有颗圆圆的把手。', interact: { type: 'flag', key: 'dressed', value: true, after: '你摸到外套的布料，套上，拉好拉链。风进不来了。' } },
      desk: { name: '书桌', kind: 'furniture', ...BLOCK, touch: '指尖碰到一个相框。照片里的人都笑着——那是很久以前，你还看得见的时候。' },
      window: { name: '窗', kind: 'furniture', block: false, touch: '玻璃凉凉的，外面传来很远很远的车流声。城市还醒着。' },
      door: { name: '卧室门', kind: 'exit', ...BLOCK, touch: '门把手就在你手心。', interact: { type: 'exit', need: ['alarmOff', 'dressed'], failText: '你还没准备好——闹钟还响着，外套也没穿。' } }
    }
  };

  // ---------------- CH1 出门（公寓→电梯→大堂→街道） ----------------
  const ch1 = {
    id: 'ch1', index: 1,
    name: '第一章 · 出门',
    entryMap: 'apt',
    goal: '找到钥匙 → 锁好家门 → 呼梯下楼 → 穿过大堂到街边',
    hints: [
      '钥匙在茶几上，会发出"哗啦哗啦"的金属声。',
      '出门前先锁门：靠近防盗门按 E。',
      '呼梯按钮在走廊右侧墙上：按下排有凸点的▼。',
      '电梯里按 1 楼：盲文数字 1 是"左上"一粒凸点。',
      '大堂门卫爷爷会告诉你路怎么走。'
    ],
    facts: ['etiquette'],
    next: { chapter: 'ch2', map: 'street', x: 12, y: 1, facing: Math.PI / 2 },
    intro: [
      '你住三楼。门口到电梯，一共 27 步。',
      '你要去街对面的超市——那是你失明后第一次独自出门。',
      '妈妈在电话里说："慢慢来，别怕。"'
    ],
    outro: [
      '大堂门在你身后合拢。',
      '街上的风扑面而来——人声、车声、脚步声，像一片翻涌的海。',
      '你在海边站了一会儿，然后迈出了第一步。'
    ],
    maps: {
      apt: {
        raw: [
          '################',
          '#..aa..........#',
          '#..aa..........#',
          '#..bbbb...cc...#',
          '#..bbbb...cc...#',
          '#..............#',
          '#..dd..........#',
          '#..dd..........#',
          '#..ee......P...#',
          '################'
        ].join('\n'),
        legend: { a: 'shoeRack', b: 'sofa', c: 'keys', d: 'tv', e: 'aptDoor' },
        ambience: 'apartment'
      },
      corridor: {
        raw: [
          '############',
          '#..........#',
          '#....f..gg.#',
          '#........gg#',
          '#..........#',
          '#..........#',
          '#..P.......#',
          '############'
        ].join('\n'),
        legend: { f: 'callPanel', g: 'elevDoorOut' },
        ambience: 'corridor'
      },
      elev: {
        raw: [
          '########',
          '#......#',
          '#.h....#',
          '#......#',
          '#......#',
          '#...gg.#',
          '########'
        ].join('\n'),
        legend: { h: 'floorPanel', g: 'elevDoorIn' },
        ambience: 'elevator'
      },
      lobby: {
        raw: [
          '##################',
          '#..i...........X.#',
          '#..i...........X.#',
          '#................#',
          '#......jj........#',
          '#......jj........#',
          '#................#',
          '#................#',
          '#..P.............#',
          '##################'
        ].join('\n'),
        legend: { i: 'doorman', j: 'pillar', X: '__exit__' },
        ambience: 'lobby'
      }
    },
    objects: {
      shoeRack: { name: '鞋柜', kind: 'furniture', ...BLOCK, touch: '鞋子码得整整齐齐——妈妈出门前替你摆好的。' },
      sofa: { name: '沙发', kind: 'furniture', ...BLOCK, touch: '布料的纹理，是你挑了一下午的那款。' },
      keys: { name: '钥匙串', kind: 'item', block: false, loopSound: 'keys', touch: '冰凉的金属，哗啦哗啦。', interact: { type: 'pickup', item: 'keys', after: '钥匙握进掌心，像握住了一小把安全感。' } },
      tv: { name: '电视', kind: 'furniture', ...BLOCK, touch: '屏幕是凉的。很久没开过了。' },
      aptDoor: { name: '防盗门', kind: 'door', ...BLOCK, touch: '门上有三道锁，你记得每一下转动的角度。', interact: { type: 'function', fn: (g) => { if (!g.hasItem('keys')) return { text: '钥匙不在兜里……你还没找到那串哗啦作响的钥匙。' }; if (!g.flags.locked) { g.flags.locked = true; g.loadMap('ch1', 'corridor', 2, 6, 0); return { text: '"咔哒"一声，门锁上了。你扶着墙，走进了走廊。' }; } } } },
      callPanel: { name: '呼梯按钮', kind: 'panel', block: false, touch: '墙上的圆钮：上排凸点的是上行，下排凸点的是下行。', interact: { type: 'puzzle', id: 'elevCall' } },
      elevDoorOut: { name: '电梯门', kind: 'portal', ...BLOCK, touch: '金属门，冰冰的。', interact: { type: 'portal', map: 'elev', x: 3, y: 5, facing: -1.5708, needFlag: 'elevOpen', failText: '电梯还没来。先按呼梯按钮。' } },
      floorPanel: { name: '楼层按钮', kind: 'panel', block: false, touch: '一排按钮，左角都有一粒凸点。盲文数字。', interact: { type: 'puzzle', id: 'elevFloor' } },
      elevDoorIn: { name: '电梯门', kind: 'portal', ...BLOCK, touch: '门开了，外面是走廊的灯光。', interact: { type: 'portal', map: 'lobby', x: 2, y: 8, facing: 0, needFlag: 'floor1', failText: '还没到一楼。' } },
      doorman: { name: '门卫爷爷', kind: 'npc', block: false, touch: '他轻轻拍了拍你的肩。', interact: { type: 'dialogue', npc: 'doorman' } },
      pillar: { name: '大堂柱子', kind: 'furniture', ...BLOCK, touch: '冰凉的大理石，光滑得像水。' }
    }
  };

  // ---------------- CH2 过马路（街道） ----------------
  const ch2 = {
    id: 'ch2', index: 2,
    name: '第二章 · 过马路',
    entryMap: 'street',
    goal: '听清信号音，穿过两条马路，到达超市门口',
    hints: [
      '站在路边，听：急促的"嗒嗒嗒"是绿灯，可以过；缓慢的"嗒——嗒——"是红灯，请等待。',
      '信号音来自头顶的白色小盒子——跟着它走。',
      '两段马路之间是安全岛，可以在那里停一停。',
      '过马路要快、要直，不要中途折返。'
    ],
    facts: ['crossing', 'etiquette'],
    next: { chapter: 'ch3', map: 'market', x: 1, y: 1, facing: 0 },
    intro: [
      '你站在人行道边。',
      '车流声像潮水，一阵一阵从左右涌过。',
      '头顶传来"嗒——嗒——"的慢节奏声：红灯，请等待。',
      '你握紧白杖。等它变成急促的"嗒嗒嗒"，就走。'
    ],
    outro: [
      '你的鞋底踏上超市门口的地砖。',
      '身后，车流依旧。你过了两条马路——一个人。',
      '原来害怕，是会在一小步一小步里变小的。'
    ],
    maps: {
      street: {
        raw: [
          '##############################',
          '#...........P................#',
          '#...........S................#',
          '#......rrrrrrrrrrrrrrrrr.....#',
          '#......rrrrrrrrrrrrrrrrr.....#',
          '#...............II...........#',
          '#...............II...........#',
          '#......rrrrrrrrrrrrrrrrr.....#',
          '#......rrrrrrrrrrrrrrrrr.....#',
          '#...........S.........X......#',
          '#............................#',
          '##############################'
        ].join('\n'),
        legend: { S: 'crossSignA', I: 'stranger', X: '__exit__' },
        ambience: 'street',
        crossing: {
          roads: [
            { rows: [3, 4], dirs: [1, -1], stopLineIn: 11, stopLineOut: 18 },
            { rows: [7, 8], dirs: [1, -1], stopLineIn: 11, stopLineOut: 18 }
          ],
          crosswalk: { cols: [12, 13, 14, 15, 16, 17] },
          signal: { red: 5, green: 8 },
          carSpeed: 1.3
        }
      }
    },
    objects: {
      crossSignA: { name: '过街音响提示器', kind: 'device', block: false, loopSound: 'beeper', touch: '白色小盒子，正发出节奏。它是你的红绿灯。' },
      stranger: { name: '（有人）', kind: 'npc', block: false, touch: '一只温热的手，突然抓住了你的手腕。', interact: { type: 'dialogue', npc: 'stranger', once: true } }
    }
  };

  // ---------------- CH3 超市 ----------------
  const ch3 = {
    id: 'ch3', index: 3,
    name: '第三章 · 超市',
    entryMap: 'market',
    goal: '买齐 4 样东西（大米、番茄、牛奶、罐头）→ 去收银台付钱 → 从出口离开',
    hints: [
      '货架上的东西各有各的声音：米袋沙沙响，罐头"叮"地闷响。',
      '走近货架按 E 拿取；不需要的东西可以不拿。',
      '收银台在右上方，店员会告诉你多少钱。',
      '付钱时：纸币摸左下角的凸点，硬币比大小、摸边缘。',
      '钱不够可以少给？不行——店员会礼貌地提醒你。'
    ],
    facts: ['pay', 'screenreader'],
    next: { chapter: 'ch4', map: 'shop', x: 2, y: 10, facing: 0 },
    intro: [
      '超市的广播在头顶响着："欢迎光临，请戴好口罩。"',
      '你要买：大米、番茄、牛奶、罐头。',
      '货架上的每一样东西，都有自己的声音。',
      '你竖起耳朵。'
    ],
    outro: [
      '塑料袋在你手里哗啦作响。',
      '你买齐了东西，自己付了钱。',
      '收银员说："慢走，明天还来啊。"——你不知道她长什么样，但她的声音在笑。'
    ],
    maps: {
      market: {
        raw: [
          '########################',
          '#P..aaaa....bbbb.......#',
          '#....aaaa....bbbb......#',
          '#......................#',
          '#...cccc....dddd.......#',
          '#...cccc....dddd.......#',
          '#......................#',
          '#...eeee....ffff.......#',
          '#...eeee....ffff.......#',
          '#......................#',
          '#...................gg.#',
          '#...................gg.#',
          '#...................kk.#',
          '########################'
        ].join('\n'),
        legend: { a: 'shelfRice', b: 'shelfTomato', c: 'shelfMilk', d: 'shelfCan', e: 'shelfSauce', f: 'shelfBread', g: 'cashier', k: 'exitDoor' },
        ambience: 'market'
      }
    },
    objects: {
      shelfRice: { name: '米袋', kind: 'shelf', ...BLOCK, loopSound: 'rice', touch: '指尖陷进米袋，沙沙的。', interact: { type: 'buy', item: '大米' } },
      shelfTomato: { name: '番茄', kind: 'shelf', ...BLOCK, loopSound: 'tomato', touch: '圆滚滚、凉丝丝，轻轻一按会"啵"地回弹。', interact: { type: 'buy', item: '番茄' } },
      shelfMilk: { name: '牛奶', kind: 'shelf', ...BLOCK, loopSound: 'milk', touch: '纸盒轻轻一晃，里面晃荡晃荡。', interact: { type: 'buy', item: '牛奶' } },
      shelfCan: { name: '罐头', kind: 'shelf', ...BLOCK, loopSound: 'can', touch: '金属外壳，指节敲上去"叮"地一响。', interact: { type: 'buy', item: '罐头' } },
      shelfSauce: { name: '酱油', kind: 'shelf', ...BLOCK, loopSound: 'bottle', touch: '玻璃瓶，沉甸甸的。', interact: { type: 'buy', item: '酱油' } },
      shelfBread: { name: '面包', kind: 'shelf', ...BLOCK, loopSound: 'bread', touch: '塑料袋里软软的。', interact: { type: 'buy', item: '面包' } },
      cashier: { name: '收银台', kind: 'npc', ...BLOCK, touch: '扫码枪"嘀"了一声。', interact: { type: 'puzzle', id: 'pay' } },
      exitDoor: { name: '出口', kind: 'exit', ...BLOCK, touch: '感应门。', interact: { type: 'exit', need: ['paid'], failText: '还没付钱呢——收银员还在等你。' } }
    }
  };

  // ---------------- CH4 盲文书店 ----------------
  const ch4 = {
    id: 'ch4', index: 4,
    name: '第四章 · 盲文书店',
    entryMap: 'shop',
    goal: '读懂信里的线索 → 找到那本书 → 在老板面前完成一次"试音"',
    hints: [
      '信在阅读桌上，是用盲文写的。按 E 摸读。',
      '盲文 6 点：数字 1 是"左上"一粒点；字母 a 同样。对照你桌上的盲文表。',
      '信里说"那本书是xx的密码"——找出书脊上是两个 x 的那本。',
      '老板让你试音：跟着节拍器，在"嗒"响的瞬间按 E。'
    ],
    facts: ['braille', 'job', 'audiodesc'],
    next: { chapter: 'ch5', map: 'kitchen', x: 13, y: 10, facing: Math.PI },
    intro: [
      '书店很小，但安静得刚刚好。',
      '你听见书页翻动的声音——这里的主人，和你一样看不见。',
      '桌上有一封信。是你妈妈写来的，有人帮她译成了盲文。',
      '你把手放了上去。'
    ],
    outro: [
      '老板说："你的声音很有力量。"',
      '明天下午三点，无光电台，有一场试音。',
      '你握着那本《星星的密码》，心里有什么东西，亮了一下。'
    ],
    maps: {
      shop: {
        raw: [
          '######################',
          '#....................#',
          '#..aaaa....bbbb......#',
          '#..aaaa....bbbb......#',
          '#....................#',
          '#..cccc....dddd......#',
          '#..cccc....dddd......#',
          '#....................#',
          '#......eeee..........#',
          '#......eeee......X...#',
          '#.P..................#',
          '#.................gg.#',
          '#.................gg.#',
          '######################'
        ].join('\n'),
        legend: { a: 'shelfA', b: 'shelfB', c: 'shelfC', d: 'shelfD', e: 'letterTable', g: 'boss', X: '__exit__' },
        ambience: 'bookstore'
      }
    },
    objects: {
      shelfA: { name: '书架·甲', kind: 'bookshelf', ...BLOCK, touch: '一排书脊，都带着凸点。', interact: { type: 'puzzle', id: 'books' } },
      shelfB: { name: '书架·乙', kind: 'bookshelf', ...BLOCK, touch: '书脊上的盲文，在你的指尖下微微发烫。', interact: { type: 'puzzle', id: 'books' } },
      shelfC: { name: '书架·丙', kind: 'bookshelf', ...BLOCK, touch: '一本本书，像一排安静的琴键。', interact: { type: 'puzzle', id: 'books' } },
      shelfD: { name: '书架·丁', kind: 'bookshelf', ...BLOCK, touch: '指尖滑过，有些书脊磨损了。', interact: { type: 'puzzle', id: 'books' } },
      letterTable: { name: '阅读桌', kind: 'furniture', ...BLOCK, touch: '桌面上摊着一封信，纸面凸起。', interact: { type: 'puzzle', id: 'letter' } },
      boss: { name: '书店老板', kind: 'npc', block: false, touch: '他笑了笑，声音温和。', interact: { type: 'function', fn: (g) => {
        if (!g.flags.letterRead) return { text: '老板温和地说："先读读那封信吧，在阅读桌上。"' };
        if (!g.flags.bookFound) return { text: '老板笑了笑："《星星的密码》还在书架上等你。"' };
        if (!g.flags.auditionDone) { g.startAudition(); return { text: '老板敲了敲桌面："来，跟着我的节拍试一句音——每一声之后，按 E。"' }; }
        return { text: '老板点点头："明天下午三点，无光电台。别怕，黑屋子里的声音，才最真。"' };
      } } }
    }
  };

  // ---------------- CH5 回家（厨房） ----------------
  const ch5 = {
    id: 'ch5', index: 5,
    name: '终章 · 回家',
    entryMap: 'kitchen',
    goal: '接水 → 烧水（听水开）→ 切菜（跟节奏）→ 炒菜 → 吃饭',
    hints: [
      '接水：走到水槽边按 E，听水流进锅里的声音。',
      '烧水：水开时气泡声会又密又急，那一刻按 E。',
      '切菜：跟着"笃笃"的节奏，在每一声后按 E。',
      '炒菜：锅里的"滋啦"声变密时，按 E 翻一翻。',
      '最后回到餐桌，按 E 坐下吃饭。'
    ],
    facts: ['guidedog', 'tactile', 'screenreader'],
    intro: [
      '傍晚。你回到了家。',
      '厨房里的一切都等着你：水、火、刀、锅。',
      '妈妈在电话里说过："看不见也能做饭，火候会告诉你。"',
      '你卷起袖子。'
    ],
    outro: [
      '一碗热腾腾的面，端到桌上。',
      '你一个人吃完了它。',
      '窗外，城市的灯光一盏一盏亮起来。',
      '你看不见它们——但你知道，它们在。'
    ],
    maps: {
      kitchen: {
        raw: [
          '######################',
          '#..aaaa....bbbb.....h#',
          '#..aaaa....bbbb......#',
          '#....................#',
          '#....cccc....dddd....#',
          '#....cccc....dddd....#',
          '#....................#',
          '#..eeee..............#',
          '#..eeee..............#',
          '#.......ffff.........#',
          '#.......ffff....P....#',
          '######################'
        ].join('\n'),
        legend: { a: 'sink', b: 'stove', c: 'board', d: 'pan', e: 'fridge', f: 'table', h: 'window' },
        ambience: 'kitchen'
      }
    },
    objects: {
      sink: { name: '水槽', kind: 'cook', ...BLOCK, loopSound: 'tap', touch: '龙头冰凉。', interact: { type: 'cook', step: 'sink' } },
      stove: { name: '灶台', kind: 'cook', ...BLOCK, loopSound: 'boil', touch: '火焰的声音，暖暖的。', interact: { type: 'cook', step: 'stove' } },
      board: { name: '砧板', kind: 'cook', ...BLOCK, loopSound: 'chop', touch: '刀落在木板上的声音，笃笃的。', interact: { type: 'cook', step: 'board' } },
      pan: { name: '炒锅', kind: 'cook', ...BLOCK, loopSound: 'sizzle', touch: '"滋啦"一声，油花溅起。', interact: { type: 'cook', step: 'pan' } },
      fridge: { name: '冰箱', kind: 'furniture', ...BLOCK, touch: '冷气扑面。里面有妈妈上周包好的饺子。' },
      table: { name: '餐桌', kind: 'cook', ...BLOCK, touch: '木头桌面，还有一道小时候刻的痕。', interact: { type: 'cook', step: 'table' } },
      window: { name: '窗', kind: 'furniture', block: false, touch: '玻璃上凝着夜雾。城市的灯光，在很远的地方亮着。' }
    }
  };

  // ---------------- 谜题数据 ----------------
  ch1.puzzles = {
    elevCall: {
      title: '呼梯按钮',
      desc: '两个按钮：一个上排凸点（▲ 上行），一个下排凸点（▼ 下行）。你要下楼，按哪一个？',
      options: [
        { id: 'up', label: '上排凸点 ▲', mask: 9 },
        { id: 'down', label: '下排凸点 ▼', mask: 36 }
      ],
      correct: 'down',
      onSuccess: '电梯"叮"的一声到了，门缓缓打开。',
      onFail: '电梯往上走了……你听见它停在了别的楼层。还是按▼吧。'
    },
    elevFloor: {
      title: '楼层按钮',
      desc: '电梯里有一排盲文数字按钮。你要去一楼。盲文数字 1 = 字母 a = 左上角一粒凸点。按哪一个？',
      options: [
        { id: '1', label: '⠼⠁ 一粒点（左上）', mask: 1 },
        { id: '2', label: '⠼⠃ 两粒点（左上+左中）', mask: 3 },
        { id: '3', label: '⠼⠉ 两粒点（左上+右上）', mask: 9 }
      ],
      correct: '1',
      onSuccess: '电梯轻轻一沉，开始下降。"叮——一楼到了。"',
      onFail: '电梯门开了又关上……不是这一层。再想想盲文数字 1 的样子。'
    }
  };
  ch3.puzzles = {
    pay: {
      title: '结账',
      desc: '店员说："一共 27 元 5 角。"你把手伸进钱包，摸到纸币和硬币。',
      items: [
        { id: 'm1', name: '大米', price: 1200 },
        { id: 'm2', name: '番茄', price: 450 },
        { id: 'm3', name: '牛奶', price: 600 },
        { id: 'm4', name: '罐头', price: 500 }
      ],
      price: 2750,
      shortText: '还差',
      successText: '店员数了数："正好！找你零钱。"她把硬币放进你手心，暖暖的。',
      failText: '店员温和地说："还差一点，您再摸摸？"'
    }
  };
  ch4.puzzles = {
    letter: {
      title: '妈妈的信（盲文）',
      desc: '信上的盲文有些磨损。你读到的内容是：',
      lines: [
        { text: 'qin ai de mo', wear: 1, reveal: true },
        { text: 'ming tian san dian shi yin', wear: 2, answer: 'shiyin', clue: '明天下午的安排——两个字的拼音' },
        { text: 'na ben shu shi xing xing de mi ma', wear: 2, answer: 'xx', clue: '那本书的名字缩写——同一个字母写两遍' }
      ],
      successText: '你把信读完，指尖微微发抖。妈妈在信里说：明天下午三点，去无光电台试音。'
    },
    books: {
      title: '书脊上的盲文',
      desc: '四座书架上，每本书的书脊都写着盲文书名。找那本《星星的密码》——它的缩写是两个 x。',
      books: [
        { id: 'book1', title: '风的声音', code: 'fs' },
        { id: 'book2', title: '河流', code: 'hl' },
        { id: 'book3', title: '月亮', code: 'yl' },
        { id: 'book4', title: '星星的密码', code: 'xx' },
        { id: 'book5', title: '森林', code: 'sl' },
        { id: 'book6', title: '灯塔', code: 'dt' },
        { id: 'book7', title: '影子', code: 'yz' },
        { id: 'book8', title: '花园', code: 'hy' }
      ],
      correct: 'book4',
      successText: '你把那本书抽出来。封面上的书名，和信里说的一模一样：《星星的密码》。',
      failText: '不是这本……书脊上的两个字母，再对一对。'
    },
    audition: {
      title: '试音练习',
      desc: '老板说："读一段给我听听——跟着我的节拍，在每一声之后开口。"（按 E 跟上 4 拍）',
      beats: 4,
      successText: '老板点点头："你的声音很有力量。明天，就这样读。"',
      failText: '老板笑了笑："别紧张，再来一次。"'
    }
  };
  ch5.puzzles = {
    cook: {
      steps: [
        { id: 'sink', name: '接水', desc: '打开水龙头，听水落进锅里的声音。水流变稳时，按 E 关水。' },
        { id: 'stove', name: '烧水', desc: '水在锅里慢慢热起来。气泡声又密又急的那一刻——按 E 关火。' },
        { id: 'board', name: '切菜', desc: '跟着"笃笃"的节奏，每一声之后按一次 E，切完四刀。' },
        { id: 'pan', name: '炒菜', desc: '油锅"滋啦滋啦"。声音最热闹的时候，按 E 翻一翻。' },
        { id: 'table', name: '吃饭', desc: '面好了。回到餐桌，按 E 坐下。' }
      ],
      doneText: '一碗热腾腾的面。你吹了吹气，尝了一口——是妈妈的味道。'
    }
  };

  // ---------------- NPC 台词 ----------------
  ch1.dialogue = {
    doorman: [
      { who: '门卫爷爷', text: '小墨，今天自己出门？' },
      { who: '门卫爷爷', text: '好孩子。过马路记住喽——头顶的盒子"嗒嗒嗒"变急了，就是绿灯，大胆走；"嗒——嗒——"慢吞吞的，就站住。"' },
      { who: '门卫爷爷', text: '超市门口的地砖上有一条条凸起，跟着它走，就是无障碍坡道。去吧，爷爷给你留着门。' }
    ]
  };
  ch2.dialogue = {
    stranger: [
      { who: '（陌生人）', text: '哎！别动别动！我拉你过去——' },
      { who: '（陌生人）', text: '……啊，对不起，我吓到你了？我是想帮你。' },
      { who: '墨（你）', text: '（你后退了半步，心跳得很快。）谢谢您……但请先问我一声，好吗？' },
      { who: '（陌生人）', text: '对对，是我太急了。您需要帮忙吗？' },
      { who: '墨（你）', text: '（你深吸一口气。）我听得见信号灯。我可以自己过去。' }
    ]
  };
  ch3.dialogue = {
    clerk: [
      { who: '店员', text: '您好，一共 27 元 5 角。' },
      { who: '店员', text: '纸币角上有凸点，硬币呢，大的锯齿边是一元，小的是五角、一角——您慢慢摸，不着急。' },
      { who: '店员', text: '谢谢惠顾！我帮您把东西装好。' }
    ]
  };
  ch4.dialogue = {
    boss: [
      { who: '老板', text: '信读完了？那是你妈妈找志愿者译的盲文，一个字一个字摸出来的。' },
      { who: '老板', text: '我在这行干了二十年。眼睛看不见，耳朵就是命——你刚才读信的声音，稳，亮，有温度。' },
      { who: '老板', text: '无光电台明天下午三点试音。别怕。黑屋子里的声音，才最真。' }
    ]
  };
  ch5.dialogue = {};

  // ---------------- 注册 ----------------
  [ch0, ch1, ch2, ch3, ch4, ch5].forEach(c => world.register(c));

  return { FACTS, ch0, ch1, ch2, ch3, ch4, ch5, CHAPTERS: world.CHAPTERS, get: world.get };
});
