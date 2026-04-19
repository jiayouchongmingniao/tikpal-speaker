# Listen 全屏信息架构规格 v1

## 定位

`Listen` 是声音系统的主控制台，让设备更像一台可信、克制的数播。

## 一级信息

- 当前曲目名
- 艺术家
- 播放状态

## 二级信息

- 来源
- 音量
- 进度
- 封面

## 三级信息

- 格式 / 采样率
- 下一首
- 队列摘要

## 推荐布局

- 主区：封面、曲目信息、播放控制
- 侧区：来源、音量、技术信息、下一首、模式入口

线框示意：

```text
LISTEN

[ Cover Art ]

Low Light Corridor
tikpal
Album Name

00:48 ─────────────── 03:42

[ Prev ] [ Play/Pause ] [ Next ]

Volume 58%
Source: Spotify Connect
Format: FLAC 24/96
Next: Night Window

[ Overview ] [ Flow ] [ Screen ]
```

## 边界

主屏不承载：

- 长队列
- 大量浏览树
- 深层设置

这些应放入次层或 overlay。
