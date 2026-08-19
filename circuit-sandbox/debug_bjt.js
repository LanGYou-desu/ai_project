const { CT, Circuit } = require('./public/js/circuit.js');
const { step, settle, DT } = require('./public/js/engine.js');
const c = new Circuit();
c.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
c.addComponent(CT.RESISTOR, { r: 100000 }, [1, 2]);
const bjtc = c.addComponent(CT.BJT_N, {}, [3, 0, 2]);
c.addComponent(CT.RESISTOR, { r: 1000 }, [3, 1]);
const r = settle(c);
console.log('Vb=', r.voltages.get(2), 'Vc=', r.voltages.get(3), 'Ic=', r.currents.get(bjtc));
console.log('Vbe=', r.voltages.get(2) - r.voltages.get(0), 'Vbc=', r.voltages.get(2) - r.voltages.get(3));

// 单步从零初值
const c2 = new Circuit();
c2.addComponent(CT.VOLTAGE, { v: 5 }, [0, 1]);
c2.addComponent(CT.RESISTOR, { r: 100000 }, [1, 2]);
c2.addComponent(CT.BJT_N, {}, [3, 0, 2]);
c2.addComponent(CT.RESISTOR, { r: 1000 }, [3, 1]);
const r2 = step(c2, 0, DT);
console.log('单步: Vb=', r2.voltages.get(2), 'Vc=', r2.voltages.get(3), 'ok=', r2.ok);