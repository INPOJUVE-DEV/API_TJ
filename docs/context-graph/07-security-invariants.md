# Security Invariants

## Core principles

- `API_TJ` must not expose unrestricted integration endpoints.
- Administrative routes must always require role validation.
- Integration clients must use scoped access.
- Public auth routes must always be rate-limited.
- Sensitive responses should avoid cache persistence.

## Authentication invariants

- `/api/v1/auth/login` must always be protected by login rate limiting.
- Refresh flows must not bypass session validation.
- OTP verification must remain rate-limited.
- Password reset flows must never expose account existence details unnecessarily.

## Admin invariants

- `reader` role must never mutate critical data.
- `admin` routes must always validate token + role.
- Password changes must remain restricted to admin-level permissions.

## Integration invariants

- Integration routes must validate scope before execution.
- Integration traffic must remain rate-limited.
- Staging records should be reviewed before final push.
- CURP must be validated before linking beneficiary records.

## Data ownership invariants

- `Sys_IPJ` remains the source of truth for beneficiary registration.
- `API_TJ` should maintain only the data required for authentication, activation, integration and operational access.
- Cross-system identity should rely on CURP or another controlled unique identifier.

## Operational concerns

- CORS separation between public and admin surfaces must remain explicit.
- Health endpoint should not expose internal diagnostics.
- Runtime configuration validation should execute before app bootstrap.
