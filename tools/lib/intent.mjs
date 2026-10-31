/**
 * 意图断言记账。
 *
 * 契约的老判据是「改一个属性后画面有变化」——它奖励噪声：挪 1px 算过，
 * 真正该守的东西（focus 必须变钴蓝）反而可能因为别处变化而蒙混过关。
 *
 * 14.0 起把每个被探针测到的属性分成三类：
 *   intent —— effect 里写了 expect / values，断言"改成什么"
 *   loose  —— 只要求"有变化"，靠预算递减
 *   any    —— 连"哪个元素变化"都不限定（最松，另一条预算）
 *
 * 这份记账是静态的：不跑浏览器就能算出比例，所以它可以当门禁的常驻指标。
 */
import { EFFECTS } from '../../src/effects.mjs';
import { TAGS, TAG_NAMES } from '../../src/registry.mjs';
import { PROBES, EFFECT_OVERRIDES } from './contract-probes.mjs';

/** 只要求"有变化"的上限。每收紧一批，就把这个数字改小，不许改大。 */
export const LOOSE_BUDGET = 51;
/** 完全不限定目标元素的上限。 */
export const ANY_BUDGET = 16;

export function intentStats() {
  const out = { intent: [], loose: [], any: [], skipped: 0 };
  for (const tag of TAG_NAMES) {
    const effs = EFFECTS[tag] || {};
    for (const name of Object.keys(TAGS[tag].attrs || {})) {
      const spec = TAGS[tag].attrs[name];
      if (spec.motion || spec.pose || spec.context || spec.build) {
        out.skipped++;
        continue;
      }
      const key = `${tag}.${name}`;
      const probe = PROBES[tag]?.[name];
      const eff = EFFECT_OVERRIDES[key] || probe?.effect || effs[name];
      if (!eff) continue;
      if (eff.kind === 'any') {
        out.any.push(key);
        continue;
      }
      const hasIntent = !!(eff.expect || eff.values || probe?.values?.length || spec.values || eff.kind === 'text');
      (hasIntent ? out.intent : out.loose).push(key);
    }
  }
  return out;
}
