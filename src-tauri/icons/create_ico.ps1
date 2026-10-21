Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(0, 212, 170), 2)
$g.DrawLine($pen, 16, 4, 16, 28)
$g.DrawLine($pen, 4, 16, 28, 16)
$bmp.Save('C:\Users\User\projects\unfold\src-tauri\icons\icon.ico', [System.Drawing.Imaging.ImageFormat]::Icon)
$g.Dispose()
$bmp.Dispose()
Write-Host 'Done icon.ico'