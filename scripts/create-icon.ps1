# 使用 Electron 图形环境生成图标；退出后恢复调用者原有的环境变量。
$previousMode = $env:ELECTRON_RUN_AS_NODE
try {
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  & (Join-Path $PSScriptRoot '../node_modules/.bin/electron.cmd') (Join-Path $PSScriptRoot 'create-icon.cjs')
  if ($LASTEXITCODE -ne 0) {
    throw 'Icon generation failed'
  }
} finally {
  if ($null -ne $previousMode) {
    $env:ELECTRON_RUN_AS_NODE = $previousMode
  }
}
