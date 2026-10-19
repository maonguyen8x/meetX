# Windows PowerShell: creates the empty source tree (docs/04-folder-structure.md)
$dirs = @(
 ".github/prompts",".github/workflows","docs","infra/caddy","infra/scripts","tests/e2e",
 "packages/shared/src/schemas","packages/shared/src/types","packages/config",
 "apps/api/prisma/migrations","apps/api/test/fakes","apps/api/test/fixtures",
 "apps/api/src/config","apps/api/src/db","apps/api/src/authorization","apps/api/src/plugins","apps/api/src/utils","apps/api/src/jobs",
 "apps/api/src/realtime/pipeline","apps/api/src/integrations/livekit",
 "apps/web/src/components/ui","apps/web/src/hooks","apps/web/src/lib/audio","apps/web/src/stores","apps/web/src/messages","apps/web/src/styles"
)
foreach ($m in "auth","users","organizations","admin","audit","settings","meetings","glossary","memory","export","bots","rooms","usage","notifications") { $dirs += "apps/api/src/modules/$m" }
foreach ($m in "folders","documents","access","conversations","ingestion","parsers","chunking","retrieval","answer/prompts") { $dirs += "apps/api/src/modules/knowledge/$m" }
foreach ($m in "plans","subscriptions","invoices","payments","wallet","webhooks") { $dirs += "apps/api/src/modules/billing/$m" }
foreach ($m in "stt","translate/prompts","tts","meeting-bot","embedding","web-search","payment","mailer","storage","ocr") { $dirs += "apps/api/src/providers/$m" }
foreach ($m in "knowledge","documents","bot-session","room","settings","billing","admin","org","notifications") { $dirs += "apps/web/src/features/$m" }
$app = "apps/web/src/app/[locale]"
foreach ($m in "dashboard/knowledge","documents","meeting-bot","history","billing","usage","notifications","org","admin","room/[id]") { $dirs += "$app/$m" }
foreach ($m in "profile","interpreter","languages","memory","knowledge","privacy","notifications","security","appearance") { $dirs += "$app/settings/$m" }
foreach ($m in "overview","users","orgs","plans","subscriptions","usage","moderation","audit","system") { $dirs += "$app/admin/$m" }
foreach ($m in "members","quotas","profile","billing") { $dirs += "$app/org/$m" }
$root = (Get-Location).Path
foreach ($d in $dirs) {
  $full = Join-Path $root $d
  [System.IO.Directory]::CreateDirectory($full) | Out-Null
}
