# Скрипт для создания установщика из уже упакованной версии
# Требуется NSIS (https://nsis.sourceforge.io/Download)

$appDir = "release\SafeKey-win32-x64"
$installerName = "SafeKey-Setup-1.0.0-x64.exe"
$nsisScript = @"
!define APP_NAME "SafeKey"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "SafeKey"
!define APP_DIR "$appDir"

Name `"${APP_NAME}`"
OutFile `"release\${installerName}`"
InstallDir `"$PROGRAMFILES\${APP_NAME}`"
RequestExecutionLevel user

Page directory
Page instfiles

Section `"Install`"
    SetOutPath `"$INSTDIR`"
    File /r `"${APP_DIR}\*.*`"
    
    CreateShortcut `"$DESKTOP\${APP_NAME}.lnk`" `"$INSTDIR\SafeKey.exe`"
    CreateShortcut `"$SMPROGRAMS\${APP_NAME}.lnk`" `"$INSTDIR\SafeKey.exe`"
    
    WriteUninstaller `"$INSTDIR\Uninstall.exe`"
SectionEnd

Section `"Uninstall`"
    Delete `"$INSTDIR\*.*`"
    RMDir /r `"$INSTDIR`"
    Delete `"$DESKTOP\${APP_NAME}.lnk`"
    Delete `"$SMPROGRAMS\${APP_NAME}.lnk`"
SectionEnd
"@

$nsisScript | Out-File -FilePath "installer.nsi" -Encoding UTF8
Write-Host "NSIS скрипт создан: installer.nsi"
Write-Host "Для создания установщика выполните: makensis installer.nsi"
Write-Host "Или используйте уже упакованную версию из: $appDir"

