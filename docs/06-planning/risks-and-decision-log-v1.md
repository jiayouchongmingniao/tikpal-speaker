# 风险清单与决策记录 v1

## 已决策事项

- 产品形态是 ambient OS，不是单页播放器
- 顶层前台为 `Overview / Listen / Flow / Screen`
- `Overview` 是系统母层
- `Overview` 只展示三张摘要卡片
- `Screen` 不做完整第三方客户端
- API 以系统级 REST API 为主
- 输入统一收敛到动作层
- OTA 和树莓派 4 性能是一级约束

## 待验证事项

- Overview 是否严格等分还是中间 `Flow` 略宽
- 多点触摸最终手势集合
- `Flow <-> Screen` 的真实使用优先级
- Calendar 与 Todoist 的合并优先级
- 是否需要 SSE / WebSocket
- Listen 的深度范围

## 高风险事项

- 三分屏性能超预算
- Screen 膨胀成效率软件
- API 被页面实现绑死
- 本机触摸与便携控制器冲突
- OTA 与当前运行状态耦合过深
- 第三方集成的隐私与认证风险
- Flow 视觉过度追求效果

## 当前关键结论

必须围绕：

- `Overview + Focus`
- `SystemState`
- `Actions`

来建系统，而不是围绕某个页面原型继续演化。
