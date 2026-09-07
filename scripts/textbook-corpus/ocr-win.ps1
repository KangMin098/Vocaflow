# scripts/textbook-corpus/ocr-win.ps1
# 스캔 PDF 를 Windows 내장 OCR 로 읽는다 — 외부 엔진 설치 없이.
#
# 이 환경에는 tesseract 도 한글오피스도 없다. 그런데 Windows 11 에는
# Windows.Data.Pdf(페이지 렌더러)와 Windows.Media.Ocr(인식기)이 들어 있고,
# 한국어 인식기는 라틴 문자도 함께 읽는다. 영어 교재 스캔본에 그대로 쓸 수 있다.
#
# 사용:
#   powershell -ExecutionPolicy Bypass -File ocr-win.ps1 -Pdf <경로> -OutDir <폴더> [-Scale 2.0] [-From 1] [-To 0]
#
# 산출: <OutDir>/page-0001.txt … 쪽마다 한 파일. 이미 있으면 건너뛴다(재실행 안전).

param(
  [Parameter(Mandatory=$true)][string]$Pdf,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [double]$Scale = 2.0,
  [int]$From = 1,
  [int]$To = 0,
  [string]$Lang = 'ko'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

# WinRT 비동기를 PowerShell 에서 기다리는 표준 우회. AsTask 오버로드를 반사로 골라 쓴다.
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $resultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

# 타입 로드 (ContentType=WindowsRuntime 없이는 PS 가 WinRT 형식을 못 찾는다)
[Windows.Data.Pdf.PdfDocument, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Lang))
if ($null -eq $engine) {
  Write-Error "OCR 인식기를 만들 수 없다: $Lang. 설치된 언어: $(([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }) -join ', ')"
  exit 2
}

$maxDim = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
Write-Output "maxImageDimension=$maxDim"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Pdf).Path)) ([Windows.Storage.StorageFile])
$doc  = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])

$total = $doc.PageCount
$last  = if ($To -gt 0) { [Math]::Min($To, $total) } else { $total }
Write-Output "pages=$total range=$From..$last lang=$Lang scale=$Scale"

for ($i = $From; $i -le $last; $i++) {
  $name = 'page-{0:D4}.txt' -f $i
  $out  = Join-Path $OutDir $name
  if (Test-Path $out) { continue }

  $page = $doc.GetPage([uint32]($i - 1))
  try {
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $opts = [Windows.Data.Pdf.PdfPageRenderOptions]::new()

    # 인식기에는 최대 이미지 변이 있다(보통 10,000px). 큰 판형 PDF 를 그대로 확대하면
    # "Image dimensions are too large" 로 **그 문서 전체가 실패한다** — 쪽마다 배율을 눌러 준다.
    $w = [double]$page.Size.Width
    $h = [double]$page.Size.Height
    $s = $Scale
    $maxSide = [Math]::Max($w, $h)
    if (($maxSide * $s) -gt $maxDim) { $s = [Math]::Floor($maxDim / $maxSide * 100) / 100 }
    $opts.DestinationWidth = [uint32]($w * $s)

    $renderTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
      $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and -not $_.IsGenericMethod
    })[0].Invoke($null, @($page.RenderToStreamAsync($stream, $opts)))
    $renderTask.Wait(-1) | Out-Null

    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap  = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result  = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $lines = @()
    foreach ($ln in $result.Lines) { $lines += $ln.Text }
    # 중단되어도 반쪽 파일이 남지 않게 임시 파일로 쓰고 옮긴다.
    $tmp = "$out.tmp"
    [System.IO.File]::WriteAllText($tmp, ($lines -join "`n"), [System.Text.Encoding]::UTF8)
    Move-Item -Path $tmp -Destination $out -Force

    $bitmap.Dispose()
    $stream.Dispose()
  } finally {
    $page.Dispose()
  }
  if ($i % 10 -eq 0) { Write-Output "  ..$i/$last" }
}
Write-Output "done"
