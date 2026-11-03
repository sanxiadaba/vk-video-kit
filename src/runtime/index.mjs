/* vk runtime · 入口
   ----------------------------------------------------------------------------
   顺序有意义：
     base       命名空间 / 生命周期 / 布局调度
     elements   L1（纯 CSS，注册以让 ready 等它们定义完）
     layout     L2 画布与连线
     components L3
     compositions L4
   L6 director 只做「时刻 → 姿态」的求值，不做播放器：poster 仍是成品静帧。
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
import { defineAnnotate } from './annotate.mjs';
import { defineNote } from './note.mjs';
import { installAudit } from './audit.mjs';
import { installDirector } from './director.mjs';
import { installPose } from './pose.mjs';

defineElements();
defineLayout();
defineCode();
defineDiff();
defineComponents();
defineCompositions();
defineAsm();
defineTimeline();
// 关系层：vk-annotate 是本体，vk-edge / vk-pin / vk-ring 是它的旧名字。
defineAnnotate();
// 注解原语：边注 / 编号图例（不是气泡）。
defineNote();
defineOverlays();
installAudit(VK);
installDirector(VK);
installPose(VK);

export { VK };
export default VK;


