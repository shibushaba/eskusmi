!macro NSIS_HOOK_PREINSTALL
  ExecWait 'taskkill /F /IM eskusmi.exe /T' $0
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\eskusmi" "UninstallString"
  StrCmp $R0 "" +2 0
  ExecWait '$R0 /S' $0
!macroend
