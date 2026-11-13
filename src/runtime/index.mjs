/**
 * v23 · 运行期入口
 * ----------------------------------------------------------------------------
 * 构建期已经把结构写完了；这里只注册需要测量的件，并暴露 vk.ready。
 * 自检不在这里：它单独打进 dist/audit.js，避免每张交付页都背一份测量代码。
 */
import './base.mjs';
import './elements.mjs';
import './callout.mjs';
import './graph.mjs';
