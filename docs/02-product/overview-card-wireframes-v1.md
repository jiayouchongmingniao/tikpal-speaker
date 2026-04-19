# Overview 三卡片线框与信息层级规格 v1

## ListenCard

一级信息：

- 当前曲目名
- 播放状态

二级信息：

- 艺术家
- 音量
- 来源

三级信息：

- 进度
- 小型播放控件

线框示意：

```text
LISTEN                      PLAYING

Low Light Corridor
tikpal

Volume 58%
Spotify Connect

[ Play/Pause ]   ───── progress ─────
```

## FlowCard

一级信息：

- 当前状态名

二级信息：

- 副标题
- 缩略视觉

三级信息：

- `focus / flow / relax / sleep`

线框示意：

```text
FLOW

RELAX
Wind Down

~ subtle visual field ~

focus   flow   relax   sleep
```

## ScreenCard

一级信息：

- 当前任务
- 剩余时间

二级信息：

- 下一项

三级信息：

- 剩余任务数

线框示意：

```text
SCREEN                    RUNNING

Write Ambient OS Spec
18:24 left

Next: Review notes
3 tasks left today

[ Pause ]   [ Complete ]
```

## 硬规则

- 每张卡最多 2 个视觉中心
- 主区与控件热区必须分离
- 三卡总预算必须远低于任一全屏模式
