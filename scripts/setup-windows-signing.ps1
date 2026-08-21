#Requires -Version 5.1
<#
.SYNOPSIS
  CLI setup for Azure Trusted Signing + GitHub Actions secrets (eskusmi).

.DESCRIPTION
  Automates everything Azure CLI can do for Windows Authenticode signing:
  - resource group + Trusted Signing account
  - Entra app registration + client secret
  - role assignment (Trusted Signing Certificate Profile Signer)
  - certificate profile (after you paste a completed identity validation ID)
  - GitHub Actions secrets via `gh`

  Identity validation itself is PORTAL-ONLY (Microsoft policy). The script opens
  the portal page and waits for you to paste the validation ID.

.EXAMPLE
  pwsh -File scripts/setup-windows-signing.ps1

.EXAMPLE
  pwsh -File scripts/setup-windows-signing.ps1 -Location westus2 -SkipGitHub
#>

[CmdletBinding()]
param(
  [string]$SubscriptionId = "",
  [string]$ResourceGroup = "eskusmi-signing",
  [string]$Location = "westus2",
  [string]$AccountName = "eskusmisign",
  [string]$CertificateProfile = "eskusmi-public",
  [string]$AppDisplayName = "eskusmi-github-trusted-signing",
  [string]$GitHubRepo = "",
  [string]$IdentityValidationId = "",
  [switch]$SkipGitHub,
  [switch]$SkipLogin
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "OK  $msg" -ForegroundColor Green }
function Write-WarnLine($msg) { Write-Host "!!  $msg" -ForegroundColor Yellow }

# Region -> Trusted Signing / Artifact Signing endpoint
$EndpointMap = @{
  "brazilsouth"      = "https://brs.codesigning.azure.net"
  "centralus"        = "https://cus.codesigning.azure.net"
  "eastus"           = "https://eus.codesigning.azure.net"
  "japaneast"        = "https://jpe.codesigning.azure.net"
  "koreacentral"     = "https://krc.codesigning.azure.net"
  "northcentralus"   = "https://ncus.codesigning.azure.net"
  "northeurope"      = "https://neu.codesigning.azure.net"
  "polandcentral"    = "https://plc.codesigning.azure.net"
  "southcentralus"   = "https://scus.codesigning.azure.net"
  "switzerlandnorth" = "https://swn.codesigning.azure.net"
  "westcentralus"    = "https://wcus.codesigning.azure.net"
  "westeurope"       = "https://weu.codesigning.azure.net"
  "westus"           = "https://wus.codesigning.azure.net"
  "westus2"          = "https://wus2.codesigning.azure.net"
  "westus3"          = "https://wus3.codesigning.azure.net"
}

$locKey = $Location.ToLowerInvariant()
if (-not $EndpointMap.ContainsKey($locKey)) {
  throw "Unsupported Location '$Location'. Use one of: $($EndpointMap.Keys -join ', ')"
}
$Endpoint = $EndpointMap[$locKey]

# --- Preconditions ---
Write-Step "Checking tools"
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) not found. Install: winget install -e --id Microsoft.AzureCLI"
}
if (-not $SkipGitHub -and -not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-WarnLine "GitHub CLI (gh) not found — will print secrets for manual paste."
  $SkipGitHub = $true
}

az extension add --name trustedsigning --upgrade --yes 2>$null | Out-Null
Write-Ok "az + trustedsigning extension ready"

# --- Login / subscription ---
if (-not $SkipLogin) {
  Write-Step "Azure login"
  $accountJson = az account show 2>$null
  if (-not $accountJson) {
    az login | Out-Null
  } else {
    Write-Ok "Already logged in"
  }
}

if ($SubscriptionId) {
  az account set --subscription $SubscriptionId | Out-Null
}

$sub = az account show --query "{id:id,name:name,tenantId:tenantId}" -o json | ConvertFrom-Json
Write-Ok "Subscription: $($sub.name) ($($sub.id))"
$TenantId = $sub.tenantId
$SubscriptionId = $sub.id

