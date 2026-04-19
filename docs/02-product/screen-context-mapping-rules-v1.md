# ScreenContext 映射规则明细 v1

## 1. 目标

这份文档定义如何把以下数据源：

- 本机状态
- Calendar
- Todoist
- 手动用户选择

统一映射为前台可消费的 `ScreenContext`。

目标是避免：

- 前端直接处理第三方 schema
- Calendar 和 Todoist 打架
- 当前任务 / 下一项 / 当前时间块语义混乱

这是一份连接器与前台之间的“语义翻译规则”。

---

## 2. ScreenContext 的定位

`ScreenContext` 不是原始数据仓库，而是：

“设备此刻用于 Screen 展示和控制的最小上下文。”

它只表达：

- 当前最重要任务
- 当前时间结构
- 下一步
- 当前 session 状态
- 当日剩余摘要

不表达：

- 全量任务列表
- 全量日历事件
- 项目树
- 评论 / 备注长文

---

## 3. 统一目标结构

建议目标结构如下：

```ts
type ScreenContext = {
  now: string;
  focusItem?: FocusItem;
  currentBlock?: TimeBlock;
  nextBlock?: NextItem;
  pomodoro?: PomodoroState;
  todaySummary: TodaySummary;
  sync: SyncMeta;
};
```

细分如下。

```ts
type FocusItem = {
  id: string;
  title: string;
  source: "manual" | "todoist" | "calendar";
  priority?: number;
  dueAt?: string;
};

type TimeBlock = {
  id?: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  source: "calendar" | "manual";
};

type NextItem = {
  id?: string;
  title: string;
  startsAt?: string;
  source: "calendar" | "todoist" | "manual";
  kind: "event" | "task" | "session";
};

type PomodoroState = {
  state: "idle" | "running" | "paused" | "break";
  remainingSec: number;
  durationSec: number;
  boundTaskId?: string;
};

type TodaySummary = {
  remainingTasks: number;
  remainingEvents: number;
};

type SyncMeta = {
  stale: boolean;
  lastCalendarSyncAt?: string;
  lastTodoistSyncAt?: string;
  calendarStatus: "idle" | "syncing" | "ok" | "stale" | "error";
  todoistStatus: "idle" | "syncing" | "ok" | "stale" | "error";
};
```

---

## 4. 数据源定义

## 4.1 本机手动状态

包括：

- 用户在本机或 portable 上手动选择的 focus item
- 本机创建的番茄钟
- 手动 session block

这类数据优先级通常最高，因为它体现用户明确意图。

---

## 4.2 Calendar

Calendar 用来提供：

- 当前时间块
- 下一事件
- 今日剩余事件数

Calendar 的角色是“时间结构”。

---

## 4.3 Todoist

Todoist 用来提供：

- 当前任务候选
- Today 剩余任务
- 下一任务
- 优先级信息

Todoist 的角色是“任务结构”。

---

## 5. 映射原则

## 5.1 FocusItem 优先表达任务，不优先表达事件

如果当前有明确任务，Screen 的主中心应优先显示任务，而不是 Calendar 事件标题。

原因：

- Screen 是任务与节奏表面
- 用户真正要“做”的对象通常是任务，而不是时间块本身

---

## 5.2 TimeBlock 优先表达 Calendar

如果当前存在 Calendar 事件，它应优先成为 `currentBlock`。

原因：

- Calendar 比任务更适合表达当前时间结构

---

## 5.3 NextItem 一次只显示一个

Screen 只能有一个 `nextBlock`。

不要同时显示：

- 下一个 Calendar 事件
- 下一个 Todoist 任务

否则用户会不知道哪一个更重要。

---

## 5.4 手动意图优先于自动推断

如果用户在本机或 portable 明确指定了当前 focus item，那么它优先级高于自动同步结果。

---

## 6. FocusItem 映射规则

## 6.1 优先级顺序

建议优先级：

1. 手动指定的当前 focus item
2. 番茄钟绑定任务
3. Todoist 当前 focus task
4. 当前 Calendar 事件标题

---

## 6.2 规则说明

### 规则 A：手动覆盖

如果用户主动设置当前任务：

- `focusItem.source = manual`
- 忽略 Todoist 自动推荐
- 不因为当前 Calendar 事件变化而立即覆盖

### 规则 B：番茄钟绑定

如果正在运行番茄钟且绑定了某任务：

- 优先以绑定任务作为 `focusItem`

### 规则 C：Todoist 候选

若无手动指定，也无番茄钟绑定：

- 可使用 Todoist 当前 focus task 作为 `focusItem`

### 规则 D：Calendar 回退

若以上都没有：

- 可用当前 Calendar 事件标题回退为 `focusItem`

这只是回退，不是首选。

---

## 7. currentBlock 映射规则

## 7.1 优先级顺序

1. 当前 Calendar 事件
2. 手动 session block
3. 无 currentBlock

---

## 7.2 规则说明

### 规则 A：Calendar 当前事件

当 `now` 落在某日历事件时间区间内时：

- 该事件成为 `currentBlock`

### 规则 B：无事件但有手动 session

如果用户手动开始了专注 session：

- 可用手动 session block 补位

### 规则 C：无 currentBlock

若没有当前事件，也没有手动 block：

- `currentBlock = undefined`

Screen 不应虚构时间块。

---

## 8. nextBlock 映射规则

## 8.1 优先级顺序

1. 下一 Calendar 事件
2. 下一 Todoist 任务
3. 手动 next item

---

## 8.2 为什么 Calendar 优先

因为下一个时间边界通常比下一个任务更重要。

用户在专注时更关心：

- 什么时候要切换时间块
- 什么时候有会议 / 提醒

而不是一串任务里的排序。

---

## 8.3 规则说明

