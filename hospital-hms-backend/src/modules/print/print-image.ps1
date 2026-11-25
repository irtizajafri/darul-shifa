# Direct printing (HMS, 2026-11-24): prints one slip image on a named printer
# with no dialog. Called by print.service.js on the server (Windows).
#   -Image    PNG made from the slip's HTML
#   -Printer  printer name as this PC sees it, e.g. \\RECEPTION1\THERMAL
#   -WidthMm  the slip's width on paper (80 thermal; the slip's own width normal)
#   -MarginMm the slip's page margin (its @page margin), kept on every side
#   -PaperA4  1 = the form asks for A4 portrait (CRF / ECG / Emergency): use
#             the printer's A4 paper, as the browser did
#   -Thermal  1 = roll paper: ask for one page as long as the slip
# Normal paper: the slip is centred across the sheet at its real size (made
# smaller only if the sheet is narrower), like the browser printed it.
# Long images go onto as many pages as needed. Exit code 1 + message on error.
param(
  [Parameter(Mandatory = $true)][string]$Image,
  [Parameter(Mandatory = $true)][string]$Printer,
  [double]$WidthMm = 80,
  [double]$MarginMm = 0,
  [int]$PaperA4 = 0,
  [int]$Thermal = 0
)
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile($Image)
  try {
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $Printer
    if (-not $doc.PrinterSettings.IsValid) { throw "Printer nahi mila: $Printer" }
    $doc.DocumentName = 'Darul Shifa HMS'
    # No "Printing page 1..." window on the server.
    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

    # Size on paper in hundredths of an inch; the height keeps the image's ratio.
    $script:w = [int][Math]::Round($WidthMm / 25.4 * 100)
    $script:h = [int][Math]::Ceiling($script:w * $img.Height / $img.Width)
    if ($Thermal -eq 1) {
      $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('HMS Slip', $script:w, ($script:h + 20))
    }
    if ($PaperA4 -eq 1) {
      $a4 = $doc.PrinterSettings.PaperSizes | Where-Object { $_.Kind -eq [System.Drawing.Printing.PaperKind]::A4 } | Select-Object -First 1
      if ($a4) { $doc.DefaultPageSettings.PaperSize = $a4 }
      $doc.DefaultPageSettings.Landscape = $false
    }
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $script:done = 0
    $script:img = $img
    $script:m = [Math]::Round($MarginMm / 25.4 * 100)
    $script:thermal = ($Thermal -eq 1)

    $doc.add_PrintPage({
      param($sender, $e)
      $g = $e.Graphics
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      # Drawing starts at the printable corner; step back by the hard margins
      # so the slip sits at the paper's corner, as the browser printed it.
      $hx = [double]$e.PageSettings.HardMarginX
      $hy = [double]$e.PageSettings.HardMarginY
      $pageW = [double]$e.PageBounds.Width
      $pageH = [double]$e.PageBounds.Height
      if ($pageW -le 0) { $pageW = $script:w }
      if ($pageH -le 0) { $pageH = $script:h }
      if ($script:thermal) {
        $k = 1.0
        $x = 0.0
        $y = 0.0
        $roomH = $pageH
      } else {
        # Centred across the sheet inside the margin; smaller only if it doesn't fit.
        $roomW = $pageW - 2 * $script:m
        $k = [Math]::Min(1.0, $roomW / $script:w)
        $x = $script:m + ($roomW - $script:w * $k) / 2
        $y = [double]$script:m
        $roomH = ($pageH - 2 * $script:m) / $k
      }
      # Height of the slip (at its real size) that goes on this page.
      $slice = [Math]::Min($roomH, $script:h - $script:done)
      $sy = [double]$script:done / $script:h * $script:img.Height
      $sh = [double]$slice / $script:h * $script:img.Height
      $dest = New-Object System.Drawing.RectangleF(($x - $hx), ($y - $hy), ($script:w * $k), ($slice * $k))
      $src = New-Object System.Drawing.RectangleF(0, $sy, $script:img.Width, $sh)
      $g.DrawImage($script:img, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
      $script:done += $slice
      $e.HasMorePages = ($script:done -lt ($script:h - 2))
    })
    $doc.Print()
  } finally {
    $img.Dispose()
  }
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
