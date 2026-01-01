# T1 External Adapters

**Status**: PLACEHOLDER
**Purpose**: Enable T1 kernel to be consumed by external agents and third-party systems

---

## Adapter Targets

| Target | Description | Status |
|--------|-------------|--------|
| external-agent | Non-LiYe OS agents using T1 | PLACEHOLDER |
| third-party-os | Other reasoning systems | PLACEHOLDER |

---

## Why Adapters?

The T1 kernel is designed as internal infrastructure. External consumers need:

1. **Protocol Translation** - Convert T1 output to standard formats
2. **Authentication** - Control who can access the kernel
3. **Rate Limiting** - Prevent abuse of reasoning resources
4. **Versioning** - Support multiple kernel versions simultaneously

---

## Adapter Interface (Planned)

```typescript
interface T1Adapter {
  // Authenticate external caller
  authenticate(credentials: ExternalCredentials): Promise<Session>;

  // Invoke kernel with rate limiting
  invoke(
    session: Session,
    method: 'detect_regime' | 'expose_causal_chain' | 'suppress_false_confidence',
    params: Record<string, unknown>
  ): Promise<KernelResponse>;

  // Get kernel metadata
  getKernelMeta(): KernelMeta;
}
```

---

## Not Implemented Yet

This directory is a **placeholder** for future implementation.

Current focus:
1. ✅ Kernel API finalized
2. ✅ Internal domain integration
3. 🔲 External adapter development
4. 🔲 Third-party integration testing

---

## When to Implement

External adapters should be implemented when:

1. A third-party agent requests T1 access
2. A new OS wants to integrate T1 reasoning
3. An API gateway is needed for T1 services

---

*Placeholder created: 2025-12-31*
*Implementation: PENDING*
