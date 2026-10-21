Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$bmp.Save('C:\Users\User\projects\unfold\src-tauri\icons\32x32.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host 'Done 32x32'

$bmp2 = New-Object System.Drawing.Bitmap(128, 128)
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.Clear([System.Drawing.Color]::Transparent)
$bmp2.Save('C:\Users\User\projects\unfold\src-tauri\icons\128x128.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g2.Dispose()
$bmp2.Dispose()
Write-Host 'Done 128x128'