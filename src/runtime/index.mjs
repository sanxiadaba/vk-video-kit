/* vk runtime · 入口
   ----------------------------------------------------------------------------
   顺序有意义：
     base       命名空间 / 生命周期 / 布局调度
     elements   L1（纯 CSS，注册以让 ready 等它们定义完）
     layout     L2 画布与连线
     components L3
     compositions L4
   时间轴不在这里：本库只保证"静止帧即成品"，出场时间由编排层施加。
*/

import { VK } from './base.mjs';
import { defineElements } from './elements.mjs';
import { defineLayout } from './layout.mjs';
import { defineCode } from './code.mjs';
import { defineDiff } from './diff.mjs';
import { defineComponents } from './components.mjs';
import { defineCompositions } from './compositions.mjs';
import { defineAsm } from './asm.mjs';
import { defineTimeline } from './timeline.mjs';
import { defineOverlays } from './overlays.mjs';
import { installAudit } from './audit.mjs';

defineElements();
defineLayout();
defineCode();
defineDiff();
defineComponents();
defineCompositions();
defineAsm();
defineTimeline();
defineOverlays();
installAudit(VK);

export { VK };
export default VK;