# --- Resource provider + RG + account ---
Write-Step "Register Microsoft.CodeSigning provider (may take a minute)"
az provider register --namespace Microsoft.CodeSigning --wait | Out-Null
Write-Ok "Provider registered"

Write-Step "Create resource group $ResourceGroup ($Location)"
az group create --name $ResourceGroup --location $Location -o none
Write-Ok "Resource group ready"

Write-Step "Create Trusted Signing account $AccountName"
$existing = az trustedsigning show -g $ResourceGroup -n $AccountName -o json 2>$null
if ($existing) {
  Write-Ok "Account already exists"
} else {
  az trustedsigning create `
    --account-name $AccountName `
    --resource-group $ResourceGroup `
    --location $Location `
    --sku Basic `
    -o none
  Write-Ok "Account created"
}

$account = az trustedsigning show -g $ResourceGroup -n $AccountName -o json | ConvertFrom-Json
$accountId = $account.id
Write-Ok "Account id: $accountId"
Write-Host "Endpoint: $Endpoint"

# --- App registration ---
Write-Step "Create Entra app registration for GitHub Actions"
$existingApp = az ad app list --display-name $AppDisplayName --query "[0]" -o json | ConvertFrom-Json
if ($existingApp -and $existingApp.appId) {
  $ClientId = $existingApp.appId
  $AppObjectId = $existingApp.id
  Write-Ok "Reusing app $AppDisplayName ($ClientId)"
} else {
  $createdApp = az ad app create --display-name $AppDisplayName -o json | ConvertFrom-Json
  $ClientId = $createdApp.appId
  $AppObjectId = $createdApp.id
  Write-Ok "Created app $ClientId"
}

# Ensure service principal exists
$sp = az ad sp list --filter "appId eq '$ClientId'" --query "[0]" -o json | ConvertFrom-Json
if (-not $sp) {
  $sp = az ad sp create --id $ClientId -o json | ConvertFrom-Json
  Write-Ok "Created service principal"
} else {
  Write-Ok "Service principal exists"
}
$SpObjectId = $sp.id

Write-Step "Create client secret (shown once)"
$secret = az ad app credential reset --id $AppObjectId --append --display-name "eskusmi-gha-$(Get-Date -Format yyyyMMdd)" -o json | ConvertFrom-Json
$ClientSecret = $secret.password
if (-not $ClientSecret) { throw "Failed to create client secret" }
Write-Ok "Client secret created"

# --- Role assignment ---
Write-Step "Assign Trusted Signing Certificate Profile Signer"
$roleNames = @(
  "Trusted Signing Certificate Profile Signer",
  "Artifact Signing Certificate Profile Signer"
)
$assigned = $false
foreach ($roleName in $roleNames) {
  az role assignment create `
    --role $roleName `
    --assignee-object-id $SpObjectId `
    --assignee-principal-type ServicePrincipal `
    --scope $accountId `
    -o none 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Ok "Assigned role: $roleName"
    $assigned = $true
    break
  }
}
if (-not $assigned) {
  Write-WarnLine "Could not assign known role name automatically. Try:"
  Write-Host "  az role assignment create --role `"Trusted Signing Certificate Profile Signer`" --assignee $ClientId --scope `"$accountId`""
}

