# 统一导航与模式切换规则 v1

## 顶层状态

- `Overview`
- `Listen`
- `Flow`
- `Screen`

## 导航原则

- `Overview` 是系统地图和母层
- 聚焦态之间允许直接切换
- 任一聚焦态都必须快速返回 `Overview`

## 推荐模式关系

- `Overview -> Listen / Flow / Screen`
- `Listen -> Flow / Screen / Overview`
- `Flow -> Overview / Screen / Listen`
- `Screen -> Overview / Flow / Listen`

## 统一动作

- `set_mode(mode)`
- `return_overview()`
- `next_mode()`
- `prev_mode()`
- `show_mode_switcher()`
- `hide_mode_switcher()`

## 输入映射

### 触摸

- Overview 单击卡片进入
- 聚焦态单击空白唤醒控制层
- 双指捏合返回 Overview

### 遥控器

- Overview：左右切高亮，OK 进入
- 聚焦态：Back 返回，左右切相邻模式

### API

- `set_mode`
- `return_overview`
