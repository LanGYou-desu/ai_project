param(
  [string]$Title = "HALCYON",
  [string]$Text = "",
  [string]$TitleB64 = "",
  [string]$TextB64 = ""
)
$ErrorActionPreference = 'SilentlyContinue'

# 通知正文以 base64 传入（推荐）：内容不经过命令行解析，任何引号/换行/元字符都保持原样
if ($TitleB64) {
  try { $Title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TitleB64)) } catch { }
}
if ($TextB64) {
  try { $Text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($TextB64)) } catch { }
}

try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
  $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
  $textNodes = $template.GetElementsByTagName('text')
  # CreateTextNode 会自动转义 & < > 等字符，正文不会被当成 XML
  $null = $textNodes.Item(0).AppendChild($template.CreateTextNode($Title))
  $null = $textNodes.Item(1).AppendChild($template.CreateTextNode($Text))
  $toast = New-Object Windows.UI.Notifications.ToastNotification $template
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('The Vanished').Show($toast)
} catch {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($Text, $Title, [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
  } catch { }
}
