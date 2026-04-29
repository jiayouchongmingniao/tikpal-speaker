# Overview 到 Focus 的转场与手势规格 v1

## 核心原则

- 不能像页面跳转
- 必须是卡片放大到前台
- 返回时是全屏收束回卡片

## Overview -> Focus

### Step 1

- 目标卡片确认
- 轻微提亮与放大

### Step 2

- 目标卡片扩展到接近全屏
- 其他两卡退场

### Step 3

- 摘要内容淡出
- 全屏内容淡入

### Step 4

- 模式稳定，启用该模式完整交互

总时长建议：`420ms - 620ms`

## Focus -> Overview

### Step 1

- 当前模式收束

### Step 2

- 主模式缩回原卡片位置
- 其他两卡返回

### Step 3

- Overview 稳定

总时长建议：`360ms - 520ms`

## Focus <-> Focus

- 允许直接横向接力切换
- 不应先回 Overview 再放大

## 推荐手势

- 单击卡片主区：进入全屏
- 双指捏合：返回 Overview
- 单击空白：显示控制层
- 可选单指横滑：切相邻模式
- `Flow` 中可选双指下滑：切下一个 `focus / flow / relax / sleep` 子状态

## Flow 特殊手势

- 双指下滑只在 `focused_flow` 内生效
- 顺序固定为 `focus -> flow -> relax -> sleep -> focus`
- 双指下滑不应先返回 `Overview`，而应在 `Flow` 内部完成状态接力
- pinch 返回 `Overview` 仍保持更高优先级
