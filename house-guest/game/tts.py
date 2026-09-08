# -*- coding: utf-8 -*-
"""
tts.py — 语音合成（咕噜的声音）
调用 Windows 自带 PowerShell + System.Speech（SAPI），优先选中文语音。
保持一个常驻子进程，避免反复启动开销。失败时静默降级为文字。
"""
from __future__ import annotations
import subprocess
import threading

_SCRIPT = r"""
Add-Type -AssemblyName System.Speech
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = -1
try {
  $v = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } | Where-Object { $_.Culture.Name -like 'zh*' } | Select-Object -First 1
  if ($v) { $s.SelectVoice($v.Name) }
} catch {}
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line -eq '__QUIT__') { break }
  try { $s.Speak($line) } catch {}
}
"""


class TTS:
    def __init__(self):
        self._proc = None
        self._lock = threading.Lock()
        self.enabled = True

    def _ensure(self) -> None:
        if self._proc is None or self._proc.poll() is not None:
            self._proc = subprocess.Popen(
                ['powershell', '-NoProfile', '-NonInteractive', '-Command', _SCRIPT],
                stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                text=True, encoding='utf-8', errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0,
            )

    def speak(self, text: str, async_ok: bool = True) -> None:
        if not self.enabled or not text:
            return
        text = text.strip()[:180]

        def _do():
            try:
                with self._lock:
                    self._ensure()
                    self._proc.stdin.write(text + '\n')
                    self._proc.stdin.flush()
            except Exception:
                pass

        if async_ok:
            threading.Thread(target=_do, daemon=True).start()
        else:
            _do()

    def shutdown(self) -> None:
        try:
            if self._proc and self._proc.poll() is None:
                with self._lock:
                    self._proc.stdin.write('__QUIT__\n')
                    self._proc.stdin.flush()
                self._proc.wait(timeout=3)
        except Exception:
            pass
        finally:
            self._proc = None
