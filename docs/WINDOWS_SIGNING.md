# Windows SmartScreen / code signing

Unsigned `eskusmi-setup.exe` downloads trigger **Windows protected your PC**.
The only real fix is Authenticode signing — there is no bypass.

## Temporary install (unsigned)

1. **More info** → **Run anyway**
2. If Smart App Control blocks: Windows Security → App & browser control → Smart App Control → Off / Evaluation

## Preferred (free): SignPath Foundation

Best free option for public open-source repos. Publisher will show as **SignPath Foundation**.

### 1. Eligibility checklist

- Public GitHub repo: `https://github.com/shibushaba/eskusmi`
- OSI license in repo (`LICENSE` — MIT)
- No proprietary blobs in the signed package
- Actively maintained + already releasing installers
- [SignPath OSS terms](https://signpath.org/terms.html)

### 2. Apply

1. Open [SignPath Foundation](https://signpath.org/) / [open-source product page](https://signpath.io/product/open-source)
2. Apply with repo URL + note that Windows SmartScreen blocks installs
3. Wait for approval (often a few business days)

### 3. After approval (SignPath dashboard)

1. Create project linked to `shibushaba/eskusmi` (slug e.g. `eskusmi`)
2. Create signing policy (slug e.g. `release-signing`)
3. Create artifact configuration for the Windows NSIS installer (slug e.g. `windows-installer`) — PE / EXE
4. Install the **SignPath GitHub App** on the repo
5. Create an API token with submit permission

### 4. GitHub secrets / variables

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `SIGNPATH_API_TOKEN` | API token from SignPath |
| Variable | `SIGNPATH_ORGANIZATION_ID` | Org UUID (enables signing in CI) |
| Variable | `SIGNPATH_PROJECT_SLUG` | e.g. `eskusmi` (optional; defaults in workflow) |
| Variable | `SIGNPATH_SIGNING_POLICY_SLUG` | e.g. `release-signing` |
| Variable | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | e.g. `windows-installer` |

Setting `SIGNPATH_ORGANIZATION_ID` turns signing **on**. Until then, releases stay unsigned.

### 5. Ship

```bash
git tag v0.1.4
git push origin v0.1.4
```

CI uploads `eskusmi-setup.exe` to SignPath, waits for the signed file, then publishes it.

### 6. Verify

```powershell
Get-AuthenticodeSignature .\eskusmi-setup.exe | Format-List Status, SignerCertificate
```

`Status` should be `Valid`. Publisher subject will mention SignPath Foundation.

## Code signing policy

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

- **Committers / reviewers:** repository collaborators with write access  
  https://github.com/shibushaba/eskusmi/settings/access
- **Approvers:** repository owners  
  https://github.com/shibushaba/eskusmi/settings/access
- Windows release binaries are built on GitHub-hosted runners via `.github/workflows/release.yml` and submitted to SignPath for Authenticode signing when `SIGNPATH_ORGANIZATION_ID` is set.

## Alternatives

| Option | When to use |
| --- | --- |
| **Azure Trusted Signing** | Paid Azure subscription — `scripts/setup-windows-signing.ps1` |
| **Classic `.pfx`** | You already bought an OV/EV cert — `WINDOWS_CERTIFICATE` secrets |
| **Self-signed** | Local testing only — does **not** clear SmartScreen |

Azure / PFX paths remain in the release workflow if those secrets are present (Azure takes priority over SignPath when both are configured).
