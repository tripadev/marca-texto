<#
    Instalador do Marca Texto.

    Instala para o usuario atual (sem precisar de administrador):
      irm https://raw.githubusercontent.com/tripadev/marca-texto/main/instalar.ps1 | iex

    Desinstalar:
      &([scriptblock]::Create((irm https://raw.githubusercontent.com/tripadev/marca-texto/main/instalar.ps1))) -Desinstalar

    O que ele mexe na maquina (tudo no perfil do usuario, nada de sistema):
      - %LOCALAPPDATA%\Programs\MarcaTexto      o programa
      - Menu Iniciar                            atalho "Marca Texto"
      - PATH do usuario                         para o comando "marca-texto" funcionar
    O -Desinstalar desfaz os tres.
#>
param(
    [switch]$Desinstalar,
    [switch]$SemAtalho,
    [switch]$NaoAbrir,
    [switch]$Forcar
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # sem isto o download fica absurdamente lento
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$REPO     = 'tripadev/marca-texto'
$destino  = Join-Path $env:LOCALAPPDATA 'Programs\MarcaTexto'
$exe      = Join-Path $destino 'MarcaTexto.exe'
$shim     = Join-Path $destino 'marca-texto.cmd'
$versao   = Join-Path $destino 'versao.txt'
$atalho   = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Marca Texto.lnk'

function Passo($t)  { Write-Host "  $t" }
function Certo($t)  { Write-Host "  $t" -ForegroundColor Green }
function Alerta($t) { Write-Host "  $t" -ForegroundColor Yellow }

function Pararapp {
    $ps = Get-Process 'MarcaTexto', 'Marca Texto' -ErrorAction SilentlyContinue
    if ($ps) {
        Passo 'Fechando o Marca Texto que esta aberto...'
        $ps | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 800
    }
}

function TirarDoPath {
    $atual = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $atual) { return }
    $partes = $atual.Split(';') | Where-Object { $_ -and $_.TrimEnd('\') -ne $destino.TrimEnd('\') }
    [Environment]::SetEnvironmentVariable('Path', ($partes -join ';'), 'User')
}

function PorNoPath {
    $atual = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not $atual) { $atual = '' }
    $jaTem = $atual.Split(';') | Where-Object { $_.TrimEnd('\') -eq $destino.TrimEnd('\') }
    if ($jaTem) { return $false }
    $novo = ($atual.TrimEnd(';') + ';' + $destino).TrimStart(';')
    [Environment]::SetEnvironmentVariable('Path', $novo, 'User')
    return $true
}

# ------------------------------------------------------------------ desinstalar

if ($Desinstalar) {
    Write-Host ''
    Write-Host 'Desinstalando o Marca Texto' -ForegroundColor Cyan
    Pararapp
    if (Test-Path $atalho) { Remove-Item $atalho -Force; Passo 'Atalho do Menu Iniciar removido.' }
    if (Test-Path $destino) { Remove-Item $destino -Recurse -Force; Passo 'Arquivos do programa removidos.' }
    TirarDoPath
    Passo 'PATH do usuario limpo.'
    Write-Host ''
    Certo 'Pronto, o Marca Texto saiu da maquina.'
    Alerta 'Suas preferencias continuam em %APPDATA%\marca-texto (apague a pasta se quiser zerar).'
    Write-Host ''
    return
}

# --------------------------------------------------------------------- instalar

Write-Host ''
Write-Host 'Marca Texto' -ForegroundColor Cyan
Write-Host 'Pincel de anotacao temporaria para a tela.'
Write-Host ''

Passo 'Procurando a versao mais recente no GitHub...'
try {
    $lancamento = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest" `
        -Headers @{ 'User-Agent' = 'marca-texto-instalador' }
} catch {
    Write-Host ''
    Write-Host "  Nao consegui falar com o GitHub: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Verifique a conexao e tente de novo.' -ForegroundColor Red
    Write-Host ''
    return
}

$arquivo = $lancamento.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1
if (-not $arquivo) {
    Write-Host '  A versao mais recente nao tem executavel anexado.' -ForegroundColor Red
    return
}

$tag = $lancamento.tag_name
Passo "Versao encontrada: $tag ($([Math]::Round($arquivo.size / 1MB, 1)) MB)"

if ((Test-Path $versao) -and ((Get-Content $versao -Raw).Trim() -eq $tag) -and (Test-Path $exe) -and (-not $Forcar)) {
    Write-Host ''
    Certo "A versao $tag ja esta instalada. Nada a fazer."
    Passo 'Use -Forcar para reinstalar mesmo assim.'
    Write-Host ''
    return
}

Pararapp
New-Item -ItemType Directory -Path $destino -Force | Out-Null

$temporario = Join-Path $env:TEMP ('marca-texto-' + [Guid]::NewGuid().ToString('N') + '.exe')
Passo 'Baixando...'
try {
    Invoke-WebRequest -Uri $arquivo.browser_download_url -OutFile $temporario `
        -Headers @{ 'User-Agent' = 'marca-texto-instalador' }
} catch {
    Write-Host "  Falha no download: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $temporario) { Remove-Item $temporario -Force -ErrorAction SilentlyContinue }
    return
}

$baixado = (Get-Item $temporario).Length
if ($baixado -lt 1MB) {
    Write-Host "  O arquivo baixado veio incompleto ($baixado bytes)." -ForegroundColor Red
    Remove-Item $temporario -Force -ErrorAction SilentlyContinue
    return
}

Move-Item $temporario $exe -Force
# tira a marca de "arquivo vindo da internet", senao o Windows pergunta a cada abertura
Unblock-File $exe -ErrorAction SilentlyContinue
Set-Content -Path $versao -Value $tag -Encoding ascii
Certo "Instalado em $destino"

# comando "marca-texto" no terminal
@(
    '@echo off',
    'rem Abre o Marca Texto. Ele fica na bandeja, ao lado do relogio.',
    'start "" "%~dp0MarcaTexto.exe" %*'
) -join "`r`n" | Set-Content -Path $shim -Encoding ascii

if (PorNoPath) {
    Passo 'Comando "marca-texto" adicionado ao PATH.'
    Alerta 'Abra um terminal NOVO para o comando funcionar.'
} else {
    Passo 'Comando "marca-texto" ja estava no PATH.'
}

if (-not $SemAtalho) {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($atalho)
    $lnk.TargetPath = $exe
    $lnk.WorkingDirectory = $destino
    $lnk.Description = 'Pincel de anotacao temporaria para a tela'
    $lnk.Save()
    Passo 'Atalho criado no Menu Iniciar.'
}

Write-Host ''
Certo 'Pronto!'
Write-Host ''
Write-Host '  Como usar:' -ForegroundColor Cyan
Write-Host '    F8                      liga e desliga o pincel'
Write-Host '    arrastar o botao esq.   marca a tela (a marca some ao soltar)'
Write-Host '    M / C                   marca-texto / caneta'
Write-Host '    1 a 5                   trocam a cor'
Write-Host '    roda do mouse           muda a espessura'
Write-Host '    Esc                     desliga o pincel'
Write-Host ''
Write-Host '  O programa nao abre janela: fica na bandeja, ao lado do relogio.'
Write-Host '  Clique com o botao direito no icone para as configuracoes.'
Write-Host ''

if (-not $NaoAbrir) {
    Passo 'Abrindo o Marca Texto...'
    Start-Process $exe
    Write-Host ''
}
