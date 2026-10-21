$b64 = Get-Content 'C:\Users\User\projects\unfold\src-tauri\icons\32x32.png.base64' -Raw
$bytes = [Convert]::FromBase64String($b64)
[IO.File]::WriteAllBytes('C:\Users\User\projects\unfold\src-tauri\icons\32x32.png', $bytes)
Write-Host 'Done 32x32'