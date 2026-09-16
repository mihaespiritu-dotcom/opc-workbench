/* ========== OPC 工作台 v1.2 · 可感知大升级 ========== */
(function (global) {
  'use strict';

  var TOPIC_STATUSES = ['灵感', '待评估', '已排期', '创作中', '已发布'];
  var PIPELINE_STAGES = ['灵感', '大纲', '脚本', '制作', '待发布', '已发布', '复盘'];
  var GTD_COLS = [
    { key: 'today', label: '今日' },
    { key: 'next', label: '下一步' },
    { key: 'waiting', label: '等待' },
    { key: 'done', label: '完成' }
  ];
  var SKILLS_KEY = 'opc_skills_v12';
  var YT_KEY = 'opc_youtube_api_key';
  var boardViewMode = 'list'; // list | pipeline
  var topicsViewMode = 'kanban'; // kanban | table
  var C = null; // OPCCore

  function db() { return C.DB; }
  function $(id) { return C.$(id); }
  function toast(m) { C.showToast(m); }
  function esc(s) { return C.escapeHtml(s); }
  function esa(s) { return C.escapeAttr(s); }

  /* ---- Skills ---- */
  var DEFAULT_SKILLS = [
    {
      id: 'topic-score',
      name: '选题评分',
      desc: '三维评分：流量/难度/匹配',
      prompt:
        '你是内容选题评审助手。对选题打三维分（1-5 整数）：流量潜力 traffic、制作难度 difficulty、与定位匹配 match，并给一句理由。\n严格输出 JSON：{"traffic":1-5,"difficulty":1-5,"match":1-5,"reason":"..."}\n\n选题：{{title}}\n备注：{{note}}'
    },
    {
      id: 'hook',
      name: '开头 Hook',
      desc: '写出抓住注意力的前 3 秒/首段',
      prompt:
        '你是短视频/图文开头专家。为以下内容写 3 个不同风格的开头 Hook（口语、反差、承诺结果各一），每个不超过 40 字。直接输出，不要解释。\n\n标题：{{title}}\n要点：{{note}}'
    },
    {
      id: 'de-ai',
      name: '去 AI 味',
      desc: '去掉套话与机械排比',
      prompt:
        '去掉「AI 腔」：减少排比套话、空洞形容词、机械总分总。保留原意，改成更口语、具体、可执行的表达。直接输出改写后全文。\n\n原文：\n{{body}}'
    },
    {
      id: 'xhs-check',
      name: '小红书检查',
      desc: '敏感词/标题党/规格风险检查',
      prompt:
        '你是小红书内容合规与质量检查员。检查以下笔记的：敏感词风险、标题党夸张、emoji 滥用、CTA 是否自然、封面文案建议。用清单输出「问题 / 建议」。\n\n标题：{{title}}\n正文：\n{{body}}'
    },
    {
      id: 'multi-rewrite',
      name: '多平台改写',
      desc: '母内容→抖音/小红书/公众号',
      prompt:
        '将母内容改写成三个平台版本，严格输出 JSON：\n{"douyin":"...","xiaohongshu":"...","wechat":"..."}\n抖音偏口播短句；小红书偏种草清单+emoji；公众号偏深度段落。\n\n母标题：{{title}}\n母内容：\n{{body}}'
    },
    {
      id: 'daily-review',
      name: '日复盘',
      desc: '3 分钟日复盘草稿',
      prompt:
        '根据今日摘要生成日复盘草稿。严格输出 JSON：\n{"mood":"🔥 高效|✅ 正常|😐 一般|😴 低效","done":"...","highlight":"...","reflect":"...","tomorrow":"..."}\n\n摘要：\n{{summary}}'
    },
    {
      id: 'weekly-4q',
      name: '周复盘四问',
      desc: '本周做成了什么 / 没做成 / 学到 / 下周只做一件',
      prompt:
        '用「周复盘四问」输出简洁中文：\n1) 本周做成了什么？\n2) 本周没做成什么？为什么？\n3) 学到了什么可复用？\n4) 下周只做一件最重要的事是什么？\n\n素材：\n{{summary}}'
    },
    {
      id: 'intel-clarify',
      name: '情报澄清',
      desc: '捕获条目→建议分流与标题',
      prompt:
        '你是个人 OS 澄清助手。根据捕获文本，建议分流到 task / topic / discard，并给标题建议与理由。\n严格输出 JSON：{"route":"task|topic|discard","title":"...","reason":"..."}\n\n捕获：\n{{text}}'
    }
  ];

  function loadSkills() {
    try {
      var raw = localStorage.getItem(SKILLS_KEY);
      if (!raw) return DEFAULT_SKILLS.map(function (s) { return Object.assign({}, s); });
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return DEFAULT_SKILLS.map(function (s) { return Object.assign({}, s); });
      return arr;
    } catch (e) {
      return DEFAULT_SKILLS.map(function (s) { return Object.assign({}, s); });
    }
  }
  function saveSkills(list) {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(list || []));
  }
  function resetSkills() {
    saveSkills(DEFAULT_SKILLS.map(function (s) { return Object.assign({}, s); }));
  }

  function loadYtKey() {
    try {
      return localStorage.getItem(YT_KEY) || (db().settings && db().settings.youtubeApiKey) || '';
    } catch (e) { return ''; }
  }
  function saveYtKey(k) {
    localStorage.setItem(YT_KEY, k || '');
    if (!db().settings) db().settings = {};
    db().settings.youtubeApiKey = k || '';
    // Key 存 localStorage；settings 里也写一份便于 UI，导出时会剥离
    db().save();
  }

  function ensurePipeline(t) {
    if (!t.pipelineStage) {
      var m = { '灵感': '灵感', '待评估': '灵感', '已排期': '大纲', '创作中': '制作', '已发布': '已发布' };
      t.pipelineStage = m[t.status] || '灵感';
    }
    return t.pipelineStage;
  }

  function weekDates() {
    var now = new Date();
    var day = now.getDay(); // 0 Sun
    var mondayOffset = day === 0 ? -6 : 1 - day;
    var mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      days.push({ date: iso, label: ['一', '二', '三', '四', '五', '六', '日'][i], d: d });
    }
    return days;
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function tomorrowIso() {
    var d = new Date(Date.now() + 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ========== A. 选题 Kanban ========== */
  function renderTopicsKanban() {
    var wrap = $('topicsTableWrap');
    if (!wrap) return;
    var filter = $('topicFilter') ? $('topicFilter').value : '';
    var topics = db().topics.slice();
    if (filter) topics = topics.filter(function (t) { return t.status === filter; });

    var html = '<div class="view-toggle-bar">' +
      '<button class="btn btn-sm' + (topicsViewMode === 'kanban' ? ' btn-primary' : '') + '" onclick="OPCV12.setTopicsView(\'kanban\')">看板</button>' +
      '<button class="btn btn-sm' + (topicsViewMode === 'table' ? ' btn-primary' : '') + '" onclick="OPCV12.setTopicsView(\'table\')">表格</button>' +
      '<span style="font-size:11px;color:var(--muted);margin-left:8px;">拖拽卡片改状态</span>' +
      '</div>';

    if (topicsViewMode === 'table') {
      wrap.innerHTML = html + '<div id="topicsTableInner"></div>';
      renderTopicsTableFallback($('topicsTableInner'), topics);
      return;
    }

    html += '<div class="kanban-board" id="topicKanban">';
    TOPIC_STATUSES.forEach(function (st) {
      var col = topics.filter(function (t) { return (t.status || '灵感') === st; });
      html += '<div class="kanban-col" data-status="' + esa(st) + '" ondragover="OPCV12.allowDrop(event)" ondrop="OPCV12.dropTopic(event,\'' + esa(st) + '\')">' +
        '<div class="kanban-col-head"><span>' + esc(st) + '</span><span class="kanban-count">' + col.length + '</span></div>' +
        '<div class="kanban-col-body">';
      col.forEach(function (t) {
        var score = (t.traffic || 0) * (t.difficulty || 0) * (t.match || 0);
        var full = C.calcFullScore(t);
        var grade = C.calcGrade(full);
        html += '<div class="kanban-card" draggable="true" ondragstart="OPCV12.dragTopic(event,\'' + esa(t.id) + '\')" data-id="' + esa(t.id) + '">' +
          '<div class="kanban-card-top">' +
            '<span class="grade-pill" style="background:' + C.gradeColors[grade] + ';">' + grade + '</span>' +
            '<span class="kanban-score">' + score + ' 分</span>' +
          '</div>' +
          '<div class="kanban-card-title">' + esc(t.title || '—') + '</div>' +
          '<div class="kanban-card-meta">' + esc(t.form || '') + (t.platforms ? ' · ' + esc(t.platforms) : '') + '</div>' +
          '<div class="kanban-card-actions">' +
            ((t.status === '灵感' || t.status === '待评估' || t.status === '已排期') ?
              '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation();startTopicWithDraft(\'' + esa(t.id) + '\')">开工</button>' : '') +
            '<button class="btn btn-sm" onclick="event.stopPropagation();editTopic(\'' + esa(t.id) + '\')">✏</button>' +
          '</div></div>';
      });
      if (!col.length) html += '<div class="kanban-empty">拖到这里</div>';
      html += '</div></div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
  }

  function renderTopicsTableFallback(el, topics) {
    if (!el) return;
    if (!topics.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-text">还没有选题</div></div>';
      return;
    }
    var html = '<div class="table-wrap"><table><thead><tr><th>标题</th><th>流量</th><th>难度</th><th>匹配</th><th>总分</th><th>状态</th><th>档期</th><th>操作</th></tr></thead><tbody>';
    topics.forEach(function (t) {
      var score = (t.traffic || 0) * (t.difficulty || 0) * (t.match || 0);
      html += '<tr><td style="font-weight:600;">' + esc(t.title) + '</td>' +
        '<td>' + (t.traffic || '—') + '</td><td>' + (t.difficulty || '—') + '</td><td>' + (t.match || '—') + '</td>' +
        '<td>' + C.scoreTag(score) + '</td><td>' + esc(t.status) + '</td><td>' + esc(t.publishAt || '—') + '</td>' +
        '<td><button class="btn btn-sm" onclick="editTopic(\'' + esa(t.id) + '\')">✏</button></td></tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  function setTopicsView(m) {
    topicsViewMode = m;
    renderTopicsKanban();
  }

  var _dragTopicId = null;
  function dragTopic(ev, id) {
    _dragTopicId = id;
    ev.dataTransfer.setData('text/plain', id);
    ev.dataTransfer.effectAllowed = 'move';
  }
  function allowDrop(ev) { ev.preventDefault(); }
  function dropTopic(ev, status) {
    ev.preventDefault();
    var id = ev.dataTransfer.getData('text/plain') || _dragTopicId;
    if (!id) return;
    C.updateTopicStatus(id, status);
    renderTopicsKanban();
    if (typeof renderDashboard === 'function') renderDashboard();
    toast('已移至「' + status + '」');
  }

  /* ========== A2. 内容管线看板 ========== */
  function renderBoardEnhanced() {
    var listEl = $('boardList');
    var statsEl = $('boardGradeStats');
    if (!listEl) return;

    // toolbar for view mode
    var toolbar = $('boardViewToggle');
    if (toolbar) {
      toolbar.innerHTML =
        '<button class="btn btn-sm' + (boardViewMode === 'list' ? ' btn-primary' : '') + '" onclick="OPCV12.setBoardView(\'list\')">列表</button>' +
        '<button class="btn btn-sm' + (boardViewMode === 'pipeline' ? ' btn-primary' : '') + '" onclick="OPCV12.setBoardView(\'pipeline\')">管线</button>' +
        '<button class="btn btn-sm" onclick="OPCV12.openMultiPlatformDraft()">🧬 母内容→多平台草稿</button>';
    }

    if (boardViewMode === 'pipeline') {
      renderPipelineBoard(listEl, statsEl);
      return;
    }
    // fall back to original list renderer
    if (typeof _origRenderBoard === 'function') _origRenderBoard();
  }

  function setBoardView(m) {
    boardViewMode = m;
    if (typeof global.renderBoard === 'function') global.renderBoard();
    else renderBoardEnhanced();
  }

  function renderPipelineBoard(wrap, statsEl) {
    var topics = db().topics.slice();
    topics.forEach(function (t) { ensurePipeline(t); });

    if (statsEl) {
      var htmlS = '';
      PIPELINE_STAGES.forEach(function (st) {
        var n = topics.filter(function (t) { return t.pipelineStage === st; }).length;
        htmlS += '<div class="stat-card" style="padding:12px;cursor:pointer;" onclick="OPCV12.filterPipeline(\'' + esa(st) + '\')">' +
          '<div class="stat-value" style="font-size:20px;">' + n + '</div>' +
          '<div class="stat-label" style="margin-top:2px;">' + esc(st) + '</div></div>';
      });
      statsEl.style.gridTemplateColumns = 'repeat(7,1fr)';
      statsEl.innerHTML = htmlS;
    }

    var html = '<div class="kanban-board pipeline-board">';
    PIPELINE_STAGES.forEach(function (st) {
      var col = topics.filter(function (t) { return t.pipelineStage === st; });
      html += '<div class="kanban-col" ondragover="OPCV12.allowDrop(event)" ondrop="OPCV12.dropPipeline(event,\'' + esa(st) + '\')">' +
        '<div class="kanban-col-head"><span>' + esc(st) + '</span><span class="kanban-count">' + col.length + '</span></div>' +
        '<div class="kanban-col-body">';
      col.forEach(function (t) {
        var full = C.calcFullScore(t);
        var grade = C.calcGrade(full);
        html += '<div class="kanban-card" draggable="true" ondragstart="OPCV12.dragTopic(event,\'' + esa(t.id) + '\')">' +
          '<div class="kanban-card-top"><span class="grade-pill" style="background:' + C.gradeColors[grade] + ';">' + grade + '</span>' +
          (t.publishAt ? '<span class="kanban-score">📅 ' + esc(t.publishAt) + '</span>' : '') + '</div>' +
          '<div class="kanban-card-title">' + esc(t.title || '—') + '</div>' +
          '<div class="kanban-card-meta">' + esc(t.status || '') + '</div>' +
          '<div class="kanban-card-actions">' +
            '<button class="btn btn-sm" onclick="event.stopPropagation();openProcessModal(\'' + esa(t.id) + '\')">🔧</button>' +
            '<button class="btn btn-sm" onclick="event.stopPropagation();OPCV12.setPublishAtPrompt(\'' + esa(t.id) + '\')">📅</button>' +
          '</div></div>';
      });
      if (!col.length) html += '<div class="kanban-empty">拖到此阶段</div>';
      html += '</div></div>';
    });
    html += '</div>';
    wrap.innerHTML = html;
  }

  function dropPipeline(ev, stage) {
    ev.preventDefault();
    var id = ev.dataTransfer.getData('text/plain') || _dragTopicId;
    if (!id) return;
    var updates = { pipelineStage: stage };
    if (stage === '已发布') {
      updates.status = '已发布';
      var t = db().topics.find(function (x) { return x.id === id; });
      if (t && !t.publishedAt) updates.publishedAt = new Date().toISOString();
    } else if (stage === '制作' || stage === '脚本') {
      updates.status = '创作中';
    } else if (stage === '大纲' || stage === '待发布') {
      updates.status = '已排期';
    } else if (stage === '灵感') {
      updates.status = '灵感';
    } else if (stage === '复盘') {
      updates.status = '已发布';
    }
    db().updateTopic(id, updates);
    renderBoardEnhanced();
    toast('管线 → ' + stage);
  }

  function filterPipeline(st) {
    boardViewMode = 'pipeline';
    toast('阶段：' + st + '（见管线列）');
    C.navigate('board');
  }

  function setPublishAtPrompt(id) {
    var t = db().topics.find(function (x) { return x.id === id; });
    if (!t) return;
    var v = prompt('设置发布档期（YYYY-MM-DD）', t.publishAt || todayIso());
    if (v === null) return;
    db().updateTopic(id, { publishAt: v.trim() });
    toast(v.trim() ? '档期已设为 ' + v.trim() : '已清除档期');
    if (boardViewMode === 'pipeline') renderBoardEnhanced();
    renderCalendar();
    enhanceDashboard();
  }

  /* ========== B. 收件箱 + 今日任务 ========== */
  function renderCapture() {
    var el = $('capturePageBody');
    if (!el) return;
    var items = (db().captures || []).filter(function (c) { return c.status === 'inbox'; });
    var html = '<div class="card" style="padding:16px 20px;margin-bottom:16px;">' +
      '<div class="form-row" style="align-items:flex-end;">' +
      '<div class="form-group full" style="flex:1;margin:0;"><div class="form-label">快速捕获（零决策）</div>' +
      '<input class="form-input" id="capture-input" placeholder="想法 / 链接 / 待办… 回车捕获" onkeydown="if(event.key===\'Enter\')OPCV12.addCapture()"></div>' +
      '<button class="btn btn-primary" onclick="OPCV12.addCapture()" style="margin-left:8px;">＋ 捕获</button></div>' +
      '<p style="font-size:11px;color:var(--muted);margin-top:8px;">捕获后在下方澄清：分流为任务 / 选题 / 丢弃</p></div>';

    html += '<div class="card"><div class="card-header"><div class="card-title">待澄清</div><span class="tag tag-accent">' + items.length + '</span></div>';
    if (!items.length) {
      html += '<div class="empty-state" style="padding:24px;"><div class="empty-text">收件箱已清空 ✓</div></div>';
    } else {
      items.forEach(function (c) {
        html += '<div class="capture-item">' +
          '<div style="flex:1;min-width:0;"><div style="font-weight:600;">' + esc(c.text) + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">' + esc((c.createdAt || '').slice(0, 16).replace('T', ' ')) + '</div></div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<button class="btn btn-sm btn-primary" onclick="OPCV12.clarifyCapture(\'' + esa(c.id) + '\',\'task\')">→ 任务</button>' +
          '<button class="btn btn-sm" onclick="OPCV12.clarifyCapture(\'' + esa(c.id) + '\',\'topic\')">→ 选题</button>' +
          '<button class="btn btn-sm" onclick="OPCV12.aiClarifyCapture(\'' + esa(c.id) + '\')">🤖</button>' +
          '<button class="btn btn-sm btn-danger" onclick="OPCV12.clarifyCapture(\'' + esa(c.id) + '\',\'discard\')">丢弃</button>' +
          '</div></div>';
      });
    }
    html += '</div>';
    el.innerHTML = html;
    updateCaptureBadge();
  }

  function addCapture() {
    var input = $('capture-input');
    var text = (input && input.value || '').trim();
    if (!text) { toast('请输入内容'); return; }
    db().addCapture({ text: text, status: 'inbox' });
    if (input) input.value = '';
    renderCapture();
    toast('已捕获');
  }

  function clarifyCapture(id, route) {
    var c = (db().captures || []).find(function (x) { return x.id === id; });
    if (!c) return;
    if (route === 'discard') {
      db().updateCapture(id, { status: 'processed', route: 'discard' });
      toast('已丢弃');
    } else if (route === 'task') {
      db().addTask({ title: c.text, gtd: 'today', priority: 2, fromCaptureId: id });
      db().updateCapture(id, { status: 'processed', route: 'task' });
      toast('已转为今日任务');
    } else if (route === 'topic') {
      db().addTopic({ title: c.text, status: '灵感', traffic: 3, difficulty: 3, match: 3, form: '短视频', pipelineStage: '灵感', fromCaptureId: id });
      db().updateCapture(id, { status: 'processed', route: 'topic' });
      toast('已转为选题');
    }
    renderCapture();
    updateCaptureBadge();
    if (typeof updateBadge === 'function') updateBadge();
  }

  function aiClarifyCapture(id) {
    if (!C.requireAi()) return;
    var c = (db().captures || []).find(function (x) { return x.id === id; });
    if (!c) return;
    toast('AI 澄清中…');
    var skill = loadSkills().find(function (s) { return s.id === 'intel-clarify'; }) || DEFAULT_SKILLS[7];
    var prompt = (skill.prompt || '').replace(/\{\{text\}\}/g, c.text);
    OPCAi.chatCompletion([
      { role: 'system', content: '按用户提示词执行，优先输出 JSON。' },
      { role: 'user', content: prompt }
    ]).then(function (raw) {
      var data = OPCAi.extractJsonObject(raw);
      var body = '<div class="form-group"><div class="form-label">建议分流</div>' +
        '<select class="form-select" id="ai-cap-route"><option value="task">任务</option><option value="topic">选题</option><option value="discard">丢弃</option></select></div>' +
        '<div class="form-group"><div class="form-label">标题</div><input class="form-input" id="ai-cap-title" value="' + esa(data.title || c.text) + '"></div>' +
        '<div style="font-size:12px;color:var(--muted);">理由：' + esc(data.reason || '') + '</div>';
      C.openAiConfirm('捕获澄清建议', '确认后执行分流', body, function () {
        var route = $('ai-cap-route').value;
        var title = $('ai-cap-title').value.trim() || c.text;
        c.text = title;
        if (data.route && ['task', 'topic', 'discard'].indexOf(data.route) >= 0) {
          $('ai-cap-route').value = data.route;
        }
        clarifyCapture(id, route);
      });
      setTimeout(function () {
        var sel = $('ai-cap-route');
        if (sel && data.route) sel.value = data.route;
      }, 30);
    }).catch(function (e) { toast(e.message || String(e)); });
  }

  function updateCaptureBadge() {
    var b = $('badge-capture');
    if (!b) return;
    var n = (db().captures || []).filter(function (c) { return c.status === 'inbox'; }).length;
    b.textContent = String(n);
  }

  function renderTasks() {
    var el = $('tasksPageBody');
    if (!el) return;
    var tasks = db().tasks || [];
    var html = '<div class="card" style="padding:16px 20px;margin-bottom:16px;">' +
      '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">' +
      '<div class="form-group" style="flex:1;min-width:200px;margin:0;"><div class="form-label">新任务</div>' +
      '<input class="form-input" id="task-input" placeholder="写下下一步行动…" onkeydown="if(event.key===\'Enter\')OPCV12.addTaskQuick()"></div>' +
      '<select class="form-select" id="task-gtd" style="width:auto;"><option value="today">今日</option><option value="next">下一步</option><option value="waiting">等待</option></select>' +
      '<button class="btn btn-primary" onclick="OPCV12.addTaskQuick()">＋ 添加</button></div></div>';

    html += '<div class="kanban-board gtd-board">';
    GTD_COLS.forEach(function (col) {
      var list = tasks.filter(function (t) { return (t.gtd || 'today') === col.key; });
      html += '<div class="kanban-col" ondragover="OPCV12.allowDrop(event)" ondrop="OPCV12.dropTask(event,\'' + col.key + '\')">' +
        '<div class="kanban-col-head"><span>' + col.label + '</span><span class="kanban-count">' + list.length + '</span></div><div class="kanban-col-body">';
      list.forEach(function (t) {
        var risk = '';
        if (t.gtd === 'waiting' && t.waitingSince) {
          var days = Math.floor((Date.now() - new Date(t.waitingSince).getTime()) / 86400000);
          if (days >= 3) risk = '<span class="tag tag-yellow">等待 ' + days + ' 天</span>';
        }
        if (t.due && t.due < todayIso() && t.gtd !== 'done') risk += ' <span class="tag tag-red">过期</span>';
        html += '<div class="kanban-card" draggable="true" ondragstart="OPCV12.dragTask(event,\'' + esa(t.id) + '\')">' +
          '<div class="kanban-card-title">' + esc(t.title) + '</div>' +
          (risk ? '<div style="margin:4px 0;">' + risk + '</div>' : '') +
          '<div class="kanban-card-actions">' +
          (t.gtd !== 'done' ? '<button class="btn btn-sm btn-primary" onclick="OPCV12.completeTask(\'' + esa(t.id) + '\')">✓</button>' : '') +
          '<button class="btn btn-sm btn-danger" onclick="OPCV12.deleteTask(\'' + esa(t.id) + '\')">🗑</button></div></div>';
      });
      if (!list.length) html += '<div class="kanban-empty">空</div>';
      html += '</div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
    updateTasksBadge();
  }

  var _dragTaskId = null;
  function dragTask(ev, id) { _dragTaskId = id; ev.dataTransfer.setData('text/plain', id); }
  function dropTask(ev, gtd) {
    ev.preventDefault();
    var id = ev.dataTransfer.getData('text/plain') || _dragTaskId;
    if (!id) return;
    var updates = { gtd: gtd };
    if (gtd === 'waiting') updates.waitingSince = new Date().toISOString();
    if (gtd === 'done') updates.completedAt = new Date().toISOString();
    db().updateTask(id, updates);
    renderTasks();
    enhanceDashboard();
  }
  function addTaskQuick() {
    var input = $('task-input');
    var title = (input && input.value || '').trim();
    if (!title) { toast('请输入任务'); return; }
    var gtd = ($('task-gtd') && $('task-gtd').value) || 'today';
    var t = { title: title, gtd: gtd, priority: 2 };
    if (gtd === 'waiting') t.waitingSince = new Date().toISOString();
    db().addTask(t);
    if (input) input.value = '';
    renderTasks();
    toast('任务已添加');
  }
  function completeTask(id) {
    db().updateTask(id, { gtd: 'done', completedAt: new Date().toISOString() });
    renderTasks();
    enhanceDashboard();
    toast('已完成');
  }
  function deleteTask(id) {
    db().deleteTask(id);
    renderTasks();
    toast('已删除');
  }
  function updateTasksBadge() {
    var b = $('badge-tasks');
    if (!b) return;
    var n = (db().tasks || []).filter(function (t) { return t.gtd === 'today'; }).length;
    b.textContent = String(n);
  }

  /* ========== C. 本周排期日历 ========== */
  function renderCalendar() {
    var el = $('calendarPageBody');
    if (!el) return;
    var days = weekDates();
    var topics = db().topics || [];
    var html = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><div class="card-title">本周发布日历</div>' +
      '<span style="font-size:12px;color:var(--muted);">拖拽选题到日期，或点卡片设档期</span></div>' +
      '<div class="week-cal">';
    days.forEach(function (day) {
      var slots = topics.filter(function (t) { return t.publishAt && String(t.publishAt).slice(0, 10) === day.date; });
      var isToday = day.date === todayIso();
      html += '<div class="week-day' + (isToday ? ' is-today' : '') + '" ondragover="OPCV12.allowDrop(event)" ondrop="OPCV12.dropOnDay(event,\'' + day.date + '\')">' +
        '<div class="week-day-head">周' + day.label + '<br><span style="font-size:11px;color:var(--muted);">' + day.date.slice(5) + '</span>' +
        '<span class="kanban-count">' + slots.length + '</span></div><div class="week-day-body">';
      slots.forEach(function (t) {
        html += '<div class="week-slot" draggable="true" ondragstart="OPCV12.dragTopic(event,\'' + esa(t.id) + '\')">' + esc(t.title) + '</div>';
      });
      if (!slots.length) html += '<div class="kanban-empty" style="padding:8px;">空档</div>';
      html += '</div></div>';
    });
    html += '</div></div>';

    html += '<div class="card"><div class="card-header"><div class="card-title">未排期内容</div></div><div style="display:flex;flex-wrap:wrap;gap:8px;">';
    var unscheduled = topics.filter(function (t) {
      return !t.publishAt && t.status !== '已发布' && (t.status === '已排期' || t.status === '创作中' || t.status === '待评估');
    });
    if (!unscheduled.length) html += '<div class="empty-state" style="padding:16px;width:100%;"><div class="empty-text">暂无待排期内容</div></div>';
    unscheduled.forEach(function (t) {
      html += '<div class="week-slot unscheduled" draggable="true" ondragstart="OPCV12.dragTopic(event,\'' + esa(t.id) + '\')" onclick="OPCV12.setPublishAtPrompt(\'' + esa(t.id) + '\')">' +
        esc(t.title) + '</div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
  }

  function dropOnDay(ev, date) {
    ev.preventDefault();
    var id = ev.dataTransfer.getData('text/plain') || _dragTopicId;
    if (!id) return;
    db().updateTopic(id, { publishAt: date, status: '已排期', pipelineStage: '待发布' });
    toast('已排到 ' + date);
    renderCalendar();
    enhanceDashboard();
  }

  /* ========== D. Skill 库 ========== */
  function renderSkills() {
    var el = $('skillsPageBody');
    if (!el) return;
    var skills = loadSkills();
    var html = '<div class="card" style="margin-bottom:16px;"><div class="card-header"><div class="card-title">Skill / 提示词库</div>' +
      '<div style="display:flex;gap:8px;"><button class="btn btn-sm" onclick="OPCV12.resetSkillsUI()">恢复默认</button></div></div>' +
      '<p style="font-size:12px;color:var(--muted);margin-bottom:8px;">可编辑，存 localStorage。一键复制；若已配 AI 可运行并填入上下文。</p></div>';
    skills.forEach(function (s, idx) {
      html += '<div class="card skill-card" style="margin-bottom:12px;">' +
        '<div class="card-header"><div class="card-title">' + esc(s.name) + '</div><span class="tag tag-muted">' + esc(s.id) + '</span></div>' +
        '<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">' + esc(s.desc || '') + '</div>' +
        '<textarea class="form-textarea skill-prompt" id="skill-prompt-' + idx + '" style="min-height:100px;font-size:12px;">' + esc(s.prompt) + '</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">' +
        '<button class="btn btn-sm" onclick="OPCV12.saveSkillAt(' + idx + ')">💾 保存</button>' +
        '<button class="btn btn-sm btn-primary" onclick="OPCV12.copySkill(' + idx + ')">📋 复制提示词</button>' +
        '<button class="btn btn-sm" onclick="OPCV12.runSkill(' + idx + ')">▶ 运行并填入</button>' +
        '</div></div>';
    });
    el.innerHTML = html;
  }

  function saveSkillAt(idx) {
    var skills = loadSkills();
    var ta = $('skill-prompt-' + idx);
    if (!ta || !skills[idx]) return;
    skills[idx].prompt = ta.value;
    saveSkills(skills);
    toast('Skill 已保存');
  }
  function copySkill(idx) {
    var skills = loadSkills();
    var ta = $('skill-prompt-' + idx);
    var text = ta ? ta.value : (skills[idx] && skills[idx].prompt) || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }).catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败'); }
    document.body.removeChild(ta);
  }
  function resetSkillsUI() {
    resetSkills();
    renderSkills();
    toast('已恢复默认 Skill');
  }
  function runSkill(idx) {
    var skills = loadSkills();
    var s = skills[idx];
    if (!s) return;
    var ta = $('skill-prompt-' + idx);
    var prompt = (ta ? ta.value : s.prompt) || '';
    // fill context placeholders from current topic if any
    var t = db().topics[0] || {};
    prompt = prompt
      .replace(/\{\{title\}\}/g, t.title || '')
      .replace(/\{\{note\}\}/g, t.note || '')
      .replace(/\{\{body\}\}/g, (t.processing && t.processing.notes) || t.note || '')
      .replace(/\{\{text\}\}/g, t.title || '')
      .replace(/\{\{summary\}\}/g, '选题数 ' + db().topics.length + '；任务今日 ' + (db().tasks || []).filter(function (x) { return x.gtd === 'today'; }).length);

    if (!C.requireAi()) {
      fallbackCopy(prompt);
      toast('未配 AI，已复制填充后的提示词');
      return;
    }
    toast('Skill 运行中…');
    OPCAi.chatCompletion([
      { role: 'system', content: '你是 OPC 工作台助手，按用户 Skill 提示词输出，可用中文。' },
      { role: 'user', content: prompt }
    ]).then(function (raw) {
      C.openAiConfirm('Skill 结果：' + s.name, '确认后可复制；不会自动发帖。可手动粘贴到对应表单。',
        '<textarea class="form-textarea" id="skill-run-out" style="min-height:180px;">' + esc(raw) + '</textarea>',
        function () {
          var out = $('skill-run-out').value;
          fallbackCopy(out);
          toast('结果已复制到剪贴板');
        });
    }).catch(function (e) { toast(e.message || String(e)); });
  }

  /* ========== E. YouTube + 多平台草稿 ========== */
  function extractYoutubeId(input) {
    var s = String(input || '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    var m = s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/shorts\/([\w-]{11})/);
    return m ? m[1] : '';
  }

  function fetchYoutubeStats() {
    var key = loadYtKey();
    var input = $('yt-video-input') && $('yt-video-input').value;
    var id = extractYoutubeId(input);
    var msg = $('yt-fetch-msg');
    if (!key) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = '请先填写 YouTube API Key'; }
      toast('缺少 YouTube API Key');
      return;
    }
    if (!id) {
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = '无法解析视频 ID，请粘贴 URL 或 11 位 ID'; }
      toast('视频 ID 无效');
      return;
    }
    if (msg) { msg.style.color = 'var(--muted)'; msg.textContent = '拉取中…'; }
    var url = 'https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=' + encodeURIComponent(id) + '&key=' + encodeURIComponent(key);
    fetch(url).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var err = (j.error && j.error.message) || ('HTTP ' + r.status);
          throw new Error(err);
        }
        return j;
      });
    }).then(function (j) {
      if (!j.items || !j.items.length) throw new Error('未找到该视频（可能是私有/删除/ID 错误）');
      var item = j.items[0];
      var st = item.statistics || {};
      var sn = item.snippet || {};
      var views = parseInt(st.viewCount || '0', 10) || 0;
      var likes = parseInt(st.likeCount || '0', 10) || 0;
      var comments = parseInt(st.commentCount || '0', 10) || 0;
      var title = sn.title || ('YouTube ' + id);
      var rec = {
        date: todayIso(),
        platform: 'YouTube',
        title: title,
        views: views,
        likes: likes,
        comments: comments,
        engagements: likes + comments,
        followers: 0,
        note: 'YouTube API · ' + id,
        source: 'youtube_api'
      };
      db().addData(rec);
      if (msg) { msg.style.color = 'var(--green)'; msg.textContent = '已写入：播放 ' + views + ' / 赞 ' + likes + ' / 评 ' + comments; }
      toast('YouTube 数据已写入 Metric');
      if (typeof renderDataPage === 'function') renderDataPage();
      if (typeof renderDashboard === 'function') renderDashboard();
    }).catch(function (e) {
      var m = e.message || String(e);
      if (msg) { msg.style.color = 'var(--red)'; msg.textContent = '失败：' + m; }
      toast('YouTube 拉取失败：' + m);
    });
  }

  function saveYtKeyUI() {
    var k = $('yt-api-key') && $('yt-api-key').value;
    saveYtKey((k || '').trim());
    toast('YouTube Key 已保存到本机');
  }

  function openMultiPlatformDraft() {
    var topics = db().topics.filter(function (t) {
      return t.status === '创作中' || t.status === '已排期' || t.status === '已发布' || (t.processing && t.processing.notes);
    });
    if (!topics.length) topics = db().topics.slice(0, 8);
    if (!topics.length) { toast('暂无内容'); return; }
    var opts = topics.map(function (t) {
      return '<option value="' + esa(t.id) + '">' + esc(t.title) + '</option>';
    }).join('');
    var body = '<div class="form-group"><div class="form-label">选择母内容</div><select class="form-select" id="mp-topic">' + opts + '</select></div>' +
      '<p style="font-size:12px;color:var(--muted);">将生成抖音 / 小红书 / 公众号草稿，确认后写入加工适配。</p>';
    C.openAiConfirm('母内容 → 多平台草稿', 'AI 优先；无 Key 时用模板。确认后保存。', body, function () {
      var id = $('mp-topic').value;
      generateMultiPlatform(id);
    });
  }

  function templateMulti(title, note) {
    var base = note || title || '';
    return {
      douyin: '【口播】' + title + '\n\n开头钩子：你有没有发现……\n\n要点：\n1) ' + base.slice(0, 80) + '\n2) …\n3) …\n\n结尾 CTA：关注我，下期继续拆。',
      xiaohongshu: '✨' + title + '✨\n\n姐妹们！今天分享：\n👉 ' + base.slice(0, 60) + '\n👉 可直接套用\n👉 记得收藏\n\n#干货 #自我成长',
      wechat: '# ' + title + '\n\n## 引言\n' + base.slice(0, 120) + '\n\n## 正文\n（在此展开 800–1500 字）\n\n## 结语\n欢迎留言讨论。'
    };
  }

  function generateMultiPlatform(id) {
    var t = db().topics.find(function (x) { return x.id === id; });
    if (!t) return;
    var note = (t.processing && t.processing.notes) || t.note || '';
    function applyDrafts(drafts) {
      var body =
        '<div class="form-group"><div class="form-label">抖音</div><textarea class="form-textarea" id="mp-dy" style="min-height:80px;">' + esc(drafts.douyin || '') + '</textarea></div>' +
        '<div class="form-group"><div class="form-label">小红书</div><textarea class="form-textarea" id="mp-xhs" style="min-height:80px;">' + esc(drafts.xiaohongshu || '') + '</textarea></div>' +
        '<div class="form-group"><div class="form-label">公众号</div><textarea class="form-textarea" id="mp-wx" style="min-height:80px;">' + esc(drafts.wechat || '') + '</textarea></div>';
      C.openAiConfirm('确认多平台草稿', '确认后写入该内容的平台适配笔记（不自动发帖）', body, function () {
        var proc = t.processing || { status: 'processing', adaptations: [], notes: note };
        var map = {
          '抖音': $('mp-dy').value,
          '小红书': $('mp-xhs').value,
          '公众号': $('mp-wx').value
        };
        var adap = proc.adaptations || [];
        Object.keys(map).forEach(function (p) {
          var existing = adap.find(function (a) { return a.platform === p; });
          if (existing) {
            existing.status = 'processing';
            existing.draft = map[p];
          } else {
            adap.push({ platform: p, status: 'processing', draft: map[p] });
          }
        });
        proc.adaptations = adap;
        proc.status = 'processing';
        proc.notes = (proc.notes || '') + '\n\n--- 多平台草稿 ' + todayIso() + ' ---\n';
        db().updateTopic(id, { processing: proc });
        toast('多平台草稿已保存（待你继续加工）');
        if (typeof renderBoard === 'function') renderBoard();
      });
    }

    if (typeof OPCAi !== 'undefined' && OPCAi.hasAiKey()) {
      toast('AI 生成多平台草稿…');
      var skill = loadSkills().find(function (s) { return s.id === 'multi-rewrite'; });
      var prompt = (skill && skill.prompt || DEFAULT_SKILLS[4].prompt)
        .replace(/\{\{title\}\}/g, t.title || '')
        .replace(/\{\{body\}\}/g, note || t.title || '');
      OPCAi.chatCompletion([
        { role: 'system', content: '按要求输出 JSON，字段 douyin/xiaohongshu/wechat。' },
        { role: 'user', content: prompt }
      ]).then(function (raw) {
        var data = OPCAi.extractJsonObject(raw);
        applyDrafts({
          douyin: data.douyin || raw,
          xiaohongshu: data.xiaohongshu || '',
          wechat: data.wechat || ''
        });
      }).catch(function (e) {
        toast('AI 失败，改用模板：' + (e.message || ''));
        applyDrafts(templateMulti(t.title, note));
      });
    } else {
      applyDrafts(templateMulti(t.title, note));
    }
  }

  /* ========== F. 仪表盘增强 ========== */
  var _origRenderDashboard = null;
  var _origRenderBoard = null;
  var _origRenderTopics = null;

  function enhanceDashboard() {
    // 兼容旧调用：走完整仪表盘渲染（内部会 paintDashboardExtras）
    if (typeof global.renderDashboard === 'function') return global.renderDashboard();
    return paintDashboardExtras();
  }

  function markZero(id, val) {
    var el = $(id);
    if (!el) return;
    el.textContent = typeof val === 'number' && id.indexOf('views') >= 0 ? C.fmtNum(val) : String(val);
    if (!val) {
      el.style.color = 'var(--red)';
      el.classList.add('stat-zero');
    } else {
      el.style.color = '';
      el.classList.remove('stat-zero');
    }
  }

  function jumpPipeline(st) {
    boardViewMode = 'pipeline';
    C.navigate('board');
    setTimeout(function () { toast('管线聚焦：' + st); }, 50);
  }

  /* ========== Boot ========== */
  function paintDashboardExtras() {
    var data = db().dataRecords || [];
    var topics = db().topics || [];
    var totalViews = data.reduce(function (s, d) { return s + (Number(d.views) || 0); }, 0);
    markZero('dash-total-views', totalViews);
    markZero('dash-topic-count', topics.length);
    markZero('dash-published-count', topics.filter(function (t) { return t.status === '已发布'; }).length);

    var avgEl = $('dash-avg-engagement');
    if (avgEl && !data.length) {
      avgEl.textContent = '0%';
      avgEl.style.color = 'var(--red)';
    } else if (avgEl) {
      avgEl.style.color = '';
    }

    var emptyHint = $('dash-empty-hint');
    if (emptyHint) {
      emptyHint.style.display = (!topics.length && !data.length) ? 'block' : 'none';
    }

    var top3 = $('dash-top3-tasks');
    if (top3) {
      var todayTasks = (db().tasks || []).filter(function (t) { return t.gtd === 'today'; }).slice(0, 3);
      var risks = (db().tasks || []).filter(function (t) {
        if (t.gtd === 'done') return false;
        if (t.due && t.due < todayIso()) return true;
        if (t.gtd === 'waiting' && t.waitingSince) {
          return Math.floor((Date.now() - new Date(t.waitingSince).getTime()) / 86400000) >= 3;
        }
        return false;
      });
      var html = '';
      if (!todayTasks.length) {
        html = '<div class="empty-state" style="padding:12px;"><div class="empty-text">今日无任务 · <a href="#" onclick="navigate(\'tasks\');return false" style="color:var(--accent);">去添加</a></div></div>';
      } else {
        todayTasks.forEach(function (t, i) {
          html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--rule);">' +
            '<span style="font-weight:800;color:var(--accent);">' + (i + 1) + '</span>' +
            '<div style="flex:1;">' + esc(t.title) + '</div>' +
            '<button class="btn btn-sm" onclick="OPCV12.completeTask(\'' + esa(t.id) + '\');navigate(\'dashboard\');">✓</button></div>';
        });
      }
      if (risks.length) {
        html += '<div style="margin-top:10px;font-size:12px;color:var(--red);">⚠ 风险 ' + risks.length + ' 项（过期/等待过久）· <a href="#" onclick="navigate(\'tasks\');return false" style="color:var(--accent);">查看</a></div>';
      }
      top3.innerHTML = html;
    }

    var strip = $('dash-week-strip');
    if (strip) {
      var days = weekDates();
      var html2 = '';
      days.forEach(function (day) {
        var n = topics.filter(function (t) { return t.publishAt && String(t.publishAt).slice(0, 10) === day.date; }).length;
        var isToday = day.date === todayIso();
        var isTom = day.date === tomorrowIso();
        html2 += '<div class="week-strip-cell' + (isToday ? ' is-today' : '') + (isTom ? ' is-tom' : '') + '" onclick="navigate(\'calendar\')" title="' + day.date + '">' +
          '<div class="wsc-label">周' + day.label + '</div>' +
          '<div class="wsc-count' + (n === 0 ? ' zero' : '') + '">' + n + '</div>' +
          (isToday ? '<div class="wsc-tag">今</div>' : isTom ? '<div class="wsc-tag">明</div>' : '') +
          '</div>';
      });
      strip.innerHTML = html2;
    }

    var pipe = $('dash-pipeline-click');
    if (pipe) {
      var html3 = '';
      PIPELINE_STAGES.forEach(function (st) {
        var n = topics.filter(function (t) { return ensurePipeline(t) === st; }).length;
        html3 += '<button class="pipe-chip" onclick="OPCV12.jumpPipeline(\'' + esa(st) + '\')"><b>' + n + '</b><span>' + esc(st) + '</span></button>';
      });
      pipe.innerHTML = html3;
    }

    updateCaptureBadge();
    updateTasksBadge();
  }

  function refreshBoardToolbar() {
    var toolbar = $('boardViewToggle');
    if (!toolbar) return;
    toolbar.innerHTML =
      '<button class="btn btn-sm' + (boardViewMode === 'list' ? ' btn-primary' : '') + '" onclick="OPCV12.setBoardView(\'list\')">列表</button>' +
      '<button class="btn btn-sm' + (boardViewMode === 'pipeline' ? ' btn-primary' : '') + '" onclick="OPCV12.setBoardView(\'pipeline\')">管线</button>' +
      '<button class="btn btn-sm" onclick="OPCV12.openMultiPlatformDraft()">🧬 母内容→多平台草稿</button>';
  }

  function boot(core) {
    C = core;
    global.OPCV12._dashReady = true;
    global.OPCV12._boardReady = true;

    var _ot = global.openTopicModal;
    if (_ot) {
      global.openTopicModal = function (id) {
        _ot(id);
        setTimeout(function () {
          var el = $('topic-publishAt');
          if (!el) return;
          if (id) {
            var t = db().topics.find(function (x) { return x.id === id; });
            el.value = (t && t.publishAt) || '';
          } else el.value = '';
        }, 0);
      };
    }

    setTimeout(function () {
      var yk = $('yt-api-key');
      if (yk) yk.value = loadYtKey();
    }, 100);

    console.log('[OPC v1.2] boot OK');
  }

  global.OPCV12 = {
    boot: boot,
    renderCapture: renderCapture,
    renderTasks: renderTasks,
    renderCalendar: renderCalendar,
    renderSkills: renderSkills,
    enhanceDashboard: function () { if (typeof global.renderDashboard === 'function') global.renderDashboard(); else paintDashboardExtras(); },
    paintDashboardExtras: paintDashboardExtras,
    renderTopicsKanbanProxy: renderTopicsKanban,
    renderBoardEnhancedProxy: renderBoardEnhanced,
    refreshBoardToolbar: refreshBoardToolbar,
    getBoardView: function () { return boardViewMode; },
    setTopicsView: setTopicsView,
    setBoardView: setBoardView,
    dragTopic: dragTopic,
    allowDrop: allowDrop,
    dropTopic: dropTopic,
    dropPipeline: dropPipeline,
    dropOnDay: dropOnDay,
    dragTask: dragTask,
    dropTask: dropTask,
    addCapture: addCapture,
    clarifyCapture: clarifyCapture,
    aiClarifyCapture: aiClarifyCapture,
    addTaskQuick: addTaskQuick,
    completeTask: completeTask,
    deleteTask: deleteTask,
    setPublishAtPrompt: setPublishAtPrompt,
    filterPipeline: filterPipeline,
    jumpPipeline: jumpPipeline,
    saveSkillAt: saveSkillAt,
    copySkill: copySkill,
    runSkill: runSkill,
    resetSkillsUI: resetSkillsUI,
    fetchYoutubeStats: fetchYoutubeStats,
    saveYtKeyUI: saveYtKeyUI,
    openMultiPlatformDraft: openMultiPlatformDraft,
    generateMultiPlatform: generateMultiPlatform,
    TOPIC_STATUSES: TOPIC_STATUSES,
    PIPELINE_STAGES: PIPELINE_STAGES
  };
})(typeof window !== 'undefined' ? window : this);
