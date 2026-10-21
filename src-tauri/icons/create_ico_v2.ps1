Add-Type -AssemblyName System.Drawing

# Create a proper .ico file with multiple sizes
$iconSizes = @(16, 32, 48, 64, 128, 256)
$bitmaps = @()

foreach ($size in $iconSizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 212, 170), [Math]::Max(1, [Math]::Floor($size / 16)))
    $g.DrawLine($pen, $size/2, 2, $size/2, $size-2)
    $g.DrawLine($pen, 2, $size/2, $size-2, $size/2)
    $bitmaps += $bmp
    $g.Dispose()
}

# Save as proper .ico file
$icon = [System.Drawing.Icon]::FromHandle($bitmaps[0].GetHicon())
$stream = [IO.File]::OpenWrite('C:\Users\User\projects\unfold\src-tauri\icons\icon.ico')
$icon.Save($stream)
$stream.Close()

# Cleanup
foreach ($bmp in $bitmaps) { $bmp.Dispose() }

Write-Host 'Done icon.ico (proper format)'