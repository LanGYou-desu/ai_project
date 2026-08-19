# 🏎️ 3D 跑车展厅 · Ferrari 458

一个基于 **Three.js** 的交互式 3D 车展应用。使用真实高精度的 **Ferrari 458 Italia** 模型（51 个可定制部件），配合 PBR 材质、摄影棚级环境反射、动态光影与行驶动画，打造沉浸式看车体验。

**完全离线可用**：模型、引擎、解码器全部打包在项目内，无需外网。

---

## ✨ 功能特性

- **真实车辆模型** — 51 个部件（车身、玻璃、轮毂、轮胎、刹车卡钳、碳纤维内饰、方向盘等）逐一精细定做材质
- **8 种车身涂装** — 一键换漆（罗索红 / 竞速黄 / 深海蓝 / 珍珠白 / 曜石黑 / 银灰 / 荧光绿 / 落日橙）
- **3 种轮毂配色** — 亮银 / 曜黑 / 金色
- **PBR 高品质材质** — 清漆车漆（clearcoat）、真玻璃折射（transmission）、镀铬、碳纤维、皮革、橡胶
- **摄影棚级光照** — 环境反射（PMREM）、软阴影、ACES 电影色调、渐变天空
- **🌙 夜景模式** — 大灯聚光、尾灯/氛围灯/路灯全亮、场景变暗
- **▶ 行驶模式** — 绕环形公路跑圈，车轮真实旋转、前轮转向、摄像机平滑跟拍
- **4 个快捷视角** — 前45° / 侧面 / 尾部 / 全景，平滑飞行切换
- **自动旋转** — 车展转台式浏览
- **加载进度** — 资源加载进度条与错误提示

---

## 🚀 快速开始

### 方式一：离线运行（推荐）

需要本机已安装 **[Node.js](https://nodejs.org)**（仅用于启动本地静态服务）。

双击项目里的 **`start.bat`**，浏览器会自动打开 `http://127.0.0.1:8080`，全程不需要联网。

> 如果用不了 `start.bat`，也可以手动在项目目录打开终端执行：
> ```bash
> node server.js
> ```
> 然后访问 `http://127.0.0.1:8080`。

### 方式二：直接打开（需联网）

联网状态下直接双击 **`index.html`**，页面会自动从 CDN 加载 three.js 与模型。

---

## 🖱️ 操作说明

| 操作 | 效果 |
|---|---|
| 左键拖拽 | 旋转视角 |
| 滚轮 | 缩放 |
| 右键拖拽 | 平移视角 |
| 🔄 自动旋转 | 开关镜头绕车旋转 |
| 🌙 夜景 | 开关夜景灯光 |
| ▶ 行驶 / 🛑 停车 | 启动 / 停止行驶 |
| 🎯 重置视角 | 回到全景视角 |
| 前45° / 侧面 / 尾部 / 全景 | 平滑切换到指定视角 |

---

## 📁 目录结构

```
3d-car/
├── index.html          # 入口页面（所有逻辑与界面）
├── server.js           # 本地静态文件服务器（零依赖）
├── start.bat           # 一键启动脚本
├── README.md
├── preview.png         # 效果预览图
├── ferrari.glb         # Ferrari 458 车辆模型（DRACO 压缩）
├── vendor/             # three.js 引擎与加载器（本地化）
│   ├── three.module.js
│   ├── OrbitControls.js / GLTFLoader.js / DRACOLoader.js / RoomEnvironment.js
│   └── draco/          # DRACO 解码器（wasm + js）
└── utils/
    └── BufferGeometryUtils.js
```

---

## 🛠️ 技术栈

- **Three.js r160**（WebGL 渲染，ACES 色调映射 + 软阴影）
- **GLTFLoader + DRACOLoader**（高性能网格压缩解码）
- **MeshPhysicalMaterial**（clearcoat 清漆 / transmission 透射玻璃）
- **PMREM + RoomEnvironment**（HDR 环境反射）
- 原生 **ES Modules**，零第三方运行时依赖

---

## ⚙️ 自定义

### 修改车身颜色

编辑 `index.html` 中 `main()` 一段顶部的 `PAINTS` 数组即可增删涂装选项：

```js
const PAINTS = [
  ['罗索红', '#d40000'], ['竞速黄', '#f7b400'], ...,
  ['你喜欢的名字', '#十六进制色值']
];
```

### 调整行驶参数

在 `updateDrive()` 中可修改：

```js
const DRIVE_R = 8.5;      // 行驶轨道半径
driveSpeed += (2.4 - driveSpeed) ...;  // 最高速度
steerTarget = 0.3 * ...;               // 前轮最大转向角
```

### 更换车辆模型

1. 将新的 `.glb` 文件放入项目目录；
2. 修改 `loadModel()` 中的 `GLB_LOCAL`（本地路径）或 `GLB_REMOTE`（CDN 回退地址）；
3. 如有需要，在 `setupCar()` 的 `SPECIAL` / `MATMAP` 中按部件名调整材质。

---

## 🖥️ 浏览器兼容

- 建议使用 **Chrome / Edge / Firefox（108+）** 等现代浏览器
- 需要支持 **WebGL2**（2017 年后的主流设备均支持）

---

## 📋 常见问题

**Q：页面一直是“正在加载”或提示加载失败？**
- 离线模式请确认是通过 `start.bat`（或 `node server.js`）访问 `http://127.0.0.1:8080`，而不是直接双击 `index.html`；
- 直接双击 `index.html` 时需要联网；
- 若端口被占用，`server.js` 会自动尝试 8081~8089。

**Q：提示“未检测到 Node.js”？**
- 安装 [Node.js](https://nodejs.org)（LTS 版本即可）后重新双击 `start.bat`；或者联网模式直接双击 `index.html`。

**Q：画面是全黑 / 空白？**
- 请确认浏览器开启了硬件加速（WebGL 依赖 GPU/软件渲染）。
- 可刷新页面重试；仍不行则更换浏览器。

**Q：隐私 / 数据采集？**
- 本项目纯本地运行，不上传任何数据，不依赖外部 API（联网模式仅从 CDN 拉取 three.js 与模型资源）。

---

## 🙏 致谢

- 车辆模型来源：**three.js** 官方示例 `ferrari.glb`（example assets，供学习演示使用）
- 引擎：[three.js](https://threejs.org/)（MIT License）

---

## 📄 License

本项目仅供学习与演示用途，代码可自由参考与修改。请勿将内置车辆模型用于商业发行。
