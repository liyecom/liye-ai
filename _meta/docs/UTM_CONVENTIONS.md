# Content Hub UTM Conventions

> **Version**: 1.0
> **Last Updated**: 2026-01-15
> **Scope**: Multi-site content hub traffic attribution

---

## Overview

This document defines the UTM parameter conventions for traffic routing from content hubs (e.g., muddymatsfordogs.com) to brand storefronts (e.g., timomats.com, refetone.com, foneyimats.com).

Consistent UTM tagging is critical for:
1. **Attribution**: Understanding which content drives conversions
2. **GDP Integration**: Unified analytics across DTC + Content + SEO
3. **Cross-domain Tracking**: GA4 cross-domain measurement

---

## Required Parameters

All outbound links from content hubs **MUST** include these parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `utm_source` | Origin domain (content hub) | `muddymatsfordogs` |
| `utm_medium` | Traffic type | `organic`, `cpc`, `email`, `social` |
| `utm_campaign` | Campaign identifier | `content_funnel`, `best_picks_2026` |

---

## Recommended Parameters

For enhanced attribution granularity:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `utm_content` | Specific content/link ID | `top_5_mats_cta`, `sidebar_banner` |
| `utm_term` | Keyword (if SEO-driven) | `best_dog_mats` |
| `brand` | Target brand (custom) | `timomats`, `refetone` |

---

## Standard URL Pattern

```
https://{brand-domain}.com/products/{product-slug}
  ?utm_source=muddymatsfordogs
  &utm_medium=organic
  &utm_campaign=content_funnel
  &utm_content={article-slug}
  &brand={brand-id}
```

### Example

```
https://timomats.com/products/premium-dog-mat
  ?utm_source=muddymatsfordogs
  &utm_medium=organic
  &utm_campaign=content_funnel
  &utm_content=best-dog-mats-2026
  &brand=timomats
```

---

## Content Hub Link Template

For content hub developers, use this Astro component pattern:

```astro
---
// BrandLink.astro
interface Props {
  href: string;
  brand: string;
  campaign?: string;
  content?: string;
}

const { href, brand, campaign = 'content_funnel', content } = Astro.props;

const url = new URL(href);
url.searchParams.set('utm_source', 'muddymatsfordogs');
url.searchParams.set('utm_medium', 'organic');
url.searchParams.set('utm_campaign', campaign);
url.searchParams.set('brand', brand);
if (content) {
  url.searchParams.set('utm_content', content);
}
---

<a href={url.toString()}><slot /></a>
```

Usage:
```astro
<BrandLink
  href="https://timomats.com/products/premium-mat"
  brand="timomats"
  content="best-mats-article"
>
  Check out the Premium Mat
</BrandLink>
```

---

## GA4 Cross-Domain Setup

To ensure accurate attribution across all sites:

### 1. Configure GA4 Property

All sites share one GA4 property with cross-domain measurement:

```javascript
// gtag.js config (all sites)
gtag('config', 'G-XXXXXXXXXX', {
  linker: {
    domains: [
      'timomats.com',
      'refetone.com',
      'foneyimats.com',
      'muddymatsfordogs.com'
    ]
  }
});
```

### 2. Cross-Domain Link Decoration

GA4 automatically decorates cross-domain links when configured. Ensure:
- All outbound links use full URLs (not relative)
- gtag.js is loaded before user interaction

---

## Validation Checklist

Before publishing content hub articles:

- [ ] All brand links include `utm_source`, `utm_medium`, `utm_campaign`
- [ ] `utm_source` matches the content hub domain
- [ ] `brand` parameter identifies target brand
- [ ] Cross-domain tracking verified in GA4 DebugView
- [ ] Links use HTTPS

---

## SSOT Reference

The authoritative source for site mappings and UTM conventions is:

```
themes/sites/_registry.yaml
```

This document provides implementation guidance; the registry is the machine-readable SSOT.

---

## Related Documents

- [Architecture Constitution](./_meta/docs/ARCHITECTURE_CONSTITUTION.md) - Section 4.4
- [Site Registry](themes/sites/_registry.yaml) - SSOT for site configurations
