import test from 'node:test';
import assert from 'node:assert/strict';
import { autoSide, orthoPoints, connectorGeometry, pointOn, roundedPath, visualToLocal } from '../src/runtime/geometry.mjs';

const box = (x, y, w, h) => ({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });

test('上下叠放 → bottom / top', () => {
  const a = box(100, 0, 200, 100);
  const b = box(100, 200, 200, 100);
  assert.deepEqual(autoSide(a, b), ['bottom', 'top']);
});

test('左右并排 → right / left', () => {
  const a = box(0, 0, 100, 100);
  const b = box(300, 0, 100, 100);
  assert.deepEqual(autoSide(a, b), ['right', 'left']);
});

test('锚点落在边中点', () => {
  const a = box(10, 20, 100, 60);
  assert.deepEqual(pointOn(a, 'bottom'), { x: 60, y: 80, side: 'bottom' });
  assert.deepEqual(pointOn(a, 'left'), { x: 10, y: 50, side: 'left' });
});

test('线从起点边框出发，箭头尖端落在终点边框上', () => {
  const a = box(100, 0, 200, 100);
  const b = box(100, 300, 200, 100);
  const pts = orthoPoints(a, b, 'bottom', 'top', 16);
  assert.equal(pts[0].x, 200);
  assert.equal(pts[0].y, 100);
  assert.equal(pts[pts.length - 1].x, 200);
  // 终点就在节点边框上：箭头尖端贴住目标，不在边缘前留空隙
  assert.equal(pts[pts.length - 1].y, 300);
});

test('上下对齐的连线是一条直线，不留假拐点', () => {
  // 两个盒子中心对齐时，折线就是一条竖线：多出来的中间点只会生成假圆角
  const a = box(100, 0, 200, 100);
  const b = box(100, 300, 200, 100);
  const pts = orthoPoints(a, b, 'bottom', 'top', 16);
  assert.equal(pts.length, 2, `直线不该有中间点：${JSON.stringify(pts)}`);
});

test('错位的连线至少有一个直角拐点', () => {
  const a = box(0, 0, 100, 100);
  const b = box(400, 300, 100, 100);
  const pts = orthoPoints(a, b, 'right', 'top', 32);
  assert.ok(pts.length >= 3, '应该有中间拐点');
  // 每一段都必须是水平或垂直：正交折线里不能出现斜线
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i - 1].x);
    const dy = Math.abs(pts[i].y - pts[i - 1].y);
    assert.ok(dx < 0.5 || dy < 0.5, `第 ${i} 段是斜线：${JSON.stringify([pts[i - 1], pts[i]])}`);
  }
});

test('竖向连线对齐到对方的投影，不跳到对方中心', () => {
  const a = box(0, 0, 100, 100); // 中心 x=50
  const b = box(300, 300, 400, 100); // 中心 x=500，但 a 在左边
  const g = connectorGeometry({ from: a, to: b, s1: 'bottom', s2: 'top', shape: 'ortho', gap: 24 });
  // 顶锚点应落在 b 上 x=50 的位置（被 28px 圆角钳制到 328）
  assert.ok(g.tip.x <= 360 && g.tip.x >= 300, `顶锚点 x=${g.tip.x} 不在 b 的左边一侧`);
});

test('正交折线不含零长线段', () => {
  const a = box(0, 0, 100, 40);
  const b = box(0, 100, 100, 40);
  const pts = orthoPoints(a, b, 'bottom', 'top', 16);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    assert.ok(d > 0.4, `第 ${i} 段长度为 ${d}`);
  }
});

test('圆角路径以 M 开头并包含 Q', () => {
  const d = roundedPath([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }], 16);
  assert.ok(d.startsWith('M0 0'));
  assert.ok(d.includes('Q'));
});

test('连线的箭头方向朝向终点', () => {
  const a = box(0, 0, 100, 100);
  const b = box(0, 300, 100, 100);
  const g = connectorGeometry({ from: a, to: b, s1: 'bottom', s2: 'top', shape: 'ortho', gap: 16 });
  // 终点在下方：角度应该接近 90°（向下）
  assert.ok(Math.abs(g.tip.angle - Math.PI / 2) < 0.01, `angle=${g.tip.angle}`);
  assert.ok(g.d.length > 0);
});

test('三种形状都能出路径', () => {
  const a = box(0, 0, 100, 100);
  const b = box(300, 200, 100, 100);
  for (const shape of ['ortho', 'curve', 'line']) {
    const g = connectorGeometry({ from: a, to: b, s1: 'bottom', s2: 'top', shape });
    assert.ok(g.d.startsWith('M'), `${shape} 没有路径`);
    assert.ok(Number.isFinite(g.tip.x) && Number.isFinite(g.tip.y), `${shape} 箭头坐标异常`);
  }
});

test('缩放容器里的视觉 rect 要换回布局坐标', () => {
  // 1920 的画布被 scale(1/3) 塞进 640：视觉 400，布局 1200。
  // 子元素视觉 left 233.33 对应布局 700；除以 3 会得到 77.7，整个箭头会缩到左上角。
  const host = { left: 360, top: 420, width: 400, height: 80 };
  const child = { left: 360 + 233.3333, top: 420 + 39, width: 66.6667, height: 26.6667 };
  const p = visualToLocal(child, host, 1200);
  assert.ok(Math.abs(p.x - 700) < 0.01, `x=${p.x}`);
  assert.ok(Math.abs(p.y - 117) < 0.01, `y=${p.y}`);
  assert.ok(Math.abs(p.w - 200) < 0.01, `w=${p.w}`);
});

