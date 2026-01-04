# Site Deployer

Automated deployment system for managing and deploying station groups (10-10,000 websites) to Vercel with integrated Umami analytics.

## Features

✅ **Automated Deployment**: Deploy multiple sites in parallel to Vercel
✅ **Umami Integration**: Automatic analytics setup for each site
✅ **Batch Processing**: Deploy 5-100 sites concurrently
✅ **Error Handling**: Robust retry logic and error recovery
✅ **Progress Tracking**: Real-time deployment progress with tqdm
✅ **Flexible Configuration**: YAML-based site configuration

## Architecture

```
systems/site-deployer/
├── main.py                  # Main entry point
├── deployers/
│   ├── base.py              # Base deployer class
│   └── vercel.py            # Vercel deployment implementation
├── integrations/
│   ├── umami.py             # Umami analytics integration
│   └── google_search.py     # (TODO) Google Search Console
├── config/
│   ├── default.yaml         # Default configuration
│   └── sites.yaml.example   # Site configuration template
└── requirements.txt         # Python dependencies
```

## Quick Start

### 1. Install Dependencies

```bash
cd systems/site-deployer
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your tokens
VERCEL_TOKEN=your_token_here
UMAMI_PASSWORD=your_password_here
```

### 3. Configure Sites

```bash
# Copy sites configuration template
cp config/sites.yaml.example config/sites.yaml

# Edit config/sites.yaml to add your sites
```

Example `config/sites.yaml`:

```yaml
sites:
  - name: kuachu
    description: "跨境出海运营百科"
    source_path: /Users/liye/github/liye_os/websites/kuachu
    domain: kuachu.com
    framework: astro
    analytics:
      umami:
        enabled: true
        website_id: e1e476cf-cb25-4db4-a207-bd6fc8712b5b
    seo:
      google_search_console: true
```

### 4. Deploy Sites

```bash
# Deploy all sites
python main.py --config config/sites.yaml

# Deploy specific site
python main.py --config config/sites.yaml --site kuachu

# Dry run (validate without deploying)
python main.py --config config/sites.yaml --dry-run

# Deploy with 10 parallel workers
python main.py --config config/sites.yaml --workers 10
```

## Deployment Flow

1. **Build**: Runs `npm install && npm run build` in site directory
2. **Deploy**: Deploys to Vercel using CLI
3. **Analytics**: Creates Umami website and injects tracking code
4. **Validate**: Verifies deployment succeeded
5. **Report**: Displays summary of all deployments

## Configuration

### Default Configuration (`config/default.yaml`)

```yaml
deployment:
  platform: vercel
  concurrent_limit: 5
  timeout: 600
  retry_attempts: 3

build:
  framework: astro
  install_command: npm install
  build_command: npm run build

umami:
  enabled: true
  api_url: https://umami-iota-blush.vercel.app
  auto_inject: true

logging:
  level: INFO
  file: logs/site-deployer.log
```

### Site Configuration

Each site in `config/sites.yaml` supports:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Site identifier |
| `source_path` | ✅ | Path to site source code |
| `domain` | ❌ | Custom domain |
| `framework` | ❌ | Framework (astro, hugo, next) |
| `analytics.umami.enabled` | ❌ | Enable Umami (default: true) |
| `analytics.umami.website_id` | ❌ | Existing Umami website ID |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VERCEL_TOKEN` | ✅ | Vercel API token ([Get here](https://vercel.com/account/tokens)) |
| `UMAMI_USERNAME` | ❌ | Umami admin username (default: admin) |
| `UMAMI_PASSWORD` | ⚠️ | Umami admin password (required for auto-setup) |

## Usage Examples

### Deploy Single Site

```bash
python main.py --site kuachu
```

### Deploy All Sites with Progress Bar

```bash
python main.py --config config/sites.yaml
```

Output:
```
Found 10 site(s) to deploy:
  - kuachu (kuachu.com)
  - amazon-optimization (amazon-seo.com)
  ...

Proceed with deployment? [y/N]: y

Deploying sites: 100%|██████████| 10/10 [05:32<00:00, 33.2s/it] ✓ kuachu

============================================================
DEPLOYMENT SUMMARY
============================================================
Total sites: 10
Successful: 10
Failed: 0
============================================================
```

### Batch Deployment with Custom Workers

```bash
# Deploy 20 sites with 10 parallel workers
python main.py --config config/sites.yaml --workers 10
```

## Troubleshooting

### Build Failures

If build fails, check:
1. `npm install` completes successfully
2. `source_path` is correct
3. Site has valid `package.json` and `astro.config.mjs`

View logs:
```bash
tail -f logs/site-deployer.log
```

### Vercel API Errors

Common issues:
- **401 Unauthorized**: Invalid `VERCEL_TOKEN`
- **429 Rate Limited**: Too many concurrent deployments (reduce `--workers`)
- **500 Server Error**: Vercel issue, retry after a few minutes

### Umami Integration Fails

Check:
1. `UMAMI_PASSWORD` is set correctly
2. Umami instance is accessible
3. Login at https://umami-iota-blush.vercel.app

Disable Umami if needed:
```yaml
# In config/sites.yaml
analytics:
  umami:
    enabled: false
```

## Development

### Running Tests

```bash
# TODO: Add test suite
python -m pytest tests/
```

### Adding New Deployer

Create new deployer in `deployers/`:

```python
from deployers.base import BaseDeployer

class NetlifyDeployer(BaseDeployer):
    def deploy(self, site_config):
        # Implementation
        pass
```

Register in `main.py`:

```python
if platform == 'netlify':
    self.deployer = NetlifyDeployer(self.config)
```

## Documentation

- [Cloudflare DNS Setup Guide](docs/CLOUDFLARE_DNS_SETUP.md) - Vercel + Cloudflare Proxy 模式配置指南

## Roadmap

- [ ] Google Search Console integration
- [ ] Cloudflare DNS automation (Manual guide: [docs/CLOUDFLARE_DNS_SETUP.md](docs/CLOUDFLARE_DNS_SETUP.md))
- [ ] GitHub Actions workflow
- [ ] Deployment rollback support
- [ ] Web UI dashboard
- [ ] Docker container support
- [ ] Monitoring and alerts (Prometheus)

## Cost Estimation

### Phase 1 (10 sites)
- Vercel: $0 (Free tier)
- Umami: $0 (Self-hosted on Vercel)
- **Total: $0/month**

### Phase 2 (100 sites)
- Vercel Pro: $20/month
- Neon Postgres: $19/month
- **Total: $39/month**

### Phase 3 (10,000 sites)
- Custom infrastructure recommended
- Estimated: $500-1,000/month

## License

Part of LiYe OS - Internal use only

## Support

For issues or questions:
1. Check logs: `logs/site-deployer.log`
2. Review plan: `.claude/plans/swirling-dancing-hummingbird.md`
3. File issue in main repo
