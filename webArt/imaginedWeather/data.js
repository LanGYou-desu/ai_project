/* =========================================================
   臆候局 / shared weather vocabularies
   ========================================================= */

(function () {
  "use strict";

  const FAMILIES = {
    fog: {
      label: "低云",
      conditions: ["低云 · 暖雾", "低云 · 悬浮", "静雾 · 微光", "平流雾 · 旧梦"],
      names: [
        { a: "琥珀色", b: "低云", en: "AMBER STRATUS" },
        { a: "借来的", b: "晨雾", en: "BORROWED MIST" },
        { a: "静音的", b: "积云", en: "MUTED CUMULUS" },
        { a: "棉絮质", b: "低雾", en: "COTTON MIST" },
        { a: "缓慢的", b: "云层", en: "SLOW CLOUD" },
        { a: "室内", b: "雾", en: "INDOOR FOG" },
        { a: "尚未", b: "散去", en: "NOT YET DISPERSED" }
      ],
      descriptions: [
        "一阵低低地悬在窗沿上方一米处的暖雾。它不带来雨，只让所有声音变软，像一层被太阳晒暖的旧绒布。预计在有人想起你时缓慢散开。",
        "能见度会随回忆浓度下降。进入其中的人听见自己的脚步，像在另一个人的房间里走动。请勿大声说话，雾里还有一些尚未睡着的事。",
        "这是一团被误认为天气的停顿。它停留在两个决定之间，内部温度恒定，适合存放没有说出口的话。预计在有人替你做决定时散去。",
        "低云于午后三点生成，边缘带有少量金色。它不遮挡道路，只遮挡目的地。所有赶路的人都被允许在此刻慢一点。"
      ],
      sensations: [
        "像一条晒过太阳的旧毛毯",
        "像把手伸进一件还没穿过的毛衣",
        "像醒来时，还未想起自己是谁",
        "像有人隔着门，替你留了一盏灯",
        "像被一句很轻的话抱住"
      ],
      durations: ["至有人先开口", "约 47 分钟", "至下一次日落", "直至你把窗打开"],
      palettes: [
        { bg: "#121d1a", deep: "#09110f", glow: "#f0c777", soft: "#718c7f", haze: "#ba9b6d", rim: "#f4e2b7", orb: "#f8dc9a" },
        { bg: "#141e1c", deep: "#090f0e", glow: "#d8d1ac", soft: "#5f7c76", haze: "#9ea88d", rim: "#ede8d1", orb: "#e9dfbe" }
      ],
      readings: { temp: [10, 22], humidity: [82, 108], pressure: [1002, 1024], visibility: [0.2, 1.7] },
      audio: { root: 98, chord: [1, 1.4983, 2], noiseType: "lowpass", cutoff: 360, noiseGain: 0.016, padGain: 0.025 }
    },

    rain: {
      label: "阵雨",
      conditions: ["阵雨 · 记忆返潮", "细雨 · 玻璃质", "过云雨 · 盐分", "降水 · 室内"],
      names: [
        { a: "未寄出的", b: "阵雨", en: "UNSENT SHOWER" },
        { a: "玻璃质", b: "细雨", en: "GLASS DRIZZLE" },
        { a: "倒着下的", b: "雨", en: "INVERSE RAIN" },
        { a: "温热的", b: "过云雨", en: "WARM CLOUDBURST" },
        { a: "凌晨三点", b: "的雨", en: "3 A.M. RAIN" },
        { a: "盐味", b: "雨", en: "SALT RAIN" }
      ],
      descriptions: [
        "雨滴落在皮肤上没有重量，只留下短暂的亮斑。局部地区出现记忆返潮，请妥善收好未完成的对话。",
        "云层很低，雨很慢。每一滴都映出一扇你没有推开的门，落至地面时轻轻合上。",
        "降水从昨天开始，向明天结束。测得雨声中含有少量盐分，怀疑它途经一片没有名字的海。",
        "一种只落在屋檐以内的雨。街道保持干燥，只有你站立的地方，正在下一场很轻的雨。"
      ],
      sensations: [
        "像一句删掉又撤回的晚安",
        "像手指碰到冰镇玻璃杯的一瞬",
        "像走进一场没带伞的旧电影",
        "像所有声音都被洗过一遍",
        "像有人替天空哭了一会儿"
      ],
      durations: ["至雨声停下来", "约 12 分钟", "从昨天起，向明天结束", "至你决定不躲"],
      palettes: [
        { bg: "#0b1a20", deep: "#061014", glow: "#b9dadb", soft: "#4d727d", haze: "#88a99f", rim: "#e8eadc", orb: "#d7ebe6" },
        { bg: "#111c1f", deep: "#070f12", glow: "#d8c9a8", soft: "#5a7876", haze: "#9a9577", rim: "#efe6d1", orb: "#e8dcc3" }
      ],
      readings: { temp: [8, 19], humidity: [88, 114], pressure: [994, 1018], visibility: [0.3, 4.2] },
      audio: { root: 110, chord: [1, 1.3348, 1.995], noiseType: "highpass", cutoff: 1700, noiseGain: 0.023, padGain: 0.014 }
    },

    snow: {
      label: "静雪",
      conditions: ["静雪 · 无声", "积雪 · 纸屑质", "雪线 · 逆光", "降雪 · 室内"],
      names: [
        { a: "旧照片", b: "落雪", en: "SNOW ON OLD PHOTOGRAPHS" },
        { a: "无声", b: "积雪", en: "SOUNDLESS SNOW" },
        { a: "纸屑", b: "雪", en: "PAPER SNOW" },
        { a: "六月", b: "雪", en: "JUNE SNOW" },
        { a: "逆光", b: "雪线", en: "BACKLIT SNOWLINE" },
        { a: "细细的", b: "白", en: "A THIN WHITE" }
      ],
      descriptions: [
        "雪花从一张旧照片的背面开始落，覆盖所有未被叫出的名字。积雪将停在你第一次感到安心的地方。",
        "气温并不低，但雪落得很认真。它把街灯、脚步声和一次未完成的告别，轻轻收进同一种白里。",
        "本局确认：每片雪花的中心都有一粒微小的光。请勿收集，它会在掌心记起自己曾是雨。",
        "一场发生在室内的雪。桌面、书脊和杯沿都积了薄薄一层，唯独你坐过的地方仍然温暖。"
      ],
      sensations: [
        "像把耳朵贴近一只空海螺",
        "像在棉被里听见远处的车声",
        "像一句话说到一半，突然不必说完",
        "像世界被调成了静音",
        "像有人在你身后轻轻关上门"
      ],
      durations: ["至雪停", "约 3 小时 14 分", "至积雪没过脚踝", "直至春天迟到"],
      palettes: [
        { bg: "#182126", deep: "#0a1114", glow: "#f5eadd", soft: "#8b9ba2", haze: "#c8ced0", rim: "#fbf6ea", orb: "#fbf4e8" },
        { bg: "#1b1d24", deep: "#0d0e13", glow: "#e9d8e1", soft: "#7e7d90", haze: "#b8aab3", rim: "#f7edf1", orb: "#f7e9ee" }
      ],
      readings: { temp: [-6.5, 2.2], humidity: [55, 89], pressure: [1008, 1032], visibility: [0.4, 3.6] },
      audio: { root: 130.81, chord: [1, 1.5, 2.245], noiseType: "lowpass", cutoff: 900, noiseGain: 0.007, padGain: 0.022 }
    },

    storm: {
      label: "雷暴",
      conditions: ["雷暴 · 低气压", "闪电 · 第三幕", "雷声 · 室内", "风暴 · 铜绿"],
      names: [
        { a: "第三幕", b: "雷暴", en: "ACT III THUNDERSTORM" },
        { a: "铜绿", b: "风暴", en: "VERDIGRIS STORM" },
        { a: "室内", b: "雷声", en: "INDOOR THUNDER" },
        { a: "迟来的", b: "闪电", en: "LATE LIGHTNING" },
        { a: "低气压", b: "蓝调", en: "LOW-PRESSURE BLUES" },
        { a: "未接来电", b: "雷雨", en: "MISSED-CALL STORM" }
      ],
      descriptions: [
        "雷声晚于闪电十一秒抵达，像一个终于组织好语言的人。气压正在下降，所有逞强暂时失效。",
        "一场只在胸腔内部发生的雷暴。窗外天气未受影响。预计午夜后转晴，留下少量无法解释的疲惫。",
        "闪电把房间照成一张底片。那些尚未解决的事短暂显影，随后又回到黑暗里。",
        "风暴沿着一根电话线缓慢移动，所到之处信号微弱。建议取消所有不必要的解释，等待云层自己开口。"
      ],
      sensations: [
        "像在人群里突然听见自己的名字",
        "像一场不必解释的迟到",
        "像手机屏幕熄灭前最后一点光",
        "像心脏先于天气，响了一声",
        "像所有未完成的句子挤在一起"
      ],
      durations: ["至雷声走远", "约 26 分钟", "至气压回升", "直至你允许自己休息"],
      palettes: [
        { bg: "#151b17", deep: "#080c09", glow: "#e7a454", soft: "#586360", haze: "#a98255", rim: "#f6d5a4", orb: "#d69a4e" },
        { bg: "#171714", deep: "#090908", glow: "#e36f4d", soft: "#6b6357", haze: "#b08560", rim: "#f4c09e", orb: "#d77b4f" }
      ],
      readings: { temp: [17, 28], humidity: [62, 98], pressure: [978, 1004], visibility: [0.8, 7.2] },
      audio: { root: 82.41, chord: [1, 1.1892, 1.4983], noiseType: "lowpass", cutoff: 280, noiseGain: 0.03, padGain: 0.018 }
    },

    glow: {
      label: "光晕",
      conditions: ["光晕 · 低瓦数", "逆光 · 虹", "霞光 · 可食用", "极光 · 室内"],
      names: [
        { a: "倒置的", b: "虹", en: "INVERTED RAINBOW" },
        { a: "低瓦数", b: "极光", en: "LOW-WATTAGE AURORA" },
        { a: "黄昏", b: "光晕", en: "DUSK HALO" },
        { a: "可食用的", b: "霞", en: "EDIBLE AFTERGLOW" },
        { a: "二次", b: "日出", en: "SECOND SUNRISE" },
        { a: "室内", b: "绿光", en: "INDOOR AURORA" }
      ],
      descriptions: [
        "光源不明，色温接近傍晚六点。它不照亮道路，只照亮那些你原本已经习惯的东西。",
        "低空出现倒置虹，颜色顺序与记忆一致。请勿直视过久，否则会想起一个不该在此刻想起的人。",
        "一种可以食用的小片黄昏。入口微苦，回甘持续约一整个冬天。",
        "光从一面不存在的窗照进来，落在桌面上，恰好是你多年以前坐过的位置。"
      ],
      sensations: [
        "像刚洗完手，摸到一小片阳光",
        "像咬到一颗没有熟透的夏天",
        "像在很远的城市，有人替你开了灯",
        "像收到一封写着“没关系”的信",
        "像世界短暂地原谅了你"
      ],
      durations: ["至光自行熄灭", "约 18 分钟", "至下一次日落", "短于一次眨眼"],
      palettes: [
        { bg: "#11241d", deep: "#08140f", glow: "#f3d16b", soft: "#4f7864", haze: "#d58b58", rim: "#ffefb2", orb: "#f7d96f" },
        { bg: "#1b2320", deep: "#0b110f", glow: "#efad83", soft: "#58766b", haze: "#c9895f", rim: "#ffe0c4", orb: "#f5b58b" }
      ],
      readings: { temp: [18, 31], humidity: [18, 54], pressure: [1010, 1034], visibility: [12, 64] },
      audio: { root: 146.83, chord: [1, 1.2599, 1.4983, 2], noiseType: "lowpass", cutoff: 780, noiseGain: 0.006, padGain: 0.024 }
    },

    wind: {
      label: "风",
      conditions: ["风 · 无主之地", "气流 · 低飞", "季风 · 绕路", "东风 · 偏执"],
      names: [
        { a: "无主之地", b: "来风", en: "WIND FROM NOWHERE" },
        { a: "拆信的", b: "风", en: "LETTER-OPENING WIND" },
        { a: "低飞", b: "气流", en: "LOW-FLYING AIR" },
        { a: "偏执的", b: "东风", en: "OBLIQUE EASTERLY" },
        { a: "无人", b: "之风", en: "NOBODY'S WIND" },
        { a: "绕路", b: "季风", en: "DETOUR MONSOON" }
      ],
      descriptions: [
        "风把今天的句子拆成偏旁，吹向没有地址的地方。请留意突然出现的、不属于你的乡愁。",
        "一场绕路的季风，途经三座没有名字的城。它不带来天气，只带来某种想出发的错觉。",
        "空气很轻，像有人替你把一扇窗提前打开。所有停住的事开始缓慢移动。",
        "风速约等于一次深呼吸。风里有纸、草籽和一句没说完的“以后”，请伸手接住其中任意一样。"
      ],
      sensations: [
        "像一场不必解释的迟到",
        "像把一件大衣从衣柜里拿出来",
        "像火车启动前，身体轻轻一晃",
        "像有人从背后推了你一把，又立刻松开",
        "像某个名字在舌尖上打了个旋"
      ],
      durations: ["至风改变主意", "约 9 分钟", "至你走出去", "从远方来，往更远处去"],
      palettes: [
        { bg: "#15211d", deep: "#0a110e", glow: "#e2cda2", soft: "#738b7e", haze: "#a9b5a1", rim: "#f5e8ca", orb: "#f0ddae" },
        { bg: "#18201d", deep: "#0b100e", glow: "#d7c296", soft: "#6d8276", haze: "#9b927b", rim: "#f0e4c8", orb: "#e8d3aa" }
      ],
      readings: { temp: [10, 23], humidity: [22, 66], pressure: [1000, 1025], visibility: [8, 42] },
      audio: { root: 98, chord: [1, 1.3348, 1.5874], noiseType: "bandpass", cutoff: 520, noiseGain: 0.02, padGain: 0.012 }
    },

    ash: {
      label: "降灰",
      conditions: ["降灰 · 余温", "火雨 · 熄灭", "余火 · 纸后", "降灰 · 冷却中"],
      names: [
        { a: "余温", b: "降灰", en: "WARM ASH" },
        { a: "熄灭的", b: "火雨", en: "EXTINGUISHED FIRE RAIN" },
        { a: "灰烬色", b: "黄昏", en: "ASHEN DUSK" },
        { a: "慢速", b: "燃烧", en: "SLOW COMBUSTION" },
        { a: "纸后", b: "余火", en: "AFTERPAPER EMBERS" },
        { a: "冷却中的", b: "夏", en: "COOLING SUMMER" }
      ],
      descriptions: [
        "一场温度恰好的降灰。它覆盖烧尽的部分，又保留最后一点红色，像一种没有结束的结束。",
        "本局记录到余烬型降水。灰烬落地后仍带体温，小心烫伤，但不会留下痕迹。",
        "从一封未烧完的信上升起的天气。风向朝上，所有字句重新获得了重量。",
        "灰烬以雪的速度落下，触碰到地面时变成一句很短的话。没有人听清它说了什么。"
      ],
      sensations: [
        "像一场没有告别的结束",
        "像手心里一枚慢慢冷掉的硬币",
        "像烧到尽头的蜡烛，突然亮了一下",
        "像火熄灭后，空气里持续很久的暖",
        "像把最后一页轻轻翻过去"
      ],
      durations: ["至最后一点火星熄灭", "约 3 小时", "至灰烬完全冷却", "直至下一次点燃"],
      palettes: [
        { bg: "#191512", deep: "#0a0807", glow: "#e58655", soft: "#654d41", haze: "#9e5d3f", rim: "#f2c3a1", orb: "#d56e44" },
        { bg: "#1b1913", deep: "#0b0a08", glow: "#e4b366", soft: "#6a5d48", haze: "#9f7449", rim: "#f7d8a9", orb: "#dba052" }
      ],
      readings: { temp: [24, 41], humidity: [7, 35], pressure: [986, 1012], visibility: [1.2, 9.5] },
      audio: { root: 73.42, chord: [1, 1.1892, 1.7818], noiseType: "lowpass", cutoff: 300, noiseGain: 0.018, padGain: 0.02 }
    }
  };

  const RANDOM_FEELINGS = [
    "凌晨三点的便利店",
    "没说出口的再见",
    "雨停之后",
    "所有的灯都关了",
    "第一次独自回家",
    "一封没有寄出的信",
    "在陌生城市醒来",
    "某年夏天的最后一晚",
    "一杯放凉的茶",
    "春天迟迟不来",
    "无人接听的电话",
    "站在月台上等车"
  ];

  const INFERENCE = [
    { family: "rain", words: ["雨", "淋湿", "潮湿", "眼泪", "哭", "想念", "思念", "回忆", "旧", "错过", "离开", "再见", "车站", "站台", "信"] },
    { family: "snow", words: ["雪", "白", "安静", "平静", "冬", "冷", "睡", "静音", "深夜", "缓慢", "空"] },
    { family: "storm", words: ["雷", "暴", "闪", "焦虑", "压力", "紧张", "烦", "怒", "怕", "害怕", "不安", "乱", "失控", "崩溃"] },
    { family: "glow", words: ["光", "晴", "虹", "霞", "阳", "亮", "开心", "快乐", "幸福", "喜欢", "爱", "希望", "暖", "灯", "夏", "便利店"] },
    { family: "wind", words: ["风", "飞", "旅", "远", "出发", "自由", "轻", "车窗", "路"] },
    { family: "ash", words: ["灰", "烬", "燃", "火", "烧", "结束", "失去", "熄灭", "放下", "告别", "冷却", "余"] },
    { family: "fog", words: ["雾", "云", "霾", "模糊", "孤独", "一个人", "独自", "寂寞", "忘记", "犹豫", "梦", "黄昏"] }
  ];

  window.YHJ_DATA = { FAMILIES, RANDOM_FEELINGS, INFERENCE };
})();
