Add-Type -AssemblyName System.Drawing
$bitmap = New-Object Drawing.Bitmap 256,256
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::Transparent)
$brush = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#2559E8'))
$shape = New-Object Drawing.Drawing2D.GraphicsPath
$shape.AddArc(8,8,64,64,180,90); $shape.AddArc(184,8,64,64,270,90); $shape.AddArc(184,184,64,64,0,90); $shape.AddArc(8,184,64,64,90,90); $shape.CloseFigure()
$graphics.FillPath($brush,$shape)
$pen = New-Object Drawing.Pen ([Drawing.Color]::White),14
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
$points = [Drawing.PointF[]]@((New-Object Drawing.PointF 49,133),(New-Object Drawing.PointF 85,133),(New-Object Drawing.PointF 109,78),(New-Object Drawing.PointF 143,180),(New-Object Drawing.PointF 168,120),(New-Object Drawing.PointF 207,120))
$graphics.DrawLines($pen,$points)
$path = Join-Path (Get-Location) 'assets/app.png'; $bitmap.Save($path,[Drawing.Imaging.ImageFormat]::Png)
$bytes = [IO.File]::ReadAllBytes($path)
$stream = [IO.File]::Create((Join-Path (Get-Location) 'assets/app.ico')); $writer = New-Object IO.BinaryWriter $stream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$bytes.Length); $writer.Write([uint32]22); $writer.Write($bytes); $writer.Dispose()
$pen.Dispose(); $brush.Dispose(); $shape.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
