# 设备端服务拆分与部署拓扑规格 v1

## 推荐拓扑

```text
[ Browser / Kiosk ]
        |
        v
[ nginx ]
  |            \
  |             \
  v              v
[ static UI ]   [ tikpal-system-service ]
                     |
                     |-- playback bridge
                     |-- screen connectors
                     |-- ota manager
                     |-- state store
```

## 组件职责

### Browser / Kiosk

- 全屏显示前端
- 接收触摸输入
- 不承担业务逻辑

### nginx

- 承载静态资源
- 反代 `/api/v1/system/*`
- 提供统一入口

### tikpal-system-service

- SystemState
- Actions
- REST API
- 播放桥接
- Calendar / Todoist connectors
- OTA 状态与流程

## 端口建议

- `nginx`: `80`
- `tikpal-system-service`: `127.0.0.1:8787`

## 目录建议

```text
/opt/tikpal/app/releases/<version>/
/opt/tikpal/app/current
/opt/tikpal/app/previous
```

## systemd 建议

- `nginx.service`
- `tikpal-system-service.service`
- 可选 `tikpal-kiosk.service`

## 原则

- 对外只暴露 nginx
- Node 服务仅本机监听
- 第一版避免拆太多进程
