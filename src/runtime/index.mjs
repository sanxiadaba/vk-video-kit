/* vk runtime · 入口
   ----------------------------------------------------------------------------
   顺序有意义：base 提供生命周期与布局调度，元素/排布先注册，数据组件后注册，
   关系层最后（它要量前两者的盒子）。
   库里没有时间维度：没有 director、没有 cue、没有播放器。
*/

import { VK } from './base.mjs';
import { defineElements } from './elements.mjs';
import { defineLayout } from './layout.mjs';
import { definePair } from './pair.mjs';
import { defineFlow } from './flow.mjs';
import { defineCode } from './code.mjs';
import { defineDiff } from './diff.mjs';
import { defineComponents } from './components.mjs';
import { definePage } from './page.mjs';
import { defineAsm } from './asm.mjs';
import { defineTimeline } from './timeline.mjs';
import { defineAnnotate } from './annotate.mjs';
import { defineNote } from './note.mjs';
import { installAudit } from './audit.mjs';

defineElements();
defineLayout();
definePair();
defineFlow();
defineCode();
defineDiff();
defineComponents();
definePage();
defineAsm();
defineTimeline();
defineAnnotate();
defineNote();
installAudit(VK);

export { VK };
export default VK;
