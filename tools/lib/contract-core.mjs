/** 门禁的纯函数：可被 contract / self-test 单测，不启动浏览器。 */

export function diffSnap(a, b) {
  const out = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const ra = a[key] || {};
    const rb = b[key] || {};
    const props = new Set([...Object.keys(ra), ...Object.keys(rb)]);
    for (const p of props) {
      const va = ra[p];
      const vb = rb[p];
      if (va === vb) continue;
      if (
        (p === 'rect.w' || p === 'rect.h' || p === 'rect.x' || p === 'rect.y') &&
        Math.abs(Number(va) - Number(vb)) < 0.6
      ) {
        continue;
      }
      out.push({ key, prop: p, from: va, to: vb });
    }
  }
  return out;
}

/**
 * 把 `on` 选择器解析成一组 DOM 路径，再判断 diff 是否落在这些目标里。
 *
 * `targetPaths` 由调用方在页面内算好（空字符串 = 宿主本身）。
 * 没有 `on` 时不做子树限制：属性的效果可以出现在组件的任何后代上。
 */
export function targetMatcher(targetPaths) {
  if (!targetPaths || !targetPaths.length) return () => true;
  return (key) => targetPaths.some((p) => p === '' || key === p || key.startsWith(p + '/'));
}

/**
 * `expect` 是 effect 的可选断言面：
 *   undefined / 'changed'  → 只要值变了
 *   'rgb(...)' / 42        → 严格等于（字符串化后）
 *   /30% 70%/              → 正则命中新值
 *   ['a', 'b']             → 命中其一
 *   { to: 'x' }            → 新值等于 x
 *   { from: 'x' }          → 旧值等于 x
 *   { not: 'x' }           → 新值不等于 x
 *   { anyOf: [...] }       → 新值命中其一
 * 返回 { ok, detail }，detail 用于失败诊断。
 */
export function matchExpect(expect, diff) {
  if (expect === undefined || expect === null || expect === 'changed') return { ok: true };
  const to = diff?.to;
  const from = diff?.from;
  const eq = (want) => String(to) === String(want);
  let ok = false;
  let detail = '';

  if (expect instanceof RegExp) {
    ok = expect.test(String(to));
    detail = `期望 /${expect.source}/，实际 ${JSON.stringify(to)}`;
  } else if (Array.isArray(expect)) {
    ok = expect.some(eq);
    detail = `期望 ${JSON.stringify(expect)} 之一，实际 ${JSON.stringify(to)}`;
  } else if (typeof expect === 'object') {
    if ('to' in expect) {
      ok = eq(expect.to);
      detail = `期望新值 ${JSON.stringify(expect.to)}，实际 ${JSON.stringify(to)}`;
    } else if ('from' in expect) {
      ok = String(from) === String(expect.from);
      detail = `期望旧值 ${JSON.stringify(expect.from)}，实际 ${JSON.stringify(from)}`;
    } else if ('not' in expect) {
      ok = !eq(expect.not);
      detail = `期望新值 ≠ ${JSON.stringify(expect.not)}，实际 ${JSON.stringify(to)}`;
    } else if (Array.isArray(expect.anyOf)) {
      ok = expect.anyOf.some(eq);
      detail = `期望 ${JSON.stringify(expect.anyOf)} 之一，实际 ${JSON.stringify(to)}`;
    } else {
      throw new Error(`无法识别的 expect：${JSON.stringify(expect)}`);
    }
  } else {
    ok = eq(expect);
    detail = `期望 ${JSON.stringify(expect)}，实际 ${JSON.stringify(to)}`;
  }
  return { ok, detail };
}

export function effectHit(effect, diffs, beforeCount = 0, afterCount = 0, targetPaths = null) {
  if (!effect) return { ok: true, any: true, detail: '未声明 effect' };
  if (effect.kind === 'any') return { ok: true, any: true, detail: `effect:any（${effect.reason || '无理由'}）` };
  if (effect.kind === 'dom') {
    const ok = beforeCount !== afterCount;
    return { ok, detail: `${effect.prop} ${beforeCount}→${afterCount}` };
  }
  const prop =
    effect.kind === 'attr'
      ? '@' + effect.prop
      : effect.kind === 'text'
        ? '#text'
        : effect.kind === 'geometry'
          ? `rect.${effect.prop[0]}`
          : effect.prop;
  const inTarget = targetMatcher(targetPaths);
  const candidates = diffs.filter((d) => d.prop === prop && inTarget(d.key));
  if (!candidates.length) {
    return {
      ok: false,
      detail: `${effect.on || '<root>'} ${prop} 没有变化${targetPaths?.length ? `（目标 ${targetPaths.slice(0, 3).join(', ')}）` : ''}`,
    };
  }
  if (effect.expect !== undefined) {
    for (const d of candidates) {
      const m = matchExpect(effect.expect, d);
      if (m.ok) return { ok: true, detail: `${effect.on || '<root>'} ${prop}` };
    }
    const m = matchExpect(effect.expect, candidates[0]);
    return { ok: false, detail: `${effect.on || '<root>'} ${prop}: ${m.detail}` };
  }
  return { ok: true, detail: `${effect.on || '<root>'} ${prop}` };
}

export function valuesFor(spec, probe) {
  if (probe?.values?.length) return probe.values;
  if (spec.values) return spec.values;
  if (spec.type === 'bool') return ['__toggle__'];
  if (spec.type === 'num' || spec.type === 'int') {
    const base = Number(spec.default ?? 0) || 0;
    const vals = new Set();
    if (spec.min !== null && spec.min !== undefined) vals.add(Number(spec.min));
    if (spec.max !== null && spec.max !== undefined) vals.add(Number(spec.max));
    if (spec.step) vals.add(base + spec.step);
    if (!vals.size) vals.add(base + 100);
    return [...vals]
      .filter((v) => Number.isFinite(v))
      .filter((v) => spec.min === null || spec.min === undefined || v >= spec.min)
      .filter((v) => spec.max === null || spec.max === undefined || v <= spec.max)
      .slice(0, 3)
      .map(String);
  }
  return [];
}

const OK_TYPES = [
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'image/',
  'font/',
  'application/font',
  'image/svg+xml',
  'text/plain',
];

/** 浏览器能「看」的类型；markdown / octet-stream 不算。 */
export function contentTypeOk(type) {
  if (!type) return false;
  const t = String(type).toLowerCase().split(';')[0].trim();
  return OK_TYPES.some((ok) => t === ok || t.startsWith(ok));
}
