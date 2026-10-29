/**
 * 由 registry 生成类型与一份 Markdown 参考。
 * 示例不在这里：示例只有一份，在 src/scenes/ 里，主页和 specimen 都从它生成。
 */
import fs from 'node:fs';
import { TAGS, LAYERS, TAG_NAMES, byLayer, validate, CHILDREN, STATES } from '../src/registry.mjs';
import { SCENES } from '../src/scenes/scenes.mjs';
import { ICONS } from '../src/icons.generated.mjs';
import { writeIfChanged, checkMode } from './lib/io.mjs';

const check = checkMode();

const errors = validate();
if (errors.length) {
  console.error('registry 校验失败：');
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

const pascal = (tag) => tag.replace(/^vk-/, '').replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

/* ---------------------------------------------------------------- types */

const ctxOf = (spec) =>
  spec.context === 'canvas-child' ? '仅 canvas 子节点' : spec.context === 'grid-child' ? '仅 grid 子项' : '';

const attrType = (spec, tag, name) => {
  if (tag === 'vk-icon' && name === 'name') return 'IconName';
  if (spec.values) return spec.values.map((v) => `'${v}'`).join(' | ');
  if (spec.type === 'num' || spec.type === 'int') return 'number | string';
  if (spec.type === 'size') return 'number | string';
  if (spec.type === 'bool') return 'boolean | \'\'';
  return 'string';
};

const iface = (tag) => {
  const def = TAGS[tag];
  const rows = Object.entries(def.attrs || {}).map(([name, spec]) => {
    const doc = `${spec.values ? `${name}: ${spec.values.join(' / ')}` : `${name}${spec.default !== undefined ? `（默认 ${spec.default}）` : ''}`}${spec.build ? ' · 构建期' : ''}${spec.context ? ` · ${ctxOf(spec)}` : ''}`;
    return `  /** ${doc} */\n  '${name}'?: ${attrType(spec, tag, name)};`;
  });
  return `export interface ${pascal(tag)}Attributes {\n${rows.join('\n')}\n}`;
};

const elementName = (tag) => `Vk${pascal(tag)}Element`;

const elementDecl = (tag) =>
  `/** <${tag}> 的元素实例；属性仍走 attribute，事件走 addEventListener。 */\nexport interface ${elementName(tag)} extends HTMLElement {}`;

const dts = `/* 由 tools/gen.mjs 从 src/registry.mjs 生成 —— 不要手改 */
import type { IconName } from './icons';

export type { IconName } from './icons';

export interface VkGlobalAttributes {
  id?: string;
  class?: string;
  className?: string;
  style?: string;
  title?: string;
  role?: string;
  tabindex?: number | string;
  /** 画布子元素通用坐标（只有 vk-canvas 读取） */
  x?: number | string;
  y?: number | string;
  [key: \`data-\${string}\`]: unknown;
  [key: \`aria-\${string}\`]: unknown;
}

${TAG_NAMES.map(iface).join('\n\n')}

${TAG_NAMES.map(elementDecl).join('\n')}

export interface VkApi {
  version: string;
  /** 等所有组件、fetch、字体、图片、布局就绪；超时返回 false。 */
  ready(): Promise<boolean>;
  layout(): void;
  /** 扫描组件内容溢出；门禁与作者自检共用。 */
  auditOverflow(root?: ParentNode): Array<{
    tag: string;
    cls?: string;
    sel?: string;
    sw: number;
    cw: number;
    sh: number;
    ch: number;
  }>;
  /** 结构自检：字号 / 对比度 / 安全区 / 溢出 / 裁切 / 重叠 / 空锚点。 */
  auditPage(root?: ParentNode): {
    issues: Array<{ type: string; what?: string; [key: string]: unknown }>;
    special: string[];
  };
}

export const vk: VkApi;
export default vk;

declare global {
  interface Window {
    vk: VkApi;
  }

  interface HTMLElementTagNameMap {
${TAG_NAMES.map((t) => `    '${t}': ${elementName(t)};`).join('\n')}
  }

  namespace JSX {
    interface IntrinsicElements {
${TAG_NAMES.map((t) => `      '${t}'?: Partial<${pascal(t)}Attributes> & VkGlobalAttributes & { children?: unknown };`).join('\n')}
    }
  }
}
`;

fs.mkdirSync('types', { recursive: true });
const iconNames = Object.keys(ICONS).sort();
writeIfChanged(
  'types/icons.d.ts',
  `/* 由 tools/gen.mjs 从 lucide 全量生成 —— 不要手改 */\nexport type IconName =\n  | ${iconNames
    .map((n) => JSON.stringify(n))
    .join('\n  | ')};\n`,
  check
);
writeIfChanged('types/index.d.ts', dts, check);

/* Custom Elements Manifest：给 IDE / 其它层一个标准入口，不用猜。 */
const cem = {
  schemaVersion: '1.0.0',
  readme: 'README.md',
  modules: [
    {
      kind: 'javascript-module',
      path: 'dist/vk.js',
      declarations: TAG_NAMES.map((tag) => {
        const def = TAGS[tag];
        return {
          kind: 'class',
          name: `${pascal(tag)}Element`,
          tagName: tag,
          description: `${def.summary}（${def.name}）`,
          attributes: Object.entries(def.attrs || {})
            .filter(([, spec]) => spec.context !== 'canvas-child')
            .map(([name, spec]) => ({
              name,
              description: spec.label || name,
              default: spec.default ?? undefined,
              type: {
                text: spec.values
                  ? spec.values.map((v) => `'${v}'`).join(' | ')
                  : spec.type === 'num' || spec.type === 'int' || spec.type === 'size'
                    ? 'number | string'
                    : spec.type === 'bool'
                      ? 'boolean'
                      : 'string',
              },
            })),
          slots: def.slots || [],
        };
      }),
    },
  ],
};
writeIfChanged('custom-elements.json', JSON.stringify(cem, null, 2) + '\n', check);

/* ------------------------------------------------ AI 契约（唯一入口） */

const sceneOf = new Map(SCENES.map((s) => [s.tag, s.body]));
const openTagOf = (tag) => {
  const m = String(sceneOf.get(tag) || '').match(new RegExp(`<${tag}\\b[^>]*>`));
  return m ? m[0] : `<${tag}>`;
};
const spec = {
  name: 'vk',
  version: 12,
  note: '由 src/registry.mjs 生成；AI 的唯一契约。属性分组：content / appearance / state / layout（layout 是协议，不属于组件 API）。',
  layers: LAYERS,
  tags: Object.fromEntries(
    TAG_NAMES.map((tag) => {
      const def = TAGS[tag];
      return [
        tag,
        {
          name: def.name,
          layer: def.layer,
          summary: def.summary,
          attrs: Object.fromEntries(
            Object.entries(def.attrs || {}).map(([name, s]) => [
              name,
              {
                type: s.values ? 'enum' : s.type || 'text',
                ...(s.values ? { values: s.values } : {}),
                ...(s.default !== undefined ? { default: s.default } : {}),
                ...(s.label ? { label: s.label } : {}),
                ...(s.effect ? { effect: s.effect } : {}),
                ...(s.content ? { content: true } : {}),
                ...(s.group ? { group: s.group } : {}),
                ...(s.context ? { context: s.context } : {}),
                ...(s.layout ? { layout: true } : {}),
                ...(s.build ? { build: true } : {}),
              },
            ])
          ),
          ...(CHILDREN[tag] ? { children: CHILDREN[tag] } : {}),
          ...(STATES[tag] ? { states: STATES[tag] } : {}),
          ...(def.slots ? { slots: def.slots } : {}),
          example: openTagOf(tag),
        },
      ];
    })
  ),
};
fs.mkdirSync('docs', { recursive: true });
writeIfChanged('spec.json', JSON.stringify(spec, null, 2) + '\n', check);

/* ------------------------------------------------------------- reference */

const card = (tag) => {
  const def = TAGS[tag];
  const rows = Object.entries(def.attrs || {})
    .map(([name, spec]) => {
      const v = spec.values ? spec.values.map((x) => `\`${x}\``).join(' · ') : spec.type;
      const d = spec.default === undefined ? '—' : `\`${spec.default}\``;
      const ctx = ctxOf(spec);
      return `| \`${name}\` | ${v} | ${d} | ${spec.build ? '构建期' : '运行'}${ctx ? ` · ${ctx}` : ''} |`;
    })
    .join('\n');
  const slotText = def.slots?.length
    ? `\n槽：${def.slots.map((s) => `\`${s.name}\``).join(' · ')}\n`
    : '';
  return `### \`${tag}\` · ${def.name}

