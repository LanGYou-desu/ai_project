# ============================================================
# Audio Forensics Lab - voice asset generator
# Uses Windows built-in TTS (System.Speech / SAPI).
# Texts are read from voice-texts.json (UTF-8) to avoid
# encoding issues with PowerShell 5.1 script parsing.
# Output: tools\voice\case*.wav (22050Hz/16bit/mono - clear voice)
# These wavs are embedded into js/voices.js; this script is
# only needed to regenerate them.
# ============================================================
Add-Type -AssemblyName System.Speech

$dir = Join-Path $PSScriptRoot 'voice'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$texts = Get-Content (Join-Path $PSScriptRoot 'voice-texts.json') -Encoding UTF8 -Raw | ConvertFrom-Json

# 22050Hz / 16bit / mono - clear voice (case1 is downsampled to 8k phone grit in-game)
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    22050,
    [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 4    # +4 ≈ 4 字/秒，正常中文语速（Huihui 默认偏慢）
$synth.Volume = 100

# Prefer a Chinese voice
$zh = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'zh*' } | Select-Object -First 1
if ($zh) {
    $synth.SelectVoice($zh.VoiceInfo.Name)
    Write-Host ("Using voice: " + $zh.VoiceInfo.Name)
} else {
    Write-Warning 'No Chinese voice found, using default (may sound bad).'
}

function Speak-File([string]$name, [string]$text) {
    $synth.SetOutputToWaveFile((Join-Path $dir "$name.wav"), $fmt)
    $synth.Speak($text)
    $synth.SetOutputToNull()
    $size = (Get-Item (Join-Path $dir "$name.wav")).Length
    Write-Host ("{0}.wav  ({1} bytes)" -f $name, $size)
}

# Case 1: rainy-night voicemail (meeting codeword)
Speak-File 'case1' $texts.case1
# Case 2: reversed lullaby (hiding place)
Speak-File 'case2' $texts.case2
# Case 6: finale - ghost frequency (sunken ship beacon)
Speak-File 'case6' $texts.case6

$synth.Dispose()
Write-Host 'Done.'
