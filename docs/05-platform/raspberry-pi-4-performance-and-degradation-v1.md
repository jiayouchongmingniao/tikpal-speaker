# 树莓派 4 性能预算与降级实施细则 v1

## 性能目标

- 理想：`60fps`
- 可接受并作为 Pi4 发布门禁：`30fps+`
- 持续低于 `30fps` 必须触发更激进的降级或进入 GPU PoC 对照

## 优先级

1. 音频连续性
2. 输入响应
3. UI 稳定
4. 视觉效果

## 模式预算

### Overview

- 最严格
- 三卡都只能是摘要态

### Listen

- 低到中预算
- DOM/CSS 为主

### Screen

- 低到中预算
- 秒级计时

### Flow

- 最高视觉预算
- 但仅限 `focused_flow`

## 三档性能模式

### normal

- Overview 有轻微动画
- Flow 允许 2 层波形和少量粒子

### reduced

- 非高亮卡基本静态
- Flow 去粒子，保留简化波形

### safe

- Overview 几乎静态
- Flow 退化为渐变 + 极简漂移

## 硬规则

- 只能有一个主视觉 RAF
- 非聚焦区域低频更新
- Card 不得复用完整 Page
- 避免高成本 blur / shadow / backdrop-filter
