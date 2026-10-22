# Security Policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private vulnerability reporting for this repository:
<https://github.com/YusufBeratZengin/i18n-json-diff/security/advisories/new>

Include the affected version, a description of the problem and, if possible, a minimal reproduction. You can expect an acknowledgement within a few days. Once a fix is available, the report will be credited in the changelog unless you prefer otherwise.

## Scope

i18n-json-diff reads JSON files you point it at and writes only the files you name to `merge` (`<target>` or `--output`) and `export-missing --output`. It makes no network requests and runs no code from the files it reads. Reports about parser crashes, unbounded resource use on crafted input, or writes outside the requested paths are in scope.
