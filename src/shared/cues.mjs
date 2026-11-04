/**
 * 字幕轨（cue track）的唯一解析层。
 *
 * 运行期（src/runtime/cues.mjs）与 CLI（vk capture --cues）共用这一份：
 *   · cue.json  { start, end, text, focus?, state? }
 *   · .srt      标准 SRT；额外的 focus=#id / state=b 行会被当成元数据，不显示
 *
 * 时间一律归一成「秒」。支持 3 / 0:06 / 00:00:06,500 / 1:02:03.250 四种写法。
 * 这一层不碰 DOM，纯函数，测试可以直接 import。
 */

const NUM = /^\d+(?:\.\d+)?$/;

/** 一个时间点 → 秒。数字按秒；字符串按 mm:ss / hh:mm:ss（可带毫秒）。 */
export function parseClock(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, raw) : null;
  const text = String(raw).trim().replace(',', '.');
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    if (!NUM.test(part)) return null;
    seconds = seconds * 60 + Number(part);
  }
  return Math.max(0, seconds);
}

/** `0:06-0:09` / `00:00:06,000 --> 00:00:09,000`（→ 只取两端）→ { start, end }。 */
export function parseRange(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^(.+?)\s*(?:-->|–|—|至|-)\s*(.+)$/);
  if (!match) return null;
  const start = parseClock(match[1]);
  const end = parseClock(match[2]);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** 秒 → `m:ss`（字幕条 / 调试用，不参与求值）。 */
export function formatClock(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 一条 cue 的归一化：起止、文字、focus / state / page。 */
export function normalizeCue(item, index = 0) {
  const start = parseClock(item?.start ?? item?.from ?? item?.t);
  const endRaw = parseClock(item?.end ?? item?.to);
  if (start == null) throw new Error(`第 ${index + 1} 条 cue 缺少 start（秒或 0:06）`);
  const end = endRaw == null ? start + 1 : endRaw;
  if (end <= start) throw new Error(`第 ${index + 1} 条 cue 的 end 必须大于 start`);
  const cue = {
    start,
    end,
    text: cleanText(item?.text ?? item?.caption ?? item?.subtitle ?? ''),
  };
  // 只带作者真写了的字段，避免下游把空字符串当成"有焦点"。
  for (const key of ['focus', 'state', 'page', 'id']) {
    if (item?.[key] != null && String(item[key]).trim() !== '') cue[key] = String(item[key]).trim();
  }
  return cue;
}

/** 数组（或 { cues: [...] }）→ 按 start 排序、带 1 起 index 的轨道。 */
export function normalizeCues(list) {
  if (!Array.isArray(list)) throw new Error('cue 数据必须是数组，或 { "cues": [...] }');
  return list
    .map((item, i) => normalizeCue(item, i))
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((cue, i) => ({ ...cue, index: i + 1 }));
}

/**
 * SRT：空行分块；块首可有序号；时间行 `00:00:00,000 --> 00:00:03,000`。
 * 文本里 `focus=#id` / `state=b` / `page=2` 单独成行时作为元数据剥离；
 * 其余行按空格拼成字幕文本。
 */
export function parseSrt(text) {
  const source = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
  const cues = [];
  for (const block of source.split(/\n{2,}/)) {
    const lines = block
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== '');
    if (!lines.length) continue;

    let timingIndex = -1;
    let timing = null;
    for (let i = 0; i < Math.min(2, lines.length); i++) {
      const match = lines[i].match(/^(.+?)\s*-->\s*(.+)$/);
      if (match) {
        timingIndex = i;
        timing = match;
        break;
      }
    }
    if (!timing) continue;

    const start = parseClock(timing[1].trim().split(/\s+/)[0]);
    const end = parseClock(timing[2].trim().split(/\s+/)[0]);
    if (start == null || end == null || end <= start) continue;

    const meta = {};
    const textLines = [];
    for (const line of lines.slice(timingIndex + 1)) {
      const match = line.match(/^\s*(focus|state|page)\s*[:=]\s*(.+?)\s*$/i);
      if (match) meta[match[1].toLowerCase()] = match[2].replace(/^["']|["']$/g, '').trim();
      else textLines.push(line.trim());
    }
    cues.push({ start, end, text: textLines.join(' ').trim(), ...meta });
  }
  return normalizeCues(cues);
}

/** JSON 文本 / 已解析对象 → 轨道。 */
export function parseCueJson(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const list = Array.isArray(data) ? data : Array.isArray(data?.cues) ? data.cues : null;
  if (!list) throw new Error('cue JSON 必须是数组或 { "cues": [...] }');
  return normalizeCues(list);
}

/** 自动认：以 [ / { 开头的是 JSON，其余按 SRT。 */
export function parseCueSource(text, format = '') {
  const source = String(text ?? '').trim();
  if (!source) return [];
  const kind = String(format || '').toLowerCase();
  if (kind === 'json' || (!kind && /^[[{]/.test(source))) return parseCueJson(source);
  return parseSrt(source);
}

/**
 * 组件属性 cue="…" 的三种写法：
 *   "3"          第 3 条 cue（1 起）
 *   "0:06-0:09"  绝对时间段
 *   "0:06"       从 0:06 起一直可见
 * 认不出返回 null（运行期只警告一次，不静默改画面）。
 */
export function parseCueRef(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return { kind: 'index', index: Math.max(1, parseInt(text, 10)) };
  const range = parseRange(text);
  if (range) return { kind: 'range', ...range };
  const start = parseClock(text);
  if (start != null) return { kind: 'from', start };
  return null;
}

/** 这条 cue 元素在 t 时刻该处于 before / on / after。 */
export function cuePhase(ref, track, t) {
  if (!ref) return null;
  if (ref.kind === 'index') {
    const cue = track[ref.index - 1];
    if (!cue) return null;
    if (t < cue.start) return 'before';
    if (t >= cue.end) return 'after';
    return 'on';
  }
  if (ref.kind === 'range') {
    if (t < ref.start) return 'before';
    if (t >= ref.end) return 'after';
    return 'on';
  }
  if (ref.kind === 'from') return t < ref.start ? 'before' : 'on';
  return null;
}
