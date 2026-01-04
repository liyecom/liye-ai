# Cloudflare DNS Setup for Vercel (Proxy Mode)

本文档记录使用 Cloudflare DNS + Proxy（橙云）模式部署 Vercel 网站的完整流程。

## 关键配置（必读）

### Vercel IP 地址

| 记录类型 | 正确值 | 错误示例 |
|----------|--------|----------|
| **A 记录** | `76.76.21.21` | ~~216.198.79.1~~ |
| **CNAME** | `cname.vercel-dns.com` | - |

> **重要**: Vercel 的 A 记录 IP 是 `76.76.21.21`，不要使用其他 IP！这是之前配置 zhangxiang.com 时犯过的错误。

---

## 完整 DNS 配置模板

以 `example.com` 为例：

| Type | Name | Value | Proxy | 说明 |
|------|------|-------|-------|------|
| **A** | `@` | `76.76.21.21` | Proxied (橙云) | 根域名 |
| **CNAME** | `www` | `cname.vercel-dns.com` | Proxied (橙云) | www 子域名 |
| **TXT** | `_vercel` | `vc-domain-verify=example.com,{hash1}` | DNS only | 根域名验证 |
| **TXT** | `_vercel` | `vc-domain-verify=www.example.com,{hash2}` | DNS only | www 验证 |

---

## 配置步骤

### Step 1: Vercel 域名设置

1. 登录 Vercel Dashboard
2. 进入项目 → Settings → Domains
3. 添加两个域名：
   - `example.com`（根域名）
   - `www.example.com`（www 子域名）
4. 复制每个域名的验证信息：
   - TXT 记录名称：`_vercel`
   - TXT 记录值：`vc-domain-verify=...`

### Step 2: Cloudflare DNS 配置

1. 登录 Cloudflare Dashboard
2. 选择域名 → DNS → Records

#### 添加 A 记录（根域名）

```
Type: A
Name: @
IPv4: 76.76.21.21
Proxy: Proxied (橙云)
TTL: Auto
```

#### 添加 CNAME 记录（www）

```
Type: CNAME
Name: www
Target: cname.vercel-dns.com
Proxy: Proxied (橙云)
TTL: Auto
```

#### 添加 TXT 记录（验证）

```
Type: TXT
Name: _vercel
Content: vc-domain-verify=example.com,{复制的hash}
Proxy: DNS only (灰云)

Type: TXT
Name: _vercel
Content: vc-domain-verify=www.example.com,{复制的hash}
Proxy: DNS only (灰云)
```

> 注意：同一个 `_vercel` 名称可以有多条 TXT 记录，这是正常的。

### Step 3: 验证配置

回到 Vercel Domains 页面刷新，等待状态变为：

| 域名 | 期望状态 |
|------|----------|
| `example.com` | Proxy Detected |
| `www.example.com` | Proxy Detected, Production |
| `example-xxx.vercel.app` | Valid Configuration |

---

## 常见问题

### Q: 为什么 A 记录要用 `76.76.21.21`？

Vercel 使用这个 IP 作为所有 Anycast 服务的入口。使用其他 IP（如 `216.198.79.1`）会导致：
- 网站无法访问
- SSL 证书验证失败
- Vercel 显示 "Invalid Configuration"

### Q: 为什么要开启 Proxy（橙云）？

| 特性 | Proxy (橙云) | DNS only (灰云) |
|------|-------------|-----------------|
| CDN 加速 | ✅ | ❌ |
| DDoS 防护 | ✅ | ❌ |
| 隐藏真实 IP | ✅ | ❌ |
| SSL 证书 | Cloudflare 提供 | Vercel 提供 |
| 性能优化 | ✅ | ❌ |

### Q: TXT 记录为什么用 DNS only？

TXT 记录是纯文本验证，不需要代理。使用 Proxied 可能导致验证失败。

### Q: 配置后多久生效？

- Cloudflare 变更：几秒到几分钟
- 全球 DNS 传播：最长 48 小时（通常 10-30 分钟）
- Vercel 检测：刷新页面后立即检测

---

## 验证成功的案例

### zhangxiang.com (2026-01-04)

最终配置：

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A | zhangxiang.com | 76.76.21.21 | Proxied |
| CNAME | www | cname.vercel-dns.com | Proxied |
| TXT | _vercel | vc-domain-verify=zhangxiang.com,a9a5ca8ae9cbb4df2f03 | DNS only |
| TXT | _vercel | vc-domain-verify=www.zhangxiang.com,74491ada08e5688b99af | DNS only |

Vercel 状态：
- zhangxiang.com: Proxy Detected (307 redirect to www)
- www.zhangxiang.com: Proxy Detected, Production
- zhangxiang-beta.vercel.app: Valid Configuration

### kuachu.com（参考）

同样的配置模式，已稳定运行。

---

## Checklist

部署前检查清单：

- [ ] A 记录 IP 是 `76.76.21.21`
- [ ] CNAME 指向 `cname.vercel-dns.com`
- [ ] A 和 CNAME 都开启了 Proxy（橙云）
- [ ] TXT 记录使用 DNS only（灰云）
- [ ] 两个 TXT 验证记录都已添加
- [ ] Vercel 显示 "Proxy Detected"

---

## 故障排查

### 症状：Vercel 显示 "Invalid Configuration"

检查：
1. A 记录 IP 是否正确 (`76.76.21.21`)
2. TXT 验证记录是否添加

### 症状：网站无法访问

检查：
1. DNS 是否已传播（使用 `dig example.com`）
2. Cloudflare SSL/TLS 设置是否为 "Full" 或 "Full (Strict)"

### 症状：SSL 证书错误

检查：
1. Cloudflare SSL 模式（推荐 Full Strict）
2. 等待 Vercel 自动签发证书（可能需要几分钟）

---

## 版本历史

| 日期 | 更新内容 |
|------|----------|
| 2026-01-04 | 创建文档，记录 zhangxiang.com 配置经验 |

---

## 相关文档

- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [Cloudflare DNS](https://developers.cloudflare.com/dns/)
- [site-deployer README](../README.md)
