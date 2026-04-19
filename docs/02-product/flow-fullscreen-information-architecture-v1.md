# Flow 全屏信息架构与视觉层级规格 v1

## 定位

`Flow` 是状态前台，不是播放前台。

目标：

- 快速进入状态
- 长时间观看不疲劳
- 保留最少必要控制

## 四层结构

1. `Background Layer`
2. `Main Visual Layer`
3. `State Title Layer`
4. `Control Overlay`

## 一级信息

- 当前状态名：`FOCUS / RELAX / SLEEP / FLOW`

## 二级信息

- 副标题
- 极弱播放存在感

## 三级信息

- 音量
- 播放/暂停
- 返回 Overview / 去 Listen / 去 Screen

## 状态语义

- `focus`：收束、冷静、低波动
- `relax`：暖、缓、展开
- `sleep`：极暗、极静、低刺激
- `flow`：连续、推进、层叠波动

## 实现原则

- 主视觉优先 `Canvas 2D`
- 标题只做轻呼吸
- 不允许高频闪烁、强弹跳、快速色闪
