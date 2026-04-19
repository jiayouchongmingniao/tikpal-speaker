# Screen 信息架构与外部 API 接入规格 v1

## 定位

`Screen` 是任务与节奏表面，不是完整效率软件。

它回答：

- 我现在在做什么
- 我还剩多久
- 我接下来做什么

## 数据来源

- 本机原生状态：时间、番茄钟、播放状态
- 外部连接器：Calendar、Todoist
- 系统整理结果：`ScreenContext`

## 信息层级

### 一级

- 当前 focus item
- 当前剩余时间 / 番茄钟

### 二级

- 当前时间块
- 下一项

### 三级

- 今日剩余任务数
- 今日剩余事件数
- 弱播放信息

## ScreenContext

```ts
type ScreenContext = {
  now: string;
  focusItem?: { id: string; title: string; source: "todoist" | "calendar" | "manual" };
  currentBlock?: { title: string; startsAt?: string; endsAt?: string; source: "calendar" | "manual" };
  nextBlock?: { title: string; startsAt?: string; source: "calendar" | "todoist" | "manual" };
  pomodoro?: { state: "idle" | "running" | "paused" | "break"; remainingSec: number; durationSec: number };
  todaySummary: { remainingTasks: number; remainingEvents: number };
};
```

## 外部 API 边界

Calendar 提供：

- 当前事件
- 下一事件
- 今日剩余事件数

Todoist 提供：

- 当前 focus task
- 下一任务
- 今日剩余任务数

## 硬规则

- 前端不直接打第三方 API
- token 只保存在服务层
- 不显示完整日历和完整任务列表
- 本机只做轻交互：开始/暂停番茄钟、完成当前项、切换 focus item
