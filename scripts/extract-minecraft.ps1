param([string]$ClientArchive = '.local/tooling/minecraft-1.21-client.jar')
$ErrorActionPreference = 'Stop'
$expectedHash = '0e9a07b9bb3390602f977073aa12884a4ce12431'
if ((Get-FileHash -LiteralPath $ClientArchive -Algorithm SHA1).Hash.ToLower() -ne $expectedHash) { throw 'Minecraft 1.21 client checksum mismatch' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ClientArchive))
$assetRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/minecraft'))
$selected = @(
 'particles/note.json','textures/particle/note.png',
 'textures/gui/book.png','textures/gui/container/generic_54.png','textures/gui/container/inventory.png',
 'textures/gui/sprites/hud/hotbar.png','textures/gui/sprites/hud/hotbar_selection.png',
 'textures/gui/sprites/container/slot.png','textures/gui/sprites/widget/button.png','textures/gui/sprites/widget/slider.png','textures/gui/sprites/widget/slider_highlighted.png','textures/gui/sprites/widget/slider_handle.png','textures/gui/sprites/widget/slider_handle_highlighted.png','textures/gui/sprites/widget/button_highlighted.png','textures/gui/sprites/widget/button_disabled.png',
 'textures/gui/sprites/widget/page_forward.png','textures/gui/sprites/widget/page_backward.png','textures/gui/sprites/widget/page_forward_highlighted.png','textures/gui/sprites/widget/page_backward_highlighted.png',
 'textures/item/writable_book.png','textures/item/written_book.png','textures/item/book.png','textures/item/name_tag.png','textures/item/compass_00.png','textures/item/compass_16.png',
 'textures/block/oak_planks.png','textures/block/oak_log.png','textures/block/oak_log_top.png','textures/block/stone_bricks.png','textures/block/bookshelf.png','textures/block/glass.png',
 'textures/block/oak_leaves.png','textures/block/flower_pot.png','textures/block/dirt.png','textures/block/grass_block_top.png','textures/block/grass_block_side.png','textures/block/green_wool.png','textures/block/red_wool.png',
 'textures/block/lectern_base.png','textures/block/lectern_front.png','textures/block/lectern_sides.png','textures/block/lectern_top.png',
 'textures/block/lantern.png','textures/entity/chest/normal.png','textures/entity/enchanting_table_book.png','textures/font/ascii.png',
 'models/block/lectern.json','models/block/lantern.json','models/block/lantern_hanging.json','models/block/template_lantern.json','models/block/template_hanging_lantern.json','models/block/flower_pot.json','models/block/block.json',
 'models/block/oak_slab.json','models/block/slab.json','models/block/oak_fence_post.json','models/block/fence_post.json','models/block/oak_stairs.json','models/block/stairs.json','models/block/red_carpet.json','models/block/carpet.json',
 'models/block/potted_oak_sapling.json','models/block/flower_pot_cross.json','textures/block/oak_sapling.png',
 'models/item/bookshelf.json','models/item/chest.json','models/item/lectern.json','models/item/jukebox.json','models/block/jukebox.json','font/default.json','font/include/default.json',
 'textures/block/spruce_planks.png','textures/block/dark_oak_planks.png','textures/block/stripped_spruce_log.png','textures/block/stripped_spruce_log_top.png','textures/block/dark_oak_log.png','textures/block/dark_oak_log_top.png','textures/block/mossy_stone_bricks.png',
 'models/block/spruce_slab.json','models/block/spruce_slab_top.json','models/block/dark_oak_slab.json','models/block/dark_oak_slab_top.json','models/block/spruce_fence_post.json','models/block/dark_oak_stairs.json','models/block/brown_carpet.json','models/block/potted_poppy.json','models/block/ladder.json','models/block/dark_oak_trapdoor_bottom.json'
)
$selected += @('11','13','5','blocks','cat','chirp','creator','creator_music_box','far','mall','mellohi','otherside','pigstep','precipice','relic','stal','strad','wait','ward') | ForEach-Object { 'textures/item/music_disc_' + $_ + '.png' }
try {
 $queue = [System.Collections.Generic.Queue[string]]::new()
 $visited = [System.Collections.Generic.HashSet[string]]::new()
 foreach ($relative in $selected) { $queue.Enqueue($relative) }
 while ($queue.Count -gt 0) {
  $relative = $queue.Dequeue()
  if (!$visited.Add($relative)) { continue }
  $entry = $archive.GetEntry('assets/minecraft/' + $relative)
  if (!$entry) { Write-Warning "Missing optional resource: $relative"; continue }
  $target = [System.IO.Path]::GetFullPath((Join-Path $assetRoot $relative))
  if (!$target.StartsWith($assetRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Asset path escaped root' }
  [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null
  [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
  if ($relative.StartsWith('models/') -and $relative.EndsWith('.json')) {
   $definition = Get-Content -LiteralPath $target -Raw | ConvertFrom-Json
   if ($definition.parent -and !$definition.parent.Contains('builtin/')) { $queue.Enqueue('models/' + $definition.parent.Replace('minecraft:', '') + '.json') }
   if ($definition.textures) { foreach ($property in $definition.textures.PSObject.Properties) { if (!$property.Value.StartsWith('#')) { $queue.Enqueue('textures/' + $property.Value.Replace('minecraft:', '') + '.png') } } }
  }
  if ($relative.EndsWith('.png') -and $archive.GetEntry('assets/minecraft/' + $relative + '.mcmeta')) { $queue.Enqueue($relative + '.mcmeta') }
 }
 $reader = [System.IO.StreamReader]::new($archive.GetEntry('assets/minecraft/lang/en_us.json').Open())
 try { $language = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
 $descriptions = @{}
 foreach ($property in $language.PSObject.Properties) { if ($property.Name.StartsWith('jukebox_song.minecraft.')) { $descriptions['records/' + $property.Name.Substring('jukebox_song.minecraft.'.Length)] = $property.Value } }
 $metadata = @{ version = '1.21'; clientSha1 = $expectedHash; descriptions = $descriptions } | ConvertTo-Json -Depth 3
 [System.IO.File]::WriteAllText((Join-Path $assetRoot 'record-names.json'), $metadata, [System.Text.UTF8Encoding]::new($false))
} finally { $archive.Dispose() }
Write-Output "Selected Minecraft 1.21 resources extracted into $assetRoot"
