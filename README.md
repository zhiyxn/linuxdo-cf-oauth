# linuxdo-cf-oauth

一个部署在 Cloudflare Workers 上的 OAuth 代理，用于转发 linux.do 的 认证与获取用户信息请求。

## 提醒

在调用 `/oauth/token` 前，需要先到 https://connect.linux.do/ 申请接入并获取 Client ID 与 Client Secret。 然后通过浏览器跳转以下地址获取 `code` 参数。

```
https://connect.linux.do/oauth2/authorize?client_id=clientId&response_type=code&scope=all&redirect_url=你的回调地址
```

## 功能

- 代理 `POST /oauth/token` 到 `https://connect.linux.do/oauth2/token`
- 透传 `GET /api/user` 到 `https://connect.linux.do/api/user`
- 可选 CORS 允许来源白名单
- 支持多客户端映射或单客户端回退配置

## 接口

- `POST /oauth/token`
  - 仅支持 `application/x-www-form-urlencoded`
  - 必须携带或补全 `client_id` 与 `client_secret`
- `GET /api/user`
  - 透传 `Authorization` 头

## 环境变量

- `CLIENT_MAP`：JSON 字符串，`client_id -> client_secret` 映射，适合多应用。
- `CLIENT_ID`：单应用回退配置。
- `CLIENT_SECRET`：单应用回退配置。
- `ALLOWED_ORIGINS`：允许的来源列表，逗号分隔，缺省表示允许任意来源回显。

优先级：`CLIENT_MAP` 中命中的 `client_secret` > `CLIENT_SECRET` 回退。

## 部署

1. 在 Cloudflare Workers 创建一个新 Worker。
2. 将 `worker.js` 的内容粘贴为 Worker 脚本。
3. 在 Worker 的环境变量中配置 `CLIENT_MAP` 或 `CLIENT_ID`/`CLIENT_SECRET`。
4. 如需限制跨域访问，配置 `ALLOWED_ORIGINS`。

建议将敏感信息存放为 Worker 的加密环境变量。

## 使用示例

获取 token：

```bash
curl -X POST "https://<your-worker-domain>/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "redirect_uri=https://example.com/callback" \
  -d "code=AUTH_CODE"
```

获取用户信息：

```bash
curl "https://<your-worker-domain>/api/user" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 重要知识

- `/oauth/token` 仅支持 `application/x-www-form-urlencoded`，否则返回 415。
- 缺少 `client_id` 或 `client_secret` 会返回 401。
- `ALLOWED_ORIGINS` 为空时会按请求来源回显 CORS。
- 目前仅处理 `POST /oauth/token` 与 `GET /api/user`。

## 许可证

见 `LICENSE`。
