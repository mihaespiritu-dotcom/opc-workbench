/* ========== OPC 增强 · AI / RSS / CSV（独立模块，零构建） ========== */
(function (global) {
  'use strict';

  var AI_KEY = 'opc_ai_settings';
  var RSS_KEY = 'opc_rss_sources';

  var DEFAULT_AI = {
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini'
  };

  function normalizeBase(url) {
    return String(url || '').replace(/\/+$/, '') || DEFAULT_AI.baseURL;
  }

  function loadAiSettings() {
    try {
      var raw = localStorage.getItem(AI_KEY);
      if (!raw) return Object.assign({}, DEFAULT_AI);
      var p = JSON.parse(raw);
      return {
        baseURL: (p.baseURL && String(p.baseURL).trim()) || DEFAULT_AI.baseURL,
        apiKey: p.apiKey || '',
        model: (p.model && String(p.model).trim()) || DEFAULT_AI.model
      };
    } catch (e) {
      return Object.assign({}, DEFAULT_AI);
    }
  }

  function saveAiSettings(s) {
    localStorage.setItem(AI_KEY, JSON.stringify({
      baseURL: (s.baseURL || '').trim() || DEFAULT_AI.baseURL,
      apiKey: s.apiKey || '',
      model: (s.model || '').trim() || DEFAULT_AI.model
    }));
  }

  function hasAiKey(s) {
    var cfg = s || loadAiSettings();
    return !!(cfg.apiKey && String(cfg.apiKey).trim());
  }

  function AiError(message, status) {
    var e = new Error(message);
    e.name = 'AiError';
    e.status = status;
    return e;
  }

  function chatCompletion(messages, opts) {
    opts = opts || {};
    var settings = opts.settings || loadAiSettings();
    if (!settings.apiKey || !String(settings.apiKey).trim()) {
      return Promise.reject(AiError('未配置 API Key，请先到「AI 设置」填写'));
    }
    var url = normalizeBase(settings.baseURL) + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + String(settings.apiKey).trim()
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_AI.model,
        messages: messages,
        temperature: opts.temperature != null ? opts.temperature : 0.4
      }),
      signal: opts.signal
    }).then(function (res) {
      return res.text().then(function (text) {
        var json;
        try {
          json = text ? JSON.parse(text) : {};
        } catch (e) {
          throw AiError('接口返回非 JSON（HTTP ' + res.status + '）：' + text.slice(0, 200), res.status);
        }
        if (!res.ok) {
          var detail = (json.error && json.error.message) || json.message || text.slice(0, 300);
          throw AiError('API 错误 HTTP ' + res.status + '：' + detail, res.status);
        }
        var content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
        if (!content || !String(content).trim()) throw AiError('模型返回空内容');
        return String(content).trim();
      });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') throw e;
      if (e && e.name === 'AiError') throw e;
      throw AiError('网络错误：' + ((e && e.message) || String(e)));
    });
  }

  function testAiConnection(settings) {
    return chatCompletion(
      [
        { role: 'system', content: 'Reply with exactly: ok' },
        { role: 'user', content: 'ping' }
      ],
      { settings: settings, temperature: 0 }
    );
  }

  function extractJsonObject(raw) {
    var fenced = String(raw).match(/```(?:json)?\s*([\s\S]*?)```/i);
    var candidate = (fenced ? fenced[1] : raw).trim();
    var start = candidate.indexOf('{');
    var end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) throw AiError('无法从回复中解析 JSON 对象');
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (e) {
      throw AiError('JSON 解析失败：' + e.message);
    }
  }

  /* ---- Prompts ---- */
  var Prompts = {
    inboxClarify: function (title, summary, url) {
      return [
        {
          role: 'system',
          content:
            '你是内容运营情报澄清助手。根据情报标题与摘要，建议分类与内容形式，并给出可编辑的标题建议。\n' +
            '分类只能从：热点话题 / 行业动态 / 竞品内容 / 平台政策 / AI工具 中选。\n' +
            '形式只能从：短视频 / 中长视频 / 深度图文 / 小红书图文 / 直播 中选。\n' +
            '严格输出 JSON：{"category":"...","suggestForm":"...","title_suggestion":"...","reason":"...","summary_suggestion":"..."}'
        },
        {
          role: 'user',
          content: '标题：' + title + '\n摘要：' + (summary || '无') + (url ? '\n链接：' + url : '')
        }
      ];
    },
    topicScore: function (title, note) {
      return [
        {
          role: 'system',
          content:
            '你是内容选题评审助手。对选题打三维分（1-5 整数）：流量潜力 traffic、制作难度 difficulty、与定位匹配 match。\n' +
            '并给一句理由。严格输出 JSON：\n' +
            '{"traffic":1-5,"difficulty":1-5,"match":1-5,"reason":"..."}'
        },
        {
          role: 'user',
          content: '选题标题：' + title + '\n备注：' + (note || '无')
        }
      ];
    },
    dailyReview: function (summary) {
      return [
        {
          role: 'system',
          content:
            '你是日复盘助手。根据今日工作摘要生成复盘草稿字段。严格输出 JSON：\n' +
            '{"mood":"🔥 高效|✅ 正常|😐 一般|😴 低效","done":"...","highlight":"...","reflect":"...","tomorrow":"..."}\n' +
            '用中文，简洁可编辑。mood 必须是四个选项之一。'
        },
        { role: 'user', content: summary }
      ];
    },
    deAi: function (body) {
      return [
        {
          role: 'system',
          content:
            '你是中文内容润色助手。去掉「AI 腔」：减少排比套话、空洞形容词、机械总分总。\n' +
            '保留原意与事实，改成更口语、具体、可执行的表达。直接输出改写后的全文，不要解释、不要包 JSON。'
        },
        { role: 'user', content: body }
      ];
    },
    contentDraft: function (title, note, platforms) {
      return [
        {
          role: 'system',
          content:
            '你是内容写作助手。根据选题生成可编辑的大纲/正文草稿（Markdown 可用），不要假装已发布。直接输出正文，不要包 JSON。'
        },
        {
          role: 'user',
          content:
            '选题：' + title + '\n平台：' + (platforms || '母内容') + '\n笔记/要点：' + (note || '无') +
            '\n请写一篇可直接再改的草稿大纲。'
        }
      ];
    },
    multiPlatform: function (title, body) {
      return [
        {
          role: 'system',
          content:
            '将母内容改写成三个平台版本。严格输出 JSON：{"douyin":"...","xiaohongshu":"...","wechat":"..."}。' +
            '抖音偏口播短句；小红书偏种草清单；公众号偏深度段落。不要假装已发布。'
        },
        {
          role: 'user',
          content: '母标题：' + title + '\n母内容：\n' + (body || '')
        }
      ];
    }
  };

  /* ---- RSS ---- */
  function loadRssSources() {
    try {
      var raw = localStorage.getItem(RSS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRssSources(list) {
    localStorage.setItem(RSS_KEY, JSON.stringify(list || []));
  }

  function decodeXml(s) {
    return String(s)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tagText(block, tag) {
    var re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
    var m = block.match(re);
    return m ? decodeXml(m[1]) : '';
  }

  function linkFrom(block) {
    var enclosed = tagText(block, 'link');
    if (enclosed) return enclosed;
    var href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
    return href ? href[1] : '';
  }

  function parseRssXml(xml) {
    var items = [];
    var itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    var entryBlocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    var blocks = itemBlocks.length ? itemBlocks : entryBlocks;
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      items.push({
        title: tagText(block, 'title') || '无标题',
        link: linkFrom(block),
        summary: tagText(block, 'description') || tagText(block, 'summary') || tagText(block, 'content') || ''
      });
    }
    return items;
  }

  function fetchRssFeed(url, useProxy) {
    var target = useProxy
      ? 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)
      : url;
    return fetch(target)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('拉取失败 HTTP ' + res.status + (useProxy ? '（代理）' : '') + '。可切换代理开关重试。');
        }
        return res.text();
      })
      .then(function (text) {
        if (!String(text).trim()) throw new Error('返回内容为空');
        var items = parseRssXml(text);
        if (!items.length) throw new Error('未解析到 <item>/<entry>，请确认是 RSS/Atom，或换源');
        return items;
      })
      .catch(function (e) {
        if (e && /拉取失败|未解析|为空/.test(e.message)) throw e;
        throw new Error('拉取失败（网络/CORS）：' + ((e && e.message) || String(e)) + '。可开启「公开代理」后重试。');
      });
  }

  /* ---- Metric CSV ---- */
  var PLATFORM_MAP = {
    'b站': 'B站', bilibili: 'B站', b: 'B站',
    youtube: 'YouTube', yt: 'YouTube',
    '公众号': '公众号', wechat: '公众号',
    '抖音': '抖音', douyin: '抖音',
    '视频号': '视频号', channels: '视频号',
    '小红书': '小红书', xhs: '小红书', xiaohongshu: '小红书',
    '微博': '微博', weibo: '微博',
    '知乎': '知乎', zhihu: '知乎'
  };

  function normalizePlatform(raw) {
    var v = String(raw || '').trim();
    if (!v) return null;
    var known = ['B站', 'YouTube', '公众号', '抖音', '视频号', '小红书', '微博', '知乎'];
    if (known.indexOf(v) >= 0) return v;
    var mapped = PLATFORM_MAP[v.toLowerCase()] || PLATFORM_MAP[v];
    return mapped || null;
  }

  function parseCsvLine(line) {
    var out = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  function normalizeHeader(h) {
    return String(h).trim().toLowerCase().replace(/\s+/g, '_');
  }

  function parseMetricCsv(text) {
    var lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) {
      return { records: [], skipped: 0, errors: ['CSV 至少需要表头 + 一行数据'] };
    }
    var headers = parseCsvLine(lines[0]).map(normalizeHeader);
    // 兼容中文表头
    var alias = {
      '日期': 'date', '平台': 'platform', '播放': 'views', '阅读': 'views', 'views': 'views',
      '互动': 'engagements', 'engagements': 'engagements', '点赞': 'likes', 'likes': 'likes',
      '评论': 'comments', 'comments': 'comments', '转发': 'shares', 'shares': 'shares',
      '收藏': 'favorites', 'favorites': 'favorites', '涨粉': 'followers', 'followers': 'followers',
      'followers_delta': 'followers', '标题': 'title', 'title': 'title', '备注': 'note', 'note': 'note',
      'date': 'date', 'platform': 'platform'
    };
    headers = headers.map(function (h) { return alias[h] || h; });
    if (headers.indexOf('date') < 0 || headers.indexOf('platform') < 0) {
      return { records: [], skipped: 0, errors: ['缺少必要列：date, platform（可用中文：日期,平台）'] };
    }
    var records = [];
    var errors = [];
    var skipped = 0;
    for (var i = 1; i < lines.length; i++) {
      var cols = parseCsvLine(lines[i]);
      var row = {};
      headers.forEach(function (h, idx) { row[h] = cols[idx] || ''; });
      var date = (row.date || '').trim();
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push('第 ' + (i + 1) + ' 行：日期无效（需 YYYY-MM-DD）');
        skipped++;
        continue;
      }
      var platform = normalizePlatform(row.platform || '');
      if (!platform) {
        errors.push('第 ' + (i + 1) + ' 行：未知平台「' + row.platform + '」');
        skipped++;
        continue;
      }
      var num = function (k) {
        var v = (row[k] || '').trim();
        if (!v) return 0;
        var n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      var engagements = num('engagements');
      var likes = num('likes');
      var comments = num('comments');
      var shares = num('shares');
      var favorites = num('favorites');
      // 若只有 engagements，按点赞近似拆分
      if (engagements && !likes && !comments && !shares && !favorites) {
        likes = engagements;
      }
      records.push({
        date: date,
        platform: platform,
        title: (row.title || '').trim() || ('导入-' + date + '-' + platform),
        views: num('views'),
        likes: likes,
        comments: comments,
        shares: shares,
        favorites: favorites,
        followers: num('followers'),
        note: (row.note || '').trim() || (row.title ? 'CSV导入' : 'CSV导入')
      });
    }
    return { records: records, skipped: skipped, errors: errors };
  }

  /* ---- T+3 ---- */
  var MS_DAY = 86400000;

  function getTopicPublishedAt(topic, dataRecords) {
    if (topic.publishedAt) return topic.publishedAt;
    if (topic.published_at) return topic.published_at;
    // 回退：关联数据最早日期 / 更新时间
    var related = (dataRecords || []).filter(function (d) {
      return d.topicId === topic.id || (d.title && topic.title && d.title === topic.title);
    });
    if (related.length) {
      related.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      return related[0].date + 'T00:00:00.000Z';
    }
    return topic.updatedAt || topic.createdAt || null;
  }

  function getReviewDebts(topics, dataRecords) {
    var now = Date.now();
    return (topics || [])
      .filter(function (t) { return t.status === '已发布'; })
      .filter(function (t) { return !t.t3Cleared && !t.t3_cleared; })
      .map(function (t) {
        var pub = getTopicPublishedAt(t, dataRecords);
        return { topic: t, publishedAt: pub };
      })
      .filter(function (x) {
        if (!x.publishedAt) return false;
        var pub = new Date(x.publishedAt).getTime();
        return now - pub >= 3 * MS_DAY;
      })
      .sort(function (a, b) {
        return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      });
  }

  function daysSince(iso) {
    if (!iso) return 0;
    return Math.floor((Date.now() - new Date(iso).getTime()) / MS_DAY);
  }

  global.OPCAi = {
    DEFAULT_AI: DEFAULT_AI,
    loadAiSettings: loadAiSettings,
    saveAiSettings: saveAiSettings,
    hasAiKey: hasAiKey,
    chatCompletion: chatCompletion,
    testAiConnection: testAiConnection,
    extractJsonObject: extractJsonObject,
    Prompts: Prompts,
    loadRssSources: loadRssSources,
    saveRssSources: saveRssSources,
    fetchRssFeed: fetchRssFeed,
    parseRssXml: parseRssXml,
    parseMetricCsv: parseMetricCsv,
    normalizePlatform: normalizePlatform,
    getReviewDebts: getReviewDebts,
    getTopicPublishedAt: getTopicPublishedAt,
    daysSince: daysSince,
    AiError: AiError
  };
})(typeof window !== 'undefined' ? window : this);
