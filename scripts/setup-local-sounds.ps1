$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $taskRoot
function Fetch-Verified([string]$Relative, [string]$Url, [string]$Sha1) {
 $target = [IO.Path]::GetFullPath((Join-Path $taskRoot $Relative))
 if (!$target.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Sound resource path escaped project' }
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
 if (Test-Path -LiteralPath $target) {
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA1).Hash.ToLower() -eq $Sha1) { return $target }
  throw "Existing sound resource checksum mismatch: $target"
 }
 $partial = $target + '.download'
 & curl.exe -fL --ssl-revoke-best-effort --retry 2 --connect-timeout 15 --max-time 120 -o $partial $Url
 if ($LASTEXITCODE -ne 0) { throw 'Sound resource download failed' }
 if ((Get-FileHash -LiteralPath $partial -Algorithm SHA1).Hash.ToLower() -ne $Sha1) { throw 'Downloaded sound resource checksum mismatch' }
 Move-Item -LiteralPath $partial -Destination $target
 return $target
}
$indexFile = Fetch-Verified '.local/tooling/minecraft-assets-index.json' 'https://piston-meta.mojang.com/v1/packages/00551f206ccb65cb965fd0aebc14d22cda282db7/17.json' '00551f206ccb65cb965fd0aebc14d22cda282db7'
$index = Get-Content -LiteralPath $indexFile -Raw | ConvertFrom-Json
$definitionAsset = $index.objects.'minecraft/sounds.json'
$definitionHash = $definitionAsset.hash
$definitionFile = Fetch-Verified '.local/tooling/sounds-1.21.json' "https://resources.download.minecraft.net/$($definitionHash.Substring(0,2))/$definitionHash" $definitionHash
$events = Get-Content -LiteralPath $definitionFile -Raw | ConvertFrom-Json
$selected = @('ui.button.click','block.chest.open','block.chest.close','item.book.page_turn','item.book.put','block.chiseled_bookshelf.pickup','block.chiseled_bookshelf.insert')
$manifest = @{version='1.21';definitionSha1=$definitionHash;events=@{};sources=@{}}
foreach ($event in $selected) {
 $definition = $events.$event
 if (!$definition) { throw "Original sound event missing: $event" }
 $manifest.events[$event] = $definition
 foreach ($sample in $definition.sounds) {
  $name = if ($sample -is [string]) { $sample } else { $sample.name }
  $asset = $index.objects."minecraft/sounds/$name.ogg"
  if (!$asset) { throw "Original OGG missing: $name" }
  $hash = $asset.hash
  $null = Fetch-Verified ("public/minecraft/sounds/$name.ogg") "https://resources.download.minecraft.net/$($hash.Substring(0,2))/$hash" $hash
  $manifest.sources[$name] = @{sha1=$hash;size=$asset.size}
 }
}
$manifest | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath 'public/minecraft/sounds/manifest.json' -Encoding UTF8
Write-Output "Original 1.21 sounds: $($manifest.sources.Count) verified OGG files; event weights, volume and pitch retained."