### 规则 A：下一 Calendar 事件存在

- `nextBlock.source = calendar`
- `nextBlock.kind = event`

### 规则 B：没有下一事件但有下一任务

- `nextBlock.source = todoist`
- `nextBlock.kind = task`

### 规则 C：都没有

- `nextBlock = undefined`

---

## 9. Pomodoro 映射规则

## 9.1 本机番茄钟是 Screen 的原生能力

它不来自第三方，而来自设备内部 session 逻辑。

### 作用

- 决定 Screen 当前倒计时
- 提供当前 session 的时间节奏
- 与 `focusItem` 绑定

---

## 9.2 优先级

只要番茄钟在 `running / paused / break`：

- 它就必须进入 `ScreenContext.pomodoro`

Screen 页面中的大号时间优先显示番茄钟剩余时间，而不是 Calendar 事件剩余时间。

### 原因

番茄钟代表当前主动 session。

---

## 10. TodaySummary 映射规则

## 10.1 remainingTasks

来源：

- Todoist Today 未完成任务数
- 可加 overdue 任务策略，但第一版建议简单处理

建议：

- 默认统计 Today 中仍未完成任务

## 10.2 remainingEvents

来源：

- 当日尚未开始或尚未结束的剩余 Calendar 事件数量

### 注意

- 已结束事件不计
- 当前事件可视策略决定是否计入 remaining

建议第一版：

- 当前事件不计入 remainingEvents

---

## 11. stale 与失败策略

## 11.1 stale 定义

当 Calendar 或 Todoist 最近同步失败，但系统仍保留上一次有效上下文时：

- `sync.stale = true`

### 行为

- Screen 可继续展示最后一次有效结果
- 但应在弱层提示“context stale”

---

## 11.2 error 行为

如果某一 connector 完全不可用：

- `calendarStatus = error` 或 `todoistStatus = error`

但只要另一来源和本机状态还可用，Screen 仍应正常工作。

---

## 12. 冲突场景处理

## 12.1 Calendar 事件与 Todoist 当前任务不一致

示例：

- Calendar：`Meeting`
- Todoist：`Write Spec`

### 处理策略

- `currentBlock` 显示 Calendar 的 `Meeting`
- `focusItem` 显示 Todoist 的 `Write Spec`

这样既保留时间结构，也保留当前任务主语义。

---

## 12.2 手动 focus item 与 Todoist 不一致

### 处理策略

- 手动指定优先
- `focusItem.source = manual`
- Todoist 仍可影响 `remainingTasks`
- 不覆盖当前 `focusItem`

---

## 12.3 当前没有任务，但有 Calendar 事件

### 处理策略

- `currentBlock` = 当前事件
- `focusItem` 可回退使用当前事件标题

---

## 12.4 当前没有事件，但有 Todoist 任务

### 处理策略

- `focusItem` = 当前任务
- `currentBlock = undefined`
- `nextBlock` 可来自下一任务

---

## 13. 前台显示映射建议

## Screen 全屏

### 主标题

- 使用 `focusItem.title`

### 大号时间

- 若有 `pomodoro`，显示番茄钟剩余时间
- 否则可显示当前 block 剩余时间

### 次级信息

- `currentBlock.title`
- `nextBlock.title`

### 摘要

- `todaySummary.remainingTasks`
- `todaySummary.remainingEvents`

---

## 14. Overview 中的 ScreenCard

只消费：

- `focusItem.title`
- `pomodoro.remainingSec`
- `nextBlock.title`
- `todaySummary.remainingTasks`

绝不显示完整 `ScreenContext` 细节。

---

## 15. portable 中的 Screen 控制区

建议主要消费：

- `focusItem.title`
- `pomodoro.state`
- `pomodoro.remainingSec`
- `nextBlock.title`

### 不建议

- 在 portable 上展开复杂多任务列表
- 在 portable 上展示完整 Calendar 流

---

## 16. 示例映射

## 示例 1：典型专注场景

输入：

- 手动设置任务：`Write Ambient OS Spec`
- Calendar 当前事件：`Deep Work Block`
- Calendar 下一事件：`Review notes 15:30`
- Todoist Today 剩余：3
- Pomodoro running 18:24

输出：

```json
{
  "focusItem": {
    "id": "manual_focus_001",
    "title": "Write Ambient OS Spec",
    "source": "manual"
  },
  "currentBlock": {
    "title": "Deep Work Block",
    "source": "calendar"
  },
  "nextBlock": {
    "title": "Review notes",
    "startsAt": "2026-04-19T15:30:00Z",
    "source": "calendar",
    "kind": "event"
  },
  "pomodoro": {
    "state": "running",
    "remainingSec": 1104,
    "durationSec": 1500
  },
  "todaySummary": {
    "remainingTasks": 3,
    "remainingEvents": 2
  }
}
```

---

## 示例 2：无番茄钟，仅靠外部同步

输入：

- Todoist 当前任务：`Write Spec`
- Calendar 当前事件：无
- Calendar 下一事件：`Standup 16:00`

输出：

- `focusItem = Write Spec`
- `currentBlock = undefined`
- `nextBlock = Standup`

---

## 17. 实施建议

建议实现分三层：

1. `connector adapters`
   - Calendar 原始数据
   - Todoist 原始数据

2. `mapping layer`
   - 按本规格做优先级合并

3. `ScreenContext service`
   - 缓存最终结果
   - 提供给 API 和前端

---

## 18. 结论

`ScreenContext` 的关键不是“把所有数据带过来”，而是把当前最重要的任务与时间结构整理出来。

一句话总结：

- 任务决定你在做什么
- Calendar 决定你处于什么时间块
- 番茄钟决定你当前 session 的节奏
- `ScreenContext` 负责把这三者收束成一个可展示、可控制的前台上下文
