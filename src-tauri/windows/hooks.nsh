!macro NSIS_HOOK_PREINSTALL
  ; Stop a running instance so files are not locked during replace.
  nsExec::ExecToLog 'taskkill /F /IM eskusmi.exe /T'
  Pop $0

  ; Always remove a previous NSIS install before laying down the new build.
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\eskusmi" "UninstallString"
  StrCmp $R0 "" eskusmi_preinstall_done 0
  ExecWait '$R0 /S' $0

  eskusmi_preinstall_done:
!macroend
