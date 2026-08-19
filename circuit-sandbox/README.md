# 电路沙盒（Circuit Sandbox）

在浏览器里拖拽真实电路元件、连线、播放，看电流实时流过，用电压表/示波器测量，逐步解锁关卡学习电路知识。

- **零依赖**：原生 HTML/CSS/JS，离线可用。
- **真实仿真**：统一 MNA 瞬态求解器，支持直流 / 交流 / 电容电感瞬态 / 二极管三极管非线性 / 逻辑门。
- **9 关卡**：从点亮灯泡到 1 位加法器，每关有明确成功条件与知识卡。

## 运行

```
双击 start.bat
```

或手动：
```
cd circuit-sandbox
node server.js
```

浏览器将自动打开 http://127.0.0.1:8848

## 测试

```
node test/run.js
```

## 目录

```
public/js/
  circuit.js      网表数据模型
  engine.js       MNA 求解器（核心）
  render.js       示意图绘制 + 电流动画
  ui.js           拖拽 / 连线 / 参数面板
  instruments.js  示波器 + 万用表
  levels.js       9 关卡数据 + 成功判定
  app.js          应用编排
```

## 元件

电源（直流电压/电流、交流）、无源（电阻/电容/电感）、半导体（二极管/NPN/PNP）、逻辑门（NOT/AND/OR/NAND/NOR/XOR/XNOR）、信号（开关/理想运放）、参考地。