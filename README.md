# OPC 个人工作台

自媒体内容管理一体化工作台，纯前端实现，数据本地存储，支持 GitHub 云同步。

## 本 Fork / 增强版说明

基于 [talkershow/opc-workbench](https://github.com/talkershow/opc-workbench) 上游纯前端工作台，对齐 PRD 与 GitHub/X 调研，升级至 **v1.2**。

### 功能对照表（已有 vs 本轮新增）

| 能力 | v1.1 及以前 | **v1.2 新增/加深** | 入口 |
|------|-------------|-------------------|------|
| 仪表盘 KPI | ✅ 播放/互动率等 | ✅ 诚实红 0 + 空数据引导 | 仪表盘 |
| Top3 任务 / 风险 | ❌ | ✅ 今日 Top3 + 过期/等待过久 | 仪表盘 |
| 本周档期条 | ❌ | ✅ 周一～日槽位，今明高亮 | 仪表盘 → 本周排期 |
| 管线点击跳转 | ⚠️ 仅图表 | ✅ 七阶段芯片跳转管线看板 | 仪表盘 |
| T+3 复盘债务 | ✅ | ✅ 保留 | 仪表盘 |
| 选题 Kanban 拖拽 | ❌ 表格+下拉 | ✅ HTML5 拖拽改状态、列头计数、分级/评分 | 选题看板 |
| 内容管线看板 | ❌ 列表 | ✅ 灵感→…→复盘拖拽；`pipelineStage` 迁移 | 内容看板 →「管线」 |
| 收件箱 Inbox | ❌（仅有数据邮箱） | ✅ 捕获→澄清（任务/选题/丢弃） | 侧栏「收件箱」 |
| 今日任务 GTD | ❌ | ✅ 今日/下一步/等待/完成 拖拽 | 侧栏「今日任务」 |
| 本周发布日历 | ❌ | ✅ 周视图；拖到某天或表单 `publishAt` | 侧栏「本周排期」 |
| Skill / 提示词库 | ❌ | ✅ 8 个可编辑 Skill；复制 / AI 运行 | 侧栏「Skill 库」 |
| YouTube Data API | ❌ | ✅ Key + 视频 ID/URL → Metric | 🤖 AI 设置底部 |
| 母内容→多平台草稿 | ❌ | ✅ AI/模板 → 抖音/小红书/公众号（确认保存） | 内容看板 / 仪表盘 |
| AI / RSS / CSV | ✅ | ✅ 保留 | 各原入口 |
| 密钥安全 | ✅ AI Key 本机 | ✅ YT Key 本机；导出/GitHub **剥离 Key** | — |

### 相对上游原版仍保留

仪表盘 ECharts、数据邮箱、选题/内容、GitHub 同步、SOP 工具箱、localStorage / local-server / 云同步三模式。

---

## ✨ 功能模块

| 模块 | 功能 |
|------|------|
| 📊 **仪表盘** | KPI（红 0）、Top3 任务、复盘债务、本周档期、管线跳转、AI 快捷 |
| 📥 **收件箱** | 快速捕获 → 澄清分流（任务/选题/丢弃）；可 AI 建议 |
| ✅ **今日任务** | GTD 四列拖拽；等待过久/过期进风险 |
| 📬 **数据邮箱** | 热点情报、RSS、一键转选题 |
| 💡 **选题看板** | **Kanban 拖拽**（灵感/待评估/已排期/创作中/已发布）+ 表格视图 |
| 🎯 **内容看板** | 列表 + **管线**七阶段；多维评分；二次加工；多平台草稿 |
| 📅 **本周排期** | 周日历设 `publishAt` |
| 📈 **数据追踪** | 八平台 + CSV 导入 + YouTube API 写入 |
| 📝 **复盘** | 日复盘 + 周复盘四问 |
| 🧩 **Skill 库** | 选题评分/Hook/去 AI 味/小红书检查/多平台改写/日周复盘/情报澄清 |
| 🧰 **SOP 工具箱** | 模板 / 清单 / 规格 |
| ☁️ **GitHub 同步** | 推拉 data.json（不含 API Key） |

## 🚀 使用

### 本地使用
直接用浏览器打开 `index.html` 即可。

### 推荐：本地文件存储
```bash
node local-server.js
```
浏览器打开 `http://localhost:3456`，顶栏绿点「已保存」表示文件存储生效。

### AI / YouTube 配置
1. 左下角 **🤖 AI**
2. 填写 OpenAI-compatible Base URL / API Key / Model → 保存 → 测试
3. 同弹窗下方填写 **YouTube API Key**，粘贴视频 URL 或 ID →「拉取并写入 Metric」
4. Key **只存 localStorage**，导出与 GitHub 同步会剥离

### 验证建议（v1.2）
1. `node local-server.js` → 打开仪表盘，看 KPI / 档期条 / 管线芯片
2. **收件箱** 捕获一条 → 澄清为任务或选题
3. **选题看板** 拖拽卡片跨列
4. **内容看板 → 管线** 拖阶段；点「多平台草稿」
5. **本周排期** 把未排期卡片拖到某天
6. **Skill 库** 复制或运行一条提示词
7. （可选）配置 YouTube Key 拉一条公开视频统计

### 示例数据
首次打开可加载演示数据；左下角「🔄 重置示例数据」可重置。

## 📂 项目结构

```
opc-workbench-github-base/
├── index.html           # 主页面（HTML + CSS）
├── assets/
│   ├── app.js           # 核心逻辑 + DB v3（captures/tasks）
│   ├── v12.js           # v1.2 看板/GTD/排期/Skill/YT/多平台
│   ├── ai.js            # AI / RSS / CSV / T+3
│   └── charts.js        # ECharts
├── _shared/js/echarts.min.js
├── local-server.js
├── samples/metrics-sample.csv
└── README.md
```

## 🛠 技术栈

- **纯前端**：HTML + CSS + JavaScript（零构建）
- **数据可视化**：ECharts
- **本地存储**：`opc_database` localStorage + 可选 `local-data.json`
- **云同步**：GitHub Contents API（剥离密钥）

## 明确不做

- 自动发帖到任何平台
- 把 API Key 写入导出 JSON / GitHub data.json
- 静默 AI 写入（一律草稿→确认）