${def.summary}
${slotText}
${rows ? `| 属性 | 值 | 默认 | 生效 |\n|---|---|---|---|\n${rows}` : '_无属性_'}
`;
};

const md = `# vk 组件参考

> 由 \`tools/gen.mjs\` 从 \`src/registry.mjs\` 生成 —— 不要手改。
> ${TAG_NAMES.length} 个标签，L0–L5。每页的 API 镜头与 [标本册](../index.html) 同源；属性表由 registry 生成。

${LAYERS.filter((l) => byLayer(l.id).length)
  .map((l) => `## ${l.label} · ${l.note}\n\n${byLayer(l.id).map(card).join('\n')}`)
  .join('\n')}
`;

fs.mkdirSync('docs', { recursive: true });
writeIfChanged('docs/reference.md', md, check);

const choosing = `# 选组件

> 由 \`tools/gen.mjs\` 从 registry 生成。先按"要做什么"选，再去看属性。

${LAYERS.filter((l) => byLayer(l.id).length)
  .map(
    (l) =>
      `## ${l.label}\n\n| 标签 | 做什么 |\n|---|---|\n${byLayer(l.id)
        .map((tag) => `| \`${tag}\` | ${TAGS[tag].summary} |`)
        .join('\n')}`
  )
  .join('\n\n')}
`;
writeIfChanged('docs/choosing.md', choosing, check);


console.log(`registry ok：${TAG_NAMES.length} 个标签`);
for (const l of LAYERS) {
  const n = byLayer(l.id).length;
  if (n) console.log(`  ${l.label.padEnd(8)} ${String(n).padStart(2)}  ${byLayer(l.id).join(' ')}`);
}
console.log(`  types/index.d.ts  ${(fs.statSync('types/index.d.ts').size / 1024).toFixed(1)}kb`);
console.log(`  docs/reference.md ${(fs.statSync('docs/reference.md').size / 1024).toFixed(1)}kb`);
