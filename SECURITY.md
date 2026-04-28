# Security Policy

## Reporting a Vulnerability

Do **not** open a public GitHub issue for security vulnerabilities.

To report a vulnerability:
- Use the **"Report a vulnerability"** button on the Security tab of this repository (GitHub private advisory)
- Or email: babak@cocode.dk

We will acknowledge within 5 business days and aim to release a fix within 30 days of confirmation.

## Scope

x-cleaner is a local tool that drives a logged-in Chromium profile against your own X.com account. Issues we treat as security:

- Anything that could leak the persistent profile (`./.profile/`) or session cookies to a third party
- Anything that could cause the runner to act on an account other than the configured `--handle`
- Anything that could trigger uncontrolled deletion (bypassing the dry-run gate, hourly/daily caps, or abort-on-anomaly logic)
- Dependency vulnerabilities in shipped runtime code

Out of scope: X.com's own anti-automation defenses; you are responsible for using this tool against your own account at your own discretion.

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | yes       |
| older   | no        |
