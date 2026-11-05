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
import { definePair } from './pair.mjs';
import { defineFlow } from './flow.mjs';
import { defineCode } from './code.mjs';
import { defineDiff } from './diff.mjs';
import { defineComponents } from './components.mjs';
import { defineCompositions } from './compositions.mjs';
import { defineScene } from './scene.mjs';
import { defineAsm } from './asm.mjs';
import { defineTimeline } from './timeline.mjs';
import { defineAnnotate } from './annotate.mjs';
import { defineNote } from './note.mjs';
import { installAudit } from './audit.mjs';
import { installDirector } from './director.mjs';
import { installCues } from './cues.mjs';
import { installPose } from './pose.mjs';

defineElements();
defineLayout();
definePair();
defineFlow();
defineCode();
defineDiff();
defineComponents();
defineCompositions();
// 图示语汇：五种讲解动作的组合容器（pair / flow / steps 的组合层）。
defineScene();
defineAsm();
defineTimeline();
// 关系层：vk-annotate 是本体，vk-edge 是箭头形态的旧入口。
defineAnnotate();
// 注解原语：边注 / 气泡 / 编号图例。
defineNote();
installAudit(VK);
installDirector(VK);
// 视频维度：字幕轨驱动焦点 / 同页多态 / 页间转场。装在 director 之后，包住 seek。
installCues(VK);
installPose(VK);

export { VK };
export default VK;


