param(
  [string]$Title = "HALCYON",
  [string]$Text = ""
)
$ErrorActionPreference = 'SilentlyContinue'
try {
  [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
  $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
  $textNodes = $template.GetElementsByTagName('text')
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
