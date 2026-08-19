'use strict';
// 电路沙盒 · 关卡系统
// 9 个关卡，从易到难。每关给出目标电路描述与通过条件 check(circ, result)。
// result = { voltages: Map, currents: Map }。

const { CT, GATE_TYPES, Circuit } = require('./circuit.js');
const { step, settle } = require('./engine.js');

// 关卡定义
const LEVELS = [
  {
    id: 1, name: '点亮第一盏灯',
    desc: '把电压源的正极连到电阻，电阻另一端接地。让节点电压达到 5V。',
    palette: ['voltage', 'resistor'],
    target: 'V(节点) = 5V',
    build(circ) {
      // 预置：电压源 [0,1]，电阻 [1,2]
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
      circ.addComponent(CT.RESISTOR, { r: 100 }, [1, 2]);
    },
    check(r) {
      // 存在 5V 节点（非 GND）
      for (const [n, v] of r.voltages) if (n !== 0 && Math.abs(v - 5) < 0.5) return true;
      return false;
    }
  },
  {
    id: 2, name: '分压器',
    desc: '用两个电阻把 10V 分成 5V。Vout = Vin * R2 / (R1 + R2)。',
    palette: ['voltage', 'resistor'],
    target: 'Vout = 5V (Vin=10V)',
    build(circ) {
      circ.addComponent(CT.VOLTAGE, { v: 10 }, [0, 1]);
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [1, 2]);
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
    },
    check(r) {
      const v = r.voltages.get(2) || 0;
      return Math.abs(v - 5) < 0.2;
    }
  },
  {
    id: 3, name: '二极管整流',
    desc: '让二极管正向导通：阳极接高电位，阴极经电阻接地。',
    palette: ['voltage', 'resistor', 'diode'],
    target: '二极管导通电流 > 1mA',
    build(circ) {
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
      circ.addComponent(CT.DIODE, {}, [1, 2]);
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [2, 0]);
    },
    check(r) {
      // 二极管正向导通：阴极电压明显低于 5V 源电压，且高于地
      const v = r.voltages.get(2) || 0;
      return v > 0.5 && v < 4.9;
    }
  },
  {
    id: 4, name: 'RC 充电',
    desc: '电阻 + 电容：电容电压随时间上升。settled 后应接近源电压。',
    palette: ['voltage', 'resistor', 'capacitor'],
    target: 'Vc(稳态) > 4V',
    build(circ) {
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
      circ.addComponent(CT.RESISTOR, { r: 100 }, [1, 2]);   // tau = 0.1s，settle 可充满
      circ.addComponent(CT.CAPACITOR, { c: 1e-3 }, [2, 0]);
    },
    check(r) {
      const v = r.voltages.get(2) || 0;
      return v > 4.0;
    }
  },
  {
    id: 5, name: '二极管 OR 门',
    desc: '两个二极管 + 下拉电阻构成或门：任一输入 5V → 输出 ~4.3V。',
    palette: ['voltage', 'resistor', 'diode'],
    target: '任一输入=5V → OUT≈4.3V',
    build(circ) {
      // 输出节点 4，下拉电阻到地；二极管阳极接输入，阴极接输出
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [4, 0]);     // 下拉
      circ.addComponent(CT.DIODE, {}, [2, 4]);                 // 输入1 → 输出
      circ.addComponent(CT.DIODE, {}, [3, 4]);                 // 输入2 → 输出
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 2]);         // 输入1 = 5V
      circ.addComponent(CT.VOLTAGE, { v: 0 }, [0, 3]);         // 输入2 = 0V
    },
    check(r) {
      const v = r.voltages.get(4) || 0;
      return v > 4; // 输入1 为 5V，输出应被抬升
    }
  },
  {
    id: 6, name: '二极管 AND 门',
    desc: '两个二极管 + 上拉电阻构成与门。两个输入都 5V → 输出 5V。',
    palette: ['voltage', 'resistor', 'diode'],
    target: 'IN1=5V,IN2=5V → OUT≈5V',
    build(circ) {
      // 输出节点 4，上拉到 5V(节点1)
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [1, 4]);
      circ.addComponent(CT.DIODE, {}, [4, 2]); // 阳极4 阴极2 (输入1)
      circ.addComponent(CT.DIODE, {}, [4, 3]); // 阳极4 阴极3 (input2)
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 2]);
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 3]);
    },
    check(r) {
      const v = r.voltages.get(4) || 0;
      return v > 4;
    }
  },
  {
    id: 7, name: '三极管开关',
    desc: 'NPN 三极管做开关：基极输入 5V → 集电极负载有电流（LED 亮）。',
    palette: ['voltage', 'resistor', 'bjt_n'],
    target: 'Ic > 1mA',
    build(circ) {
      // Vcc(1)=5V, 基极通过电阻接 5V, 集电极负载电阻到 Vcc, 发射极接地
      circ.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
      circ.addComponent(CT.RESISTOR, { r: 10000 }, [1, 2]); // 基极
      circ.addComponent(CT.BJT_N, {}, [3, 0, 2]); // C=3, E=0, B=2
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [3, 1]); // 集电极负载
    },
    check(r) {
      // 通过电流判断：需要知道 bjtc 的 id。改为检查节点电压：Vc 应被拉低
      const vbe = r.voltages.get(2) || 0;
      const vc = r.voltages.get(3) || 0;
      return vbe > 0.4 && vc < 4; // 基极导通且集电极被拉低
    }
  },
  {
    id: 8, name: '同相放大器',
    desc: '运放同相放大：Vout = Vin * (1 + Rf/R1)。Vin=1V，Rf=R1 → Vout=2V。',
    palette: ['voltage', 'resistor', 'opamp'],
    target: 'Vout ≈ 2V (Vin=1V)',
    build(circ) {
      // 运放端子 [in-, in+, out]。同相：Vin 接 in+(节点3)，in-(节点4) 接反馈
      circ.addComponent(CT.VOLTAGE, { v: 1 }, [0, 3]); // Vin → in+
      circ.addComponent(CT.OPAMP, { gain: 1000, supply: 5 }, [4, 3, 5]); // in-=4, in+=3, out=5
      circ.addComponent(CT.RESISTOR, { r: 10000 }, [4, 0]); // R1: in- → GND
      circ.addComponent(CT.RESISTOR, { r: 10000 }, [5, 4]); // Rf: out → in-
    },
    check(r) {
      const vout = r.voltages.get(5) || 0;
      return Math.abs(vout - 2) < 0.3;
    }
  },
  {
    id: 9, name: 'RC 振荡器',
    desc: '反相器 + RC 反馈构成弛豫振荡器：用示波器观察方波。',
    palette: ['gate', 'resistor', 'capacitor'],
    target: '输出节点在 0~5V 间振荡',
    oscillates: 2, // 检测节点 2（门输出方波）
    build(circ) {
      // NOT 门：输入节点1，输出节点2。RC 反馈：输出→输入经电阻，输入→地经电容
      circ.addComponent(CT.GATE, { gate: GATE_TYPES.NOT }, [1, 2]);
      circ.addComponent(CT.RESISTOR, { r: 1000 }, [2, 1]);   // 输出 → 输入
      circ.addComponent(CT.CAPACITOR, { c: 1e-6 }, [1, 0]);   // 输入 → 地
    },
    check(r, osc) {
      if (!osc) return false;
      return osc.range > 2; // 输出节点在 0~5V 间摆动
    }
  }
]

// 关卡运行器：构建电路、仿真、判定
function runLevel(levelId) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return { ok: false, reason: '关卡不存在' };
  const circ = new Circuit();
  level.build(circ);
  const result = settle(circ);
  if (!result.ok) return { ok: false, reason: '仿真失败: ' + result.errors.join(','), voltages: result.voltages };

  // 振荡检测：再跑若干步，记录指定节点的电压摆幅
  let osc = null;
  if (level.oscillates) {
    const vals = [];
    for (let i = 0; i < 300; i++) {
      const rr = step(circ, (20000 + i) * 1e-5, 1e-5);
      if (!rr.ok) break;
      vals.push(rr.voltages.get(level.oscillates) || 0);
    }
    if (vals.length) {
      const min = Math.min.apply(null, vals);
      const max = Math.max.apply(null, vals);
      osc = { min, max, range: max - min };
    }
  }

  const passed = level.check(result, osc);
  return { ok: passed, reason: passed ? '通过' : '条件未满足', voltages: result.voltages, currents: result.currents, osc };
}

module.exports = { LEVELS, runLevel };
if (typeof window !== 'undefined') { window.LEVELS = LEVELS; window.runLevel = runLevel; }