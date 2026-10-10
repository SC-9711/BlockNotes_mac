$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $taskRoot
New-Item -ItemType Directory -Force '.local/tooling' | Out-Null
function Ensure-Asset([string]$Name, [string]$Url, [string]$Sha1) {
 $target = [IO.Path]::GetFullPath((Join-Path $taskRoot ('.local/tooling/' + $Name)))
 if (!$target.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Tooling path escaped project' }
 if (Test-Path -LiteralPath $target) {
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA1).Hash.ToLower() -eq $Sha1) { return $target }
  throw "Existing asset checksum mismatch: $target"
 }
 $partial = $target + '.download'
 & curl.exe -fL --ssl-revoke-best-effort --retry 2 --connect-timeout 15 --max-time 180 -o $partial $Url
 if ($LASTEXITCODE -ne 0) { throw "Asset download failed: $Name" }
 if ((Get-FileHash -LiteralPath $partial -Algorithm SHA1).Hash.ToLower() -ne $Sha1) { throw "Downloaded asset checksum mismatch: $Name" }
 Move-Item -LiteralPath $partial -Destination $target
 return $target
}
$client = Ensure-Asset 'minecraft-1.21-client.jar' 'https://piston-data.mojang.com/v1/objects/0e9a07b9bb3390602f977073aa12884a4ce12431/client.jar' '0e9a07b9bb3390602f977073aa12884a4ce12431'
$fontZip = Ensure-Asset 'unifont.zip' 'https://resources.download.minecraft.net/66/666999116c467f10622db1527a06ddc0a6efad2a' '666999116c467f10622db1527a06ddc0a6efad2a'
& "$PSScriptRoot/extract-minecraft.ps1" -ClientArchive $client
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($fontZip)
New-Item -ItemType Directory -Force '.local/tooling/unifont','public/minecraft/font/source' | Out-Null
try {
 [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry('unifont_all_no_pua-15.1.05.hex'), (Join-Path $taskRoot '.local/tooling/unifont/unifont_all_no_pua-15.1.05.hex'), $true)
 [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry('LICENSE.txt'), (Join-Path $taskRoot 'public/minecraft/font/LICENSE-Unifont.txt'), $true)
} finally { $archive.Dispose() }
& node "$PSScriptRoot/build-pixel-font.mjs"
if ($LASTEXITCODE -ne 0) { throw 'Pixel font build failed' }
Copy-Item -LiteralPath '.local/tooling/unifont/unifont_all_no_pua-15.1.05.hex' -Destination 'public/minecraft/font/source/'
Copy-Item -LiteralPath 'scripts/build-pixel-font.mjs' -Destination 'public/minecraft/font/source/'
& "$PSScriptRoot/setup-local-sounds.ps1"
& node "$PSScriptRoot/setup-local-music.mjs"
if ($LASTEXITCODE -ne 0) { throw 'Original music resource setup failed' }
Write-Output 'Local Java 1.21 resource pack is ready.'
