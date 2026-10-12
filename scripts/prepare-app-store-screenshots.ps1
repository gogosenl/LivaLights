param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory,
    [string]$OutputRoot = (Join-Path $PSScriptRoot '..\app-store-screenshots')
)

Add-Type -AssemblyName System.Drawing

$sourceDirectory = (Resolve-Path -LiteralPath $SourceDirectory).Path
$outputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

if (-not (Test-Path -LiteralPath (Join-Path $sourceDirectory '1.png'))) {
    throw "SourceDirectory must contain numbered screenshots starting with 1.png."
}

function New-StoreScreenshot {
    param(
        [string]$SourcePath,
        [string]$DestinationPath,
        [int]$CanvasWidth,
        [int]$CanvasHeight,
        [double]$ForegroundWidthRatio
    )

    $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
    try {
        # App Store rejects PNGs that declare an alpha channel even when every
        # pixel is visually opaque. Use a 24-bit RGB canvas so the exported PNG
        # cannot contain alpha/transparency metadata.
        $canvas = New-Object System.Drawing.Bitmap(
            $CanvasWidth,
            $CanvasHeight,
            [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
        )
        try {
            $graphics = [System.Drawing.Graphics]::FromImage($canvas)
            try {
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

                # Produce a soft, darkened game-art backdrop without distorting the foreground UI.
                $tinyWidth = 40
                $tinyHeight = [Math]::Max(40, [int]($tinyWidth * $CanvasHeight / $CanvasWidth))
                $tiny = New-Object System.Drawing.Bitmap($tinyWidth, $tinyHeight)
                try {
                    $tinyGraphics = [System.Drawing.Graphics]::FromImage($tiny)
                    try {
                        $tinyGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
                        $tinyGraphics.DrawImage($source, 0, 0, $tinyWidth, $tinyHeight)
                    }
                    finally { $tinyGraphics.Dispose() }

                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $graphics.DrawImage($tiny, 0, 0, $CanvasWidth, $CanvasHeight)
                }
                finally { $tiny.Dispose() }

                $shade = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(205, 2, 19, 28))
                try { $graphics.FillRectangle($shade, 0, 0, $CanvasWidth, $CanvasHeight) }
                finally { $shade.Dispose() }

                $maxWidth = [int]($CanvasWidth * $ForegroundWidthRatio)
                $maxHeight = [int]($CanvasHeight * 0.94)
                $scale = [Math]::Min($maxWidth / $source.Width, $maxHeight / $source.Height)
                $drawWidth = [int]($source.Width * $scale)
                $drawHeight = [int]($source.Height * $scale)
                $x = [int](($CanvasWidth - $drawWidth) / 2)
                $y = [int](($CanvasHeight - $drawHeight) / 2)

                $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
                try { $graphics.FillRectangle($shadowBrush, $x + 18, $y + 24, $drawWidth, $drawHeight) }
                finally { $shadowBrush.Dispose() }

                $graphics.DrawImage($source, $x, $y, $drawWidth, $drawHeight)

                $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 222, 187, 96), 4)
                try { $graphics.DrawRectangle($borderPen, $x, $y, $drawWidth - 1, $drawHeight - 1) }
                finally { $borderPen.Dispose() }
            }
            finally { $graphics.Dispose() }

            $destinationDirectory = Split-Path $DestinationPath -Parent
            [System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
            $canvas.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally { $canvas.Dispose() }
    }
    finally { $source.Dispose() }
}

1..7 | ForEach-Object {
    $sourcePath = Join-Path $sourceDirectory "$_.png"
    New-StoreScreenshot -SourcePath $sourcePath -DestinationPath (Join-Path $outputRoot "iphone-6.7\$_.png") -CanvasWidth 1242 -CanvasHeight 2688 -ForegroundWidthRatio 0.92
    New-StoreScreenshot -SourcePath $sourcePath -DestinationPath (Join-Path $outputRoot "ipad-13\$_.png") -CanvasWidth 2048 -CanvasHeight 2732 -ForegroundWidthRatio 0.66
}

Write-Output "Created App Store screenshots in $outputRoot"