# Also grant Identity Verifier to the signed-in user so they can open portal validation
Write-Step "Ensure you can create identity validations in the portal"
$userId = az ad signed-in-user show --query id -o tsv 2>$null
if ($userId) {
  foreach ($roleName in @("Trusted Signing Identity Verifier", "Artifact Signing Identity Verifier")) {
    az role assignment create `
      --role $roleName `
      --assignee-object-id $userId `
      --assignee-principal-type User `
      --scope $accountId `
      -o none 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "Assigned $roleName to signed-in user"
      break
    }
  }
} else {
  Write-WarnLine "Skipped Identity Verifier role (non-fatal)"
}

# --- Identity validation (portal only) ---
$portalUrl = "https://portal.azure.com/#resource$accountId/identityValidations"
Write-Step "Identity validation (PORTAL ONLY — cannot be done via CLI)"
Write-Host @"

Microsoft requires identity validation in the Azure portal (1–20 business days).

1. Open: $portalUrl
2. New identity → Individual (or Organization) → Public
3. Complete email / ID verification
4. When status is Completed, copy Identity validation Id

"@
try { Start-Process $portalUrl } catch { }

if (-not $IdentityValidationId) {
  $IdentityValidationId = Read-Host "Paste Identity validation Id (or press Enter to stop here and re-run later with -IdentityValidationId)"
}

if (-not $IdentityValidationId) {
  Write-WarnLine "Stopped before certificate profile. Re-run with:"
  Write-Host "  pwsh -File scripts/setup-windows-signing.ps1 -IdentityValidationId <GUID> -SkipLogin"
  Write-Host ""
  Write-Host "Partial secrets (save these now — client secret will not be shown again):"
  Write-Host "  AZURE_TENANT_ID=$TenantId"
  Write-Host "  AZURE_CLIENT_ID=$ClientId"
  Write-Host "  AZURE_CLIENT_SECRET=$ClientSecret"
  Write-Host "  AZURE_TRUSTED_SIGNING_ENDPOINT=$Endpoint"
  Write-Host "  AZURE_TRUSTED_SIGNING_ACCOUNT=$AccountName"
  Write-Host "  AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE=$CertificateProfile"
  exit 0
}

# --- Certificate profile ---
Write-Step "Create certificate profile $CertificateProfile"
$profiles = az trustedsigning certificate-profile list -g $ResourceGroup --account-name $AccountName -o json | ConvertFrom-Json
$found = $profiles | Where-Object { $_.name -eq $CertificateProfile }
if ($found) {
  Write-Ok "Certificate profile already exists"
} else {
  az trustedsigning certificate-profile create `
    -g $ResourceGroup `
    --account-name $AccountName `
    -n $CertificateProfile `
    --profile-type PublicTrust `
    --identity-validation-id $IdentityValidationId `
    -o none
  Write-Ok "Certificate profile created"
}

# --- GitHub secrets ---
$secrets = [ordered]@{
  AZURE_TENANT_ID                           = $TenantId
  AZURE_CLIENT_ID                           = $ClientId
  AZURE_CLIENT_SECRET                       = $ClientSecret
  AZURE_TRUSTED_SIGNING_ENDPOINT            = $Endpoint
  AZURE_TRUSTED_SIGNING_ACCOUNT             = $AccountName
  AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE = $CertificateProfile
}

if (-not $SkipGitHub) {
  Write-Step "Push secrets to GitHub Actions"
  if (-not $GitHubRepo) {
    $GitHubRepo = (gh repo view --json nameWithOwner -q .nameWithOwner 2>$null)
  }
  if (-not $GitHubRepo) {
    Write-WarnLine "Could not detect GitHub repo. Pass -GitHubRepo owner/name"
    $SkipGitHub = $true
  } else {
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-WarnLine "gh not authenticated. Run: gh auth login"
      $SkipGitHub = $true
    } else {
      foreach ($key in $secrets.Keys) {
        $secrets[$key] | gh secret set $key --repo $GitHubRepo
        Write-Ok "Set secret $key on $GitHubRepo"
      }
    }
  }
}

if ($SkipGitHub) {
  Write-Step "GitHub secrets (set manually)"
  foreach ($key in $secrets.Keys) {
    Write-Host "  $key=$($secrets[$key])"
  }
}

Write-Step "Done"
Write-Host @"

Next:
  1. Commit/push the signing workflow changes (if not already)
  2. git tag v0.1.4 && git push origin v0.1.4
  3. After the release builds, verify:
       Get-AuthenticodeSignature .\eskusmi-setup.exe

Account:   $AccountName
Profile:   $CertificateProfile
Endpoint:  $Endpoint
Portal:    $portalUrl

"@
