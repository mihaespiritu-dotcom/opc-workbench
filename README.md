# OPC 个人工作台

自媒体内容管理一体化工作台，纯前端实现，数据本地存储，支持 GitHub 云同步。


## 本 Fork / 增强版说明

基于 [talkershow/opc-workbench](https://github.com/talkershow/opc-workbench) 上游纯前端工作台，在**不重写框架**的前提下补齐 React 版 v0.2/v0.3 验证过的能力。

### 相对原版新增

| 能力 | 入口 | 说明 |
|------|------|------|
| AI 设置（OpenAI-compatible） | 左下角「🤖 AI」 | baseURL / apiKey / model 存 localStorage；测试连接；Key 不进导出/GitHub |
| 邮箱 AI 澄清 | 数据邮箱卡片「🤖 AI」 | 草稿→确认后写回分类/形式/标题/摘要 |
| 选题 AI 三维评分 | 选题弹窗 / 内容评分弹窗 | 草稿填入表单，需点保存入库 |
| AI 日复盘草稿 | 复盘页 / 仪表盘快捷 | 填入日复盘字段，需保存 |
| 去 AI 味 | 内容看板「二次加工」弹窗 | 改写加工笔记，需保存 |
| Metric CSV 导入 | 数据追踪 →「导入 CSV」 | 表头：date,platform,views,likes/engagements,followers,title…（支持中文表头） |
| RSS → 数据邮箱 | 数据邮箱「📡 RSS」 | 可选 allorigins 代理；按 URL/标题去重 |
| T+3 复盘债务 | 仪表盘区块 | 已发布满 3 天且未清除 → 去复盘 / 忽略 |
| 选题一键开工 | 选题表「开工」 | 置为「创作中」并初始化加工草稿，打开加工弹窗 |

### 保留原版能力

仪表盘 KPI + ECharts、选题/内容看板、GitHub 同步、SOP 工具箱、localStorage / local-server / 云同步三模式。

### AI 配置步骤

1. 点击左下角 **🤖 AI**
2. 填写 Base URL（如 `https://api.openai.com/v1` 或兼容网关）、API Key、Model
3. **保存** → **测试连接**
4. 在邮箱 / 选题 / 复盘 / 加工弹窗使用对应 AI 按钮；均为「草稿→确认」

### CSV 示例

```csv
date,platform,views,likes,comments,followers,title
2026-09-10,B站,1200,85,12,5,示例标题
2026-09-11,抖音,800,40,3,2,另一条
```

平台可用中文（B站/抖音/小红书…）或英文别名（bilibili/douyin/xiaohongshu…）。

---
## ✨ 功能模块

| 模块 | 功能 |
|------|------|
| 📊 **仪表盘** | 全局数据总览（总播放、总互动、平均互动率、涨粉）、快捷入口（快速选题/记录数据/今日复盘） |
| 📬 **数据邮箱** | 每日热点信息流展示，5 大分类筛选（热点/行业/竞品/政策/AI工具），一键转选题（弹窗选平台确认），收藏/归档/标记已读 |
| 💡 **选题看板** | 选题增删改查、三维评分（流量/难度/匹配）、状态流转管理 |
| 🎯 **内容看板** | 六维评分（流量/难度/匹配/时效/商业化/复用）、自动 S/A/B/C 分级、多维度筛选排序、二次加工追踪（母内容→平台适配版本）、加工进度可视化 |
| 📈 **数据追踪** | 8 大平台分类展示（B站/YouTube/公众号/抖音/视频号/小红书/微博/知乎）、平台 Tab 切换、双 Y 轴趋势图（播放+互动率+涨粉）、内容排行榜（🥇🥈🥉） |
| 📝 **复盘** | 日复盘（3 分钟，状态/完成/亮点/反思/明日重点，昨日计划继承）+ 周复盘（四问法）+ 历史记录 |
| 🧰 **SOP 工具箱** | 内容结构模板、发布前检查清单、各平台规格速查、标题公式库 |
| ☁️ **GitHub 同步** | 数据云端备份，多设备同步，自动同步（防抖 5 秒）+ 手动同步 |
| 🤖 **AI（增强）** | OpenAI-compatible 设置；邮箱澄清 / 选题评分 / 日复盘草稿 / 去 AI 味（草稿→确认） |
| 📡 **RSS / CSV（增强）** | RSS 拉进数据邮箱（可代理去重）；Metric CSV 批量导入 |
| ⏱ **T+3 / 开工（增强）** | 仪表盘复盘债务；选题一键开工并建加工草稿 |

## 🚀 使用

### 本地使用
直接用浏览器打开 `index.html` 即可。

### 线上版
已部署到 GitHub Pages：[https://talkershow.github.io/opc-workbench/](https://talkershow.github.io/opc-workbench/)

### 数据同步配置
1. 打开工作台，点击左下角「☁ 同步」
2. 填入 GitHub 用户名、仓库名、Token
3. 保存 → 测试连接 → 推送数据
4. 换设备时打开页面 → 拉取即可恢复

### 示例数据
首次打开自动加载演示数据（8 选题 + 20 数据 + 20 邮箱），点击左下角「🔄 重置示例数据」可随时重置。

### 本地文件存储（推荐）
通过本地服务器运行，数据自动保存到 `local-data.json` 文件，清缓存/换浏览器不丢失：
```bash
node local-server.js
```
运行后浏览器自动打开 `http://localhost:3456`，顶栏显示绿点「已保存」表示文件存储已生效。

**三种存储模式自动切换**：
| 模式 | 触发条件 | 数据位置 | 特点 |
|------|---------|---------|------|
| 本地文件 | 运行了 local-server.js | local-data.json | 持久化，最可靠 |
| 浏览器缓存 | 直接打开 HTML | localStorage | 快速，清缓存会丢 |
| GitHub 云端 | 配置了同步 Token | GitHub data.json | 多设备同步 |

## 📂 项目结构

```
opc-workbench/
├── index.html           # 主页面（HTML + 内联 CSS）
├── assets/
│   ├── app.js           # 核心逻辑（路由、DB、存储、同步、各模块渲染）+ 增强接线
│   ├── ai.js            # AI / RSS / CSV / T+3 工具模块（增强版）
│   └── charts.js        # ECharts 图表渲染
├── _shared/
│   └── js/
│       └── echarts.min.js   # ECharts 图表库
├── local-server.js      # 本地数据服务器（零依赖 Node.js）
├── deploy.sh            # 标准化部署脚本
├── local-data.json      # 本地数据文件（运行后自动生成）
├── .gitignore           # 排除数据文件和系统文件
└── README.md
```

## 🛠 技术栈

- **纯前端**：HTML + CSS + JavaScript（零构建工具，零运行时依赖）
- **数据可视化**：ECharts（柱状图/折线图/饼图/双 Y 轴趋势图）
- **本地存储**：localStorage（选题/数据/复盘/邮箱独立存储）
- **云同步**：GitHub Contents API（data.json 版本化同步）
- **部署**：GitHub Pages（静态托管）

## 🔄 部署说明

代码同步和数据同步完全独立：
- **代码同步**：通过 `deploy.sh` 推送 HTML/JS 文件，不影响用户数据
- **数据同步**：工作台内操作 data.json，通过 GitHub API 管理，不影响代码文件
