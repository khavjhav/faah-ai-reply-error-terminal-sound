param(
  [string]$FilePath,
  [double]$Volume = 1.0
)
Add-Type -AssemblyName presentationCore
$player = New-Object System.Windows.Media.MediaPlayer
$player.Open([Uri]::new($FilePath))
$player.Volume = $Volume
$player.Play()
Start-Sleep -Milliseconds 3000
