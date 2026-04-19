# OTA 升级与回滚流程规格 v1

## 范围

第一版只做应用层 OTA：

- 前端静态资源
- 本地 Node 服务
- 配置与 manifest

不做整机系统 OTA。

## 状态

- `idle`
- `checking`
- `available`
- `downloading`
- `verifying`
- `ready`
- `applying`
- `restarting`
- `rollback`
- `error`

## 推荐流程

1. `check`
2. `download`
3. `verify`
4. `stage`
5. `apply`
6. `restart`
7. `health check`
8. 成功确认或失败回滚

## 目录策略

```text
/opt/tikpal/app/releases/<version>/
/opt/tikpal/app/current
/opt/tikpal/app/previous
```

## manifest 最少字段

- `version`
- `buildTime`
- `compatibleApiVersion`
- `checksum`

## API 建议

- `GET /api/v1/system/ota/status`
- `POST /api/v1/system/ota/check`
- `POST /api/v1/system/ota/apply`
- `POST /api/v1/system/ota/rollback`

## 原则

- 升级要可见
- 升级失败要可回滚
- API 要尽量向后兼容
- OTA 是高权限动作
