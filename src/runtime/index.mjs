/* v17 runtime · 入口
   顺序有意义：底座 → 画布 → 排布 → 面与字 → 内容 → 图 → 关系 → 自检。 */
import { VK } from './base.mjs';
import { definePage } from './page.mjs';
import { defineLayout } from './layout.mjs';
import { defineElements } from './elements.mjs';
import { defineCode } from './code.mjs';
import { defineData } from './data.mjs';
import { defineDiagram } from './diagram.mjs';
import { defineCallout } from './callout.mjs';
import { installAudit } from './audit.mjs';

definePage();
defineLayout();
defineElements();
defineCode();
defineData();
defineDiagram();
defineCallout();
installAudit(VK);

export { VK };
export default VK;
