/* ECO-ARK · 生态学知识图鉴（浏览器 + Node 双端 UMD） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.knowledge = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var CONCEPTS = [
    { id: 'producer', title: '生产者：一切能量的起点', icon: '🌱', unlock: 1,
      text: '植物通过光合作用把阳光转化为化学能，是生态系统中唯一的「造物者」。没有生产者，整个食物网都会倒塌。',
      howToSee: '本模拟中，植物覆盖(🌾🌿🌳)是能量的根基——先种植物，再放动物，顺序永远不能颠倒。' },
    { id: 'consumer', title: '消费者：能量的搬运工', icon: '🐇', unlock: 2,
      text: '食草动物（一级消费者）把植物能量转化为动物生物量，捕食者（二级及以上消费者）再层层搬运。每一层都消耗约 90% 的能量。',
      howToSee: '观察能量曲线：植物生物量总是远大于动物生物量，这就是「能量金字塔」。' },
    { id: 'energy-pyramid', title: '能量金字塔与 10% 定律', icon: '🔺', unlock: 1,
      text: '能量每经过一个营养级，大约只有 10% 被保留下来，其余 90% 在呼吸、运动和热量中散失。所以金字塔顶端的捕食者数量必然稀少。',
      howToSee: '对比昆虫(上千只)、野兔(上百只)与灰狼(几十只)的数量——越往上越稀少。' },
    { id: 'trophic', title: '营养级：食物网的分层结构', icon: '🕸️', unlock: 3,
      text: '生产者→一级消费者→二级消费者构成了营养级。完整的食物网通常有 3~5 层，每一层都是上一层的「制动器」。',
      howToSee: '第三章的目标就是建立植物+食草+捕食三层结构，观察它们如何互相制约。' },
    { id: 'lotka', title: '洛特卡-沃尔泰拉方程', icon: '📈', unlock: 3,
      text: '捕食者与猎物的数量会形成经典的「此消彼长」循环：猎物多了→捕食者吃饱繁殖→猎物被吃光减少→捕食者饿死减少→猎物恢复……周而复始。',
      howToSee: '看右侧曲线图：狼群的峰值总是滞后于鹿群的峰值，形成错峰振荡。' },
    { id: 'niche', title: '生态位：每个物种的「职业」', icon: '🧩', unlock: 5,
      text: '生态位是物种在生态系统中扮演的角色——吃什么、住在哪、何时活动。两个物种若生态位完全重叠，必然发生竞争，较弱的一方会被排挤灭绝。',
      howToSee: '野兔与田鼠都吃草，但田鼠啃根、野兔啃叶，错开生态位才能共存。' },
    { id: 'strategy', title: 'K 对策与 r 对策', icon: '⚖️', unlock: 4,
      text: 'r 对策物种（昆虫、野兔）繁殖快、寿命短，靠数量取胜；K 对策物种（猛犸、鹿）繁殖慢、寿命长，靠质量取胜。灾难来临时，r 对策物种恢复更快。',
      howToSee: '冰期过后，昆虫与田鼠总是先回来，而猛犸要很久才恢复——r 对策的韧性。' },
    { id: 'cascade', title: '营养级联：顶层的蝴蝶效应', icon: '🦅', unlock: 3,
      text: '顶级掠食者的存在会自上而下影响整个生态系统。著名的黄石公园案例：狼的回归让鹿不再啃光河岸植被，河狸与鱼类随之复苏。',
      howToSee: '第三章加入灰狼后，食草动物峰值回落，植被覆盖率反而上升——这就是级联。' },
    { id: 'biodiversity', title: '生物多样性：生态的保险单', icon: '🌈', unlock: 6,
      text: '物种越多样，生态系统面对灾害的缓冲能力越强。单一物种的农田最脆弱——一场瘟疫就能毁掉全部收成。',
      howToSee: '第六章的评分直接考核多样性：8 个以上物种共存的方舟才能称得上「稳健」。' },
    { id: 'resilience', title: '生态韧性：被击倒后站起来', icon: '🛡️', unlock: 4,
      text: '韧性是生态系统承受扰动后恢复原状的能力。冗余的食物网、多样的物种、充足的种子库，都是韧性的来源。',
      howToSee: '冰期章节：提前储备耐寒物种，冰期结束后生态系统才能快速恢复。' },
    { id: 'carrying', title: '承载量：环境的无形上限', icon: '🏔️', unlock: 6,
      text: '一片土地的资源是有限的，每个物种都有其承载量。超过承载量，种群就会因饥饿、疾病而崩溃，回落到平衡点。',
      howToSee: '不放捕食者时，野兔种群会冲高回落——那就是草原承载量的力量。' },
    { id: 'nutrient', title: '养分循环：分解者的谢幕', icon: '♻️', unlock: 6,
      text: '尸体与落叶不会消失——真菌和细菌把它们分解成养分，送回土壤，供新一代植物使用。分解者是生态循环的最后一环，也是最容易被忽略的一环。',
      howToSee: '动物大量死亡后，土壤养分短暂上升，植物反而迎来一轮爆发——分解者的功劳。' },
    { id: 'invasive', title: '入侵物种：没有天敌的暴君', icon: '🪢', unlock: 5,
      text: '入侵物种进入没有天敌、没有竞争者约束的新环境时，会以指数速度扩张，挤占本土物种的生态位，造成生物多样性骤降。',
      howToSee: '第五章的外来藤蔓没有动物吃它，只能靠你的「除草」工具和食草动物的胃来对抗。' }
  ];

  var BY_ID = {};
  CONCEPTS.forEach(function (c) { BY_ID[c.id] = c; });

  function unlocked(chapter) {
    return CONCEPTS.filter(function (c) { return c.unlock <= chapter; });
  }

  return { CONCEPTS: CONCEPTS, byId: function (id) { return BY_ID[id]; }, unlocked: unlocked };
});
