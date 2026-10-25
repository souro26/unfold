Add-Type -AssemblyName System.Drawing

function Build-IconFile {
    $sizes = @(32, 128, 256)
    $pngBuffers = @()

    foreach ($sz in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 18, 28))

        # Teal border
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 212, 170), [Math]::Max(1.0, $sz * 0.04))
        $g.DrawRectangle($borderPen, 2, 2, $sz - 4, $sz - 4)

        # Unfold chevron
        $cx = [float]($sz / 2.0)
        $cy = [float]($sz / 2.0)
        $arm = [float]($sz * 0.28)

        $logoPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 240, 190), [Math]::Max(2.0, $sz * 0.08))
        $p1 = New-Object System.Drawing.PointF(($cx - $arm), ($cy - $arm * 0.5))
        $p2 = New-Object System.Drawing.PointF($cx, ($cy + $arm * 0.7))
        $p3 = New-Object System.Drawing.PointF(($cx + $arm), ($cy - $arm * 0.5))
        $p4 = New-Object System.Drawing.PointF($cx, ($cy - $arm * 0.1))

        $g.DrawLine($logoPen, $p1, $p2)
        $g.DrawLine($logoPen, $p2, $p3)
        $g.DrawLine($logoPen, $p3, $p4)

        $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $rad = [Math]::Max(2.0, $sz * 0.08)
        $g.FillEllipse($dotBrush, ($cx - $rad), ($cy - $arm * 0.1 - $rad), ($rad * 2.0), ($rad * 2.0))

        $g.Dispose()

        $pngPath = "C:\Users\User\projects\unfold\src-tauri\icons\$($sz)x$($sz).png"
        $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Saved $pngPath"

        if ($sz -eq 256) {
            $bmp.Save("C:\Users\User\projects\unfold\src-tauri\icons\128x128@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
        }

        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBuffers += ,($ms.ToArray())
        $ms.Dispose()
        $bmp.Dispose()
    }

    # Now create proper multi-icon .ico container
    $icoPath = "C:\Users\User\projects\unfold\src-tauri\icons\icon.ico"
    $fs = [System.IO.File]::Create($icoPath)
    $bw = New-Object System.IO.BinaryWriter($fs)

    $bw.Write([uint16]0) # Reserved
    $bw.Write([uint16]1) # Type 1 = ICO
    $bw.Write([uint16]$sizes.Count) # 3 images

    $offset = 6 + ($sizes.Count * 16)
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $sz = $sizes[$i]
        $bytes = $pngBuffers[$i]
        $bWidth = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }
        $bHeight = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }

        $bw.Write($bWidth)
        $bw.Write($bHeight)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([uint16]1)
        $bw.Write([uint16]32)
        $bw.Write([uint32]$bytes.Length)
        $bw.Write([uint32]$offset)

        $offset += $bytes.Length
    }

    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $bw.Write($pngBuffers[$i])
    }

    $bw.Flush()
    $bw.Close()
    $fs.Close()
    Write-Host "Saved $icoPath with $($sizes.Count) embedded PNG images"
}

Build-IconFile
