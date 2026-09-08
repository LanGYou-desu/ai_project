/* LASTBROADCAST · 末日电台 —— 全部剧情数据（角色/歌曲/播报/来电/信号/结局） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LB = root.LB || {}; root.LB.data = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TURNS = [
    { hour: 22, label: '22:00 · 入夜', beat: '22:00。城市隔离第七天。站长把钥匙放在调音台上，只留了一句话：「播到天亮。」外面的天空，有一道不属于任何星座的光。' },
    { hour: 0, label: '00:00 · 午夜', beat: '00:00。午夜。风停了，整座城市安静得像一台关掉声卡的机器。你的手指停在旋钮上。' },
    { hour: 2, label: '02:00 · 深夜', beat: '02:00。最深的夜。远处有火光一闪而过，又熄了。电话总机亮起了一盏灯。' },
    { hour: 4, label: '04:00 · 黎明前', beat: '04:00。黎明前最黑的一刻。窗外有人举着蜡烛走过街道，像一条发光的河。' },
    { hour: 6, label: '06:00 · 没有日出', beat: '06:00。天没有亮。光还在天上，但没有太阳该有的颜色。你想起一句话：「天亮之前，先让声音落地。」' },
    { hour: 8, label: '08:00 · 封锁线', beat: '08:00。军用电台切入了频率。封锁线在收缩。' },
    { hour: 10, label: '10:00 · 早晨', beat: '10:00。城市醒了一半——以另一种方式。楼下的便利店排着长队，没人说话。' },
    { hour: 12, label: '12:00 · 正午', beat: '12:00。正午，天空却暗得像黄昏。你收到一条匿名短信：「别关灯。」' },
    { hour: 14, label: '14:00 · 停电', beat: '14:00。停电了。你切到备用电源，广播室的灯重新亮起。整座城市只剩下你的频率。' },
    { hour: 16, label: '16:00 · 信号', beat: '16:00。一个陌生的频率在电波里若隐若现，像心跳。温教授说，那是天文台的应急频道。' },
    { hour: 18, label: '18:00 · 告别时刻', beat: '18:00。黄昏没有来。最后一通电话密集地打进来——告别的时候到了。' },
    { hour: 22, label: '22:00 · 终局', beat: '22:00。二十四小时，到了。你按下麦克风，最后一次深呼吸。整个城市，都在等你开口。' }
  ];

  var CHARACTERS = [
    { id: 'susan', name: '苏珊', role: '咖啡馆老板娘', likes: ['hype', 'warm'],
      intro: '楼下咖啡馆的老板娘，认识半座城市的人。', state: 60 },
    { id: 'twins', name: '小杰 & 小安', role: '双胞胎兄妹', likes: ['lullaby'],
      intro: '一对七岁的双胞胎，住在广播站对面。', state: 55 },
    { id: 'xiaoyu', name: '小雨', role: '八岁女孩', likes: ['lullaby', 'calm'],
      intro: '总是抱着一个小熊收音机的女孩。', state: 45 },
    { id: 'daye', name: '大爷', role: '独居老人', likes: ['nostalgic', 'calm'],
      intro: '年轻时的广播工程师，如今一个人住。', state: 50 },
    { id: 'doctor', name: '陈医生', role: '急诊医生', likes: ['calm', 'hopeful'],
      intro: '市中心医院的急诊医生，声音很累。', state: 40 },
    { id: 'lily', name: '莉莉', role: '电台实习生', likes: ['warm', 'hopeful'],
      intro: '站长的关门弟子，如今只剩你俩。', state: 55 },
    { id: 'lin', name: '林队长', role: '消防队长', likes: ['hype', 'hopeful'],
      intro: '话很少，但答应过的事一定做到。', state: 50 },
    { id: 'akai', name: '阿凯', role: '出租车司机', likes: ['hype', 'nostalgic'],
      intro: '被困在隧道口的出租车司机。', state: 42 },
    { id: 'professor', name: '温教授', role: '天文学家', likes: ['hopeful', 'calm'],
      intro: '城北天文台唯一还在岗的人。', state: 48 },
    { id: 'veteran', name: '老兵', role: '退伍军人', likes: ['nostalgic', 'hype'],
      intro: '参加过三十年前那场战争。', state: 52 },
    { id: 'laozhou', name: '老周', role: '守夜人', likes: ['calm', 'nostalgic'],
      intro: '广播站大楼的守夜人，比站长还早来这里。', state: 58 },
    { id: 'ayun', name: '阿芸', role: '孕妈妈', likes: ['calm', 'hopeful'],
      intro: '预产期就在明天。她把收音机贴在肚子上。', state: 55 },
    { id: 'xiaoyang', name: '小杨', role: '便利店店员', likes: ['hype', 'warm'],
      intro: '二十四小时便利店，只剩他一个人在守夜。', state: 45 },
    { id: 'apopo', name: '阿婆', role: '老听众', likes: ['nostalgic', 'lullaby'],
      intro: '从收音机刚普及的年代，一直听到今天。', state: 58 },
    { id: 'luolaoshi', name: '罗老师', role: '音乐老师', likes: ['calm', 'nostalgic'],
      intro: '教了一辈子音乐，把钢琴搬到了窗边。', state: 52 }
  ];

  var SONGS = [
    { id: 'nightstar', title: '《夜航星》', tags: ['calm'],
      desc: '缓慢的钢琴，像海面上一盏不灭的灯。', hope: 4, mood: 3 },
    { id: 'steelheart', title: '《钢铁的心》', tags: ['hype'],
      desc: '鼓点像心跳，口号像潮水。', hope: 6, mood: 2 },
    { id: 'rainy', title: '《雨后的车站》', tags: ['sad'],
      desc: '口琴和雨声，等一辆永远不会来的末班车。', hope: -1, mood: 2 },
    { id: 'starlet', title: '《小星星变奏曲》', tags: ['lullaby'],
      desc: '最简单的旋律，哄过一代人入睡。', hope: 5, mood: 4 },
    { id: 'oldtape', title: '《老磁带》', tags: ['nostalgic'],
      desc: '沙沙的底噪，和 1997 年夏天的翻录磁带。', hope: 3, mood: 3 },
    { id: 'whitenoise', title: '《白噪音摇篮曲》', tags: ['lullaby', 'calm'],
      desc: '雨声、炉火和轻柔的人声。', hope: 6, mood: 5 },
    { id: 'lastbus', title: '《末班车》', tags: ['sad', 'hopeful'],
      desc: '弦乐一点点亮起来，像天边第一道光。', hope: 4, mood: 2 },
    { id: 'sunrise', title: '《朝阳升起之前》', tags: ['hopeful'],
      desc: '在黑暗里唱给太阳的歌。', hope: 7, mood: 4 },
    { id: 'loveletter', title: '《电台情书》', tags: ['warm'],
      desc: '用点歌节目该有的温柔，念一封没有地址的信。', hope: 4, mood: 5 },
    { id: 'farewell', title: '《无声的告别》', tags: ['farewell'],
      desc: '所有人都安静下来听的一首歌。', hope: 2, mood: 6 },
    { id: 'moonboat', title: '《月亮船》', tags: ['lullaby'],
      desc: '外婆教的童谣：月亮是一艘船，载着星星去睡觉。', hope: 5, mood: 4 },
    { id: 'prelude', title: '《黎明前奏》', tags: ['hype'],
      desc: '铜管乐在黑暗中吹响——天快亮了。', hope: 6, mood: 3 },
    { id: 'homelight', title: '《家里的灯》', tags: ['warm'],
      desc: '炉火、饭香、门缝里漏出来的光。', hope: 5, mood: 5 },
    { id: 'oldradio', title: '《外婆的收音机》', tags: ['nostalgic'],
      desc: '半个世纪前的声音，还留在旋钮里。', hope: 4, mood: 4 },
    { id: 'birds', title: '《候鸟》', tags: ['hopeful'],
      desc: '它们每年都回来——这一次也不会例外。', hope: 8, mood: 4 },
    { id: 'lastletter', title: '《最后的信》', tags: ['farewell'],
      desc: '一封写给所有人的信，念完就沉默。', hope: 3, mood: 7 },
    { id: 'emptyroom', title: '《空房间》', tags: ['sad'],
      desc: '一把没人弹的吉他，和一屋子回声。', hope: -2, mood: 2 },
    { id: 'keeper', title: '《灯塔守夜人》', tags: ['calm'],
      desc: '低沉的提琴，像灯塔里独坐的人。', hope: 4, mood: 3 },
    { id: 'forlily', title: '《给莉莉的歌》', tags: ['warm'],
      desc: '一首专门写给某个人的歌。', hope: 5, mood: 6 },
    { id: 'streetcat', title: '《街角的猫》', tags: ['nostalgic'],
      desc: '一首关于巷口那只猫的轻快小调。', hope: 4, mood: 5 },
    { id: 'flagwind', title: '《风中的旗》', tags: ['calm'],
      desc: '像一面听不见的旗，在风里飘。', hope: 3, mood: 3 },
    { id: 'lastferry', title: '《最后一班渡轮》', tags: ['sad'],
      desc: '汽笛响过，就再也没有船了。', hope: -1, mood: 2 },
    { id: 'lighthouseletter', title: '《灯塔的信》', tags: ['warm'],
      desc: '一封写给海的信。', hope: 5, mood: 5 },
    { id: 'dayend', title: '《白昼将尽》', tags: ['hopeful'],
      desc: '太阳落下之前，把歌唱完。', hope: 6, mood: 3 },
    { id: 'midclock', title: '《零点的钟》', tags: ['nostalgic'],
      desc: '钟响十二下，去年就过去了。', hope: 3, mood: 4 },
    { id: 'dawnrain', title: '《清晨五点的雨》', tags: ['calm'],
      desc: '雨落在空街上，像谁在轻轻敲门。', hope: 4, mood: 3 },
    { id: 'nightlullaby', title: '《守夜摇篮曲》', tags: ['lullaby'], unlockTurn: 3,
      desc: '给所有睡不着的人。', hope: 6, mood: 5 },
    { id: 'march', title: '《军队进行曲》', tags: ['hype'], unlockTurn: 5,
      desc: '整齐的鼓点，像一列列脚步。', hope: 5, mood: 1 },
    { id: 'powerrest', title: '《停电应急曲》', tags: ['calm'], unlockTurn: 8,
      desc: '安静得像备用电源的嗡鸣。', hope: 4, mood: 3 },
    { id: 'finalwaltz', title: '《终局圆舞曲》', tags: ['farewell'], unlockTurn: 11,
      desc: '一支转完就停的舞曲。', hope: 4, mood: 7 },
    { id: 'memorial', title: '《纪念日》', tags: ['warm'], hidden: true,
      desc: '只有收集全部结局的人，才能听到的歌。', hope: 5, mood: 6 }
  ];

  var NEWS = {
    soothe: {
      label: '安抚人心', hope: 6, mood: 3,
      text: '你说：一切都会好起来的。城里有应急物资，医疗队在路上……你不知道这是不是真的，但你把声音放得很轻。'
    },
    neutral: {
      label: '中立播报', hope: 3, mood: 0,
      text: '你说：现在播报最新情况。电力恢复百分之四十，东区避难所开放……你只念事实，一个字也不多。'
    },
    truth: {
      label: '说出真相', hope: -5, mood: -2,
      text: '你说：隔离不会解除。天空里的光不是极光，是别的什么。你们有权知道真相。'
    }
  };

  // 每回合的意外插曲（进入该回合时写入日志；每回合 3 个变体，按局随机）
  var TURN_INTERLUDES = [
    ['', '', ''],
    ['窗外有人放了一支烟花，没有人鼓掌。', '隔壁楼的收音机开到最大，沙沙地唱了一夜。', '楼下一辆自行车倒在地上，轮子还在转。'],
    ['一阵风把落叶卷上了广播站的天台。', '有人在天台支了一架望远镜，对着天空。', '对面楼的灯一盏盏灭了，又一盏盏亮起来。'],
    ['楼下传来几声狗叫，很快又安静了。', '街角的面包店飘出烤焦的味道，门却锁着。', '有人在墙上画了一只猫，旁边写着「加油」。'],
    ['有人在墙上用粉笔写：「电台加油」。', '一个孩子把纸飞机从楼上飞下来，落在广播站门口。', '便利店门口的自动门开开合合，没有人进出。'],
    ['军车的探照灯扫过窗户。', '头顶传来直升机的轰鸣，又远去了。', '封锁线又往里缩了一圈。'],
    ['太阳的位置不对——它比昨天低了一截。', '天色像被调暗了一档。', '影子拉得比下午更长。'],
    ['一只猫蹲在广播站门口，像是在听。', '窗台上落了一只鸟，没飞走。', '门口的猫换了个姿势，继续听。'],
    ['备用电源发出低沉的嗡鸣，像在哼歌。', '停电的街区，有人在用收音机对暗号。', '路灯灭掉的那条街，亮起了一排手机屏。'],
    ['天文台的方向，划过一道细细的光。', '云层裂开一条缝，露出不该出现的星。', '广播里隐约能听到另一个台的信号。'],
    ['有人把手机举到窗口，屏幕亮成一盏灯。', '楼下有人对着收音机挥手。', '一束手电光从对面楼扫过来，晃了两下。'],
    ['最后一通电话挂断后，房间里只剩电流声。', '整座城市都在等你说点什么。', '你听见自己的心跳，比收音机的电流声还响。']
  ];

  // 听众支线（A5）：条件满足时在对应回合浮现一次
  var ARCS = [
    { char: 'xiaoyu', cond: function (s) { return s.flags.lullaby; }, text: '小雨把收音机抱在怀里，说这是她最好的朋友。' },
    { char: 'twins', cond: function (s) { return s.flags.lullaby; }, text: '小杰小安睡着了，收音机还抱在中间。' },
    { char: 'apopo', cond: function (s) { return s.flags.nostalgic; }, text: '阿婆说：外婆那台收音机，就是这个声音。' },
    { char: 'luolaoshi', cond: function (s) { return s.flags.lullaby; }, text: '罗老师坐在窗边，把那首歌又弹了一遍。' },
    { char: 'veteran', cond: function (s) { return s.flags.veteranHonored; }, text: '老兵说：冲锋号其实不用放，你们的歌就够。' },
    { char: 'laozhou', cond: function (s) { return s.flags.laozhouHonored; }, text: '老周在天台点了根烟，很久没有说话。' },
    { char: 'professor', cond: function (s) { return s.flags.signalDecoded; }, text: '温教授对着抄下的坐标看了很久：谢谢你，孩子。' },
    { char: 'doctor', cond: function (s) { return s.flags.truthCount >= 1; }, text: '陈医生在交班本上写了一行字：电台没有说谎。' },
    { char: 'lin', cond: function (s) { return s.flags.truthCount >= 1; }, text: '林队长说：你们电台，是我们唯一的司令部。' },
    { char: 'lily', cond: function (s) { return s.flags.signalDecoded; }, text: '莉莉把备份盘递给你：这个，请你保管。' },
    { char: 'ayun', cond: function (s) { return s.turn >= 5; }, text: '阿芸在广播里听到你们的声音，宝宝踢了她一下。' },
    { char: 'ayun', cond: function (s) { return s.chars.ayun.hope >= 60; }, text: '阿芸说：孩子说，谢谢你们。' },
    { char: 'akai', cond: function (s) { return s.chars.akai.hope >= 55; }, text: '阿凯把电台声音调大，隧道口的车灯跟着节奏闪。' },
    { char: 'susan', cond: function (s) { return s.chars.susan.hope >= 60; }, text: '苏珊给门口的路人一人一杯热茶，说电台教的。' },
    { char: 'xiaoyang', cond: function (s) { return s.chars.xiaoyang.hope >= 50; }, text: '小杨在门上挂了块牌子：本店今夜不打烊。' }
  ];

  // 世界观考据（A8）
  var WORLD_NOTES = {
    isolation: {
      title: '隔离', text: '七天前，天空出现了一道不属于任何星座的光。城市被封锁，通讯只剩你这一台还开着的公共电台。没有人解释发生了什么——或者说，没有人在听解释。'
    },
    military: {
      title: '军队', text: '第 6 回合起，军用电台会强行切入你的频率。他们需要你转播宵禁令；你也可以选择沉默。封锁线在收缩，探照灯扫过每一扇窗户。'
    },
    frequencyX: {
      title: 'FREQUENCY X', text: '天文台的应急频率。它在倒数——7、6、5……据说是一串坐标，指向城北。只有温教授能解释它，而他只在第 10 回合打来一次电话。'
    }
  };

  // 每回合的城市观察（旁白）
  var CITY_OBSERVATIONS = [
    '楼下便利店的灯还亮着。',
    '风停了。连狗都不叫了。',
    '远处的火光又闪了一下。',
    '蜡烛的队伍从东街走到西街。',
    '天边那道光，比昨晚更亮了。',
    '有直升机从头顶飞过。',
    '便利店门口排起了队，没有人说话。',
    '有人在天台晾了一床被子。',
    '停电的街区正在一盏一盏地亮起来——那是手机屏幕。',
    '天文台的灯一直没灭。',
    '楼下有人对着收音机挥手。',
    '整座城市都在等你说点什么。'
  ];

  // 每个时段的来电（request 为点播歌曲；同回合多个来电只能接一个，其余错过）
  var CALLS = [
    { turn: 0, caller: 'susan', request: 'nightstar',
      line: '苏珊打进来：「电台还开着？太好了……我就是想听听人声。你放的那首歌叫什么？」', reply: '「《夜航星》，送你。」',
      missed: '苏珊没有再打来。你把《夜航星》放了两遍。' },
    { turn: 1, caller: 'twins', request: 'whitenoise',
      line: '小杰小安一起喊：「哥哥！我们能不能点一首歌？就那种……睡觉听的！」', reply: '「可以，等会儿就放。」',
      missed: '小杰小安没有再打来。他们的收音机一直开着。' },
    { turn: 2, caller: 'xiaoyu', request: 'starlet',
      line: '小雨的声音很小：「我妈妈在楼下，她让我别哭。可是我好想听那首《小星星》……」', reply: '「那就听。答应我听完就睡，好不好？」',
      missed: '小雨没有再打来。她抱着小熊收音机，等了一整夜。' },
    { turn: 3, caller: 'daye', request: 'oldtape',
      line: '大爷慢慢说：「小伙子，帮我放一首老歌吧。我想起我老伴了……」', reply: '「好，给你放《老磁带》。」',
      missed: '大爷没有再打来。他把收音机贴在窗台上。' },
    { turn: 3, caller: 'apopo', request: 'oldradio',
      line: '阿婆的声音很轻：「我外婆的收音机，还能听见吗？我想听那台旧收音机的声音。」', reply: '「能。你听——这就是它的声音。」',
      missed: '阿婆没有再打来。她的收音机一直沙沙地响着。' },
    { turn: 4, caller: 'doctor', request: 'birds',
      line: '陈医生声音很累：「急诊室还有 7 个病人。外面到底怎么了？你能说句实话吗？」', reply: '「……我会的。你们撑住。」',
      missed: '陈医生没有再打来。急诊室的灯还亮着。' },
    { turn: 6, caller: 'lily', request: 'homelight',
      line: '莉莉带着哭腔：「站长走了以后我就怕。师父，你说我们这电台……还能开多久？」', reply: '「开到天亮。」',
      missed: '莉莉没有再打来。她抱着备份盘坐在门口。' },
    { turn: 6, caller: 'xiaoyang', request: 'steelheart',
      line: '小杨在收银台后小声说：「能不能放点提气的？我一个人守店，有点……怕。」', reply: '「给你放《钢铁的心》。别怕。」',
      missed: '小杨没有再打来。便利店的灯一夜没关。' },
    { turn: 7, caller: 'lin',
      line: '林队长压低声音：「广播室东边的天台可以上去。如果你收到什么信号……别自己一个人扛。」', reply: '「明白。你也小心。」',
      missed: '林队长没有再打来。消防车停在街角，警灯亮了一夜。' },
    { turn: 8, caller: 'akai', request: 'lastbus',
      line: '阿凯在车里：「停电了，我被困在隧道口。电台是我现在唯一的灯。」（背景里有人在敲车窗）', reply: '「别开车门。陪你到电来。」',
      missed: '阿凯没有再打来。隧道口的车灯闪了三下。' },
    { turn: 9, caller: 'professor',
      line: '温教授声音颤抖：「那个频率……那是天文台的应急频率。它在倒数。你能听懂它吗？」', reply: '「我试试。」（你记下了频率）',
      missed: '温教授没有再打来。天文台的灯一直没灭。' },
    { turn: 9, caller: 'luolaoshi', request: 'oldradio',
      line: '罗老师的声音很温和：「我教了一辈子音乐。今晚，能不能放一首《外婆的收音机》？送给我的学生们。」', reply: '「好。也送给你。」',
      missed: '罗老师没有再打来。她把钢琴搬到了窗边。' },
    { turn: 10, caller: 'laozhou',
      line: '老周说：「这一夜，你陪着我们，值了。天亮以后，不管有没有太阳，我都记得今晚。」', reply: '「谢谢你，老周。」',
      missed: '老周在天台站了一夜，没有说话。' },
    { turn: 10, caller: 'veteran',
      line: '老兵说：「广播里放个冲锋号吧。老子最后一次听见它，是在三十年前。」（他笑了）', reply: '「敬礼。」',
      missed: '老兵把收音机放在窗台上，向着东方。' }
  ];

  var SIGNAL_MILITARY = {
    turn: 5, label: '军用电台切入了频率',
    text: '军用电台强行切入了频率：「全市进入宵禁，请居民留在家中……请勿收听未经许可的广播。」他们需要你转播。',
    options: [
      { id: 'relay', label: '转播宵禁令', result: '你转播了宵禁令。声音很公事公办。', mood: -3, hope: 0 },
      { id: 'ignore', label: '不转播', result: '你没有转播。城市继续听你的歌。', mood: 2, hope: 1 }
    ],
    auto: '军队自己接管了三分钟。你听着，没有作声。', autoMood: -2
  };

  var SIGNAL_X = {
    turn: 10, label: 'FREQUENCY X · 天文台的倒数',
    text: '那个频率又响了——这一次，它在你耳边倒数：7、6、5……你意识到它是一串坐标，指向城北天文台。',
    options: [
      { id: 'decode', label: '抄下坐标并回应', result: '你抄下了坐标。如果世界还有救，它一定藏在那个数字里。', hope: 4, mood: 2 },
      { id: 'ignore', label: '关掉那个频率', result: '你关掉了那个频率。有些信号，接住了就是责任。', hope: 0, mood: -1 }
    ],
    locked: '你听不懂那个频率。也许刚才应该接温教授的电话。'
  };

  var FINAL_OPTIONS = [
    { id: 'hope', label: '说一个关于明天的谎', hint: '告诉他们：天会亮，一切会好起来。' },
    { id: 'truth', label: '说出全部真相', hint: '告诉他们：我不知道未来，但你们有权知道现在。' },
    { id: 'companion', label: '陪他们到最后', hint: '不承诺明天，只承诺：我在，一直都在。' },
    { id: 'silence', label: '沉默', hint: '放下麦克风，什么都不说。' }
  ];

  var ENDINGS = {
    dawn: {
      id: 'dawn',
      title: '结局一 · 黎明歌谣',
      epithet: '歌谣传世',
      epilogue: '你放完最后一首摇篮曲。城市的灯一盏接一盏亮起——不是电力，是窗口里举着的手机屏幕，跟着你的旋律轻轻晃动。天没有亮，但城市不再害怕。很多年后，有人教孩子唱一首没有词的歌，说那是「天亮之前的声音」。',
      conditions: '播放过摇篮曲 · 城市希望保持在 50 以上 · 最终选择「希望」'
    },
    signal: {
      id: 'signal',
      title: '结局二 · 信号',
      epithet: '真相抵达',
      epilogue: '你的电波穿过封锁，抵达了城北天文台。三天后，那个倒数停止了。没有人知道为什么——只有你记得，你曾在最后一夜，把一座城市的坐标，交给了天空。',
      conditions: '接听温教授的电话 · 解码 FREQUENCY X · 最终选择「真相」'
    },
    fire: {
      id: 'fire',
      title: '结局三 · 火光',
      epithet: '陪伴到最后一刻',
      epilogue: '你念完最后一个名字，点了一首老歌。有人在天台上举起了火把，一个、两个、三个……整座城市亮起无数簇小小的光。你们用另一种方式，守住了这一夜。',
      conditions: '接听老周或老兵的电话 · 最终选择「陪伴」'
    },
    dust: {
      id: 'dust',
      title: '结局四 · 尘埃',
      epithet: '沉默的黎明',
      epilogue: '你没有再说话。城市在你的沉默里安静下来，像一片落定的尘埃。天亮了——或者说，某种更亮的东西来了。没有人责怪你。你只是陪着他们，走完了最后一夜。',
      conditions: '最终选择「沉默」，或城市的希望跌到 20 以下'
    },
    beacon: {
      id: 'beacon',
      title: '结局五 · 不灭的电波',
      epithet: '这座城市记住了你的频率',
      epilogue: '天亮之后，人们拆掉了隔离栏。电台的灯亮了一百天。后来城市重建，新的广播大楼上刻着一行字：「FM 95.5——那晚我们谁也没有关掉它。」',
      conditions: '从未沉默 · 城市希望保持在 75 以上 · 最终选择「希望」'
    },
    afterglow: {
      id: 'afterglow',
      title: '结局六 · 黎明之后',
      epithet: '真相与歌谣',
      epilogue: '你说了真话，也放了那首歌。人们一边流泪一边哼着旋律走进新的一天。很多年后，历史书里记载着那晚的两样东西：一个坐标，和一首摇篮曲。',
      conditions: '解码 FREQUENCY X · 播放过摇篮曲 · 最终选择「真相」'
    },
    memorial: {
      id: 'memorial',
      title: '结局七 · 纪念日',
      epithet: '电台被写进了历史',
      epilogue: '你放完最后一首歌——《纪念日》。城市在歌声里安静了很久。多年以后，广播史教材的第一页写着：FM 95.5，那晚的电波从未熄灭。',
      conditions: '隐藏结局 · 已收集全部基础结局 · 终局未选择沉默'
    },
    nightingale: {
      id: 'nightingale',
      title: '结局八 · 夜莺',
      epithet: '孩子们把太阳叫了出来',
      epilogue: '你放了摇篮曲，接起了小雨和双胞胎的电话。第二天清晨，第一道阳光落在广播塔上——孩子们说，是昨晚的歌把它叫出来的。',
      conditions: '最终选择「陪伴」· 播放过摇篮曲 · 接听小雨与双胞胎'
    },
    lighthouse: {
      id: 'lighthouse',
      title: '结局九 · 灯塔',
      epithet: '坐标被接住了',
      epilogue: '你把天文台的坐标留在了电波里，然后静静等到黎明。天亮时，天文台的灯重新亮起——有人顺着你的电波，找到了它。',
      conditions: '最终选择「希望」· 解码 FREQUENCY X · 未播放摇篮曲'
    }
  };

  function charFate(state, char) {
    var f = state.flags;
    var st = state.chars[char.id] || { hope: 50 };
    char = { id: char.id, hope: st.hope };
    switch (char.id) {
      case 'susan': return char.hope >= 55 ? '苏珊把咖啡馆的灯开到天亮，门口挂着「免费热茶」。' : '苏珊锁了门。灯没有亮。';
      case 'twins': return f.lullaby ? '双胞胎在摇篮曲里睡着了，小熊收音机还抱在怀里。' : '小杰小安一夜没睡，数着窗外的光。';
      case 'xiaoyu': return f.lullaby ? '小雨在摇篮曲里睡着了，梦里有一艘不会沉的船。' : '小雨没有再哭。她学会了在沉默里数星星。';
      case 'daye': return f.nostalgic ? '大爷听着《老磁带》，说这是他最后一次听见老伴的歌。' : '大爷一夜没说话，把收音机贴在耳边。';
      case 'doctor': return char.hope >= 45 ? '陈医生在天亮前救回了最后一个病人，然后靠在墙上睡着了。' : '陈医生一直站在急诊室窗前，没有坐下。';
      case 'lily': return f.signalDecoded ? '莉莉替你守住了备份日志。她说，这就是她出师的那一夜。' : '莉莉抱着备份盘坐在门口，一直等到天亮。';
      case 'lin': return f.truthCount >= 1 ? '林队长把消防车开上天台，让它的警灯照亮了半条街。' : '林队长最后只说了一句：「电台还在就行。」';
      case 'akai': return char.hope >= 45 ? '阿凯在车里听着电台，直到救援队敲响车窗。' : '阿凯把电台声音调大，闭上眼睛。';
      case 'professor': return f.signalDecoded ? '温教授在天文台等你。他说，你抄下的坐标救了他们。' : '温教授在天文台守了一夜，没有再打来。';
      case 'veteran': return f.veteranHonored ? '老兵在火把下敬了一个标准的军礼。' : '老兵把收音机放在窗台上，向着东方。';
      case 'laozhou': return f.laozhouHonored ? '老周在天台上守到天亮，说这是他最暖和的一个夜。' : '老周在岗位上睡着了，怀里还抱着收音机。';
    case 'ayun': return char.hope >= 55 ? '天蒙蒙亮时，阿芸的孩子出生了——第一声啼哭，是通过收音机传遍全城的。' : '阿芸抱着收音机，一整夜没有松手。';
    case 'xiaoyang': return f.signalDecoded || char.hope >= 50 ? '小杨把便利店的门开着，给路过的人递热水，说这是电台教的。' : '小杨关了店门，躲在收银台后面。';
    case 'apopo': return f.nostalgic ? '阿婆说，她外婆那台收音机的声音，和她听到的最后一晚一模一样。' : '阿婆把收音机调到了 FM 95.5，一夜没换台。';
    case 'luolaoshi': return char.hope >= 50 ? '罗老师在窗边弹了一整夜钢琴，为全楼的人伴奏。' : '罗老师合上了琴盖，坐在黑暗里。';
    }
    return char.name + '：' + (char.hope >= 50 ? '还好。' : '不知去向。');
  }

  function charById(id) {
    for (var i = 0; i < CHARACTERS.length; i++) if (CHARACTERS[i].id === id) return CHARACTERS[i];
    return null;
  }

  return {
    TURNS: TURNS, CHARACTERS: CHARACTERS, SONGS: SONGS, NEWS: NEWS, CALLS: CALLS,
    SIGNAL_MILITARY: SIGNAL_MILITARY, SIGNAL_X: SIGNAL_X,
    CITY_OBSERVATIONS: CITY_OBSERVATIONS,
    TURN_INTERLUDES: TURN_INTERLUDES,
    ARCS: ARCS, WORLD_NOTES: WORLD_NOTES,
    FINAL_OPTIONS: FINAL_OPTIONS, ENDINGS: ENDINGS,
    charFate: charFate, charById: charById
  };
});
