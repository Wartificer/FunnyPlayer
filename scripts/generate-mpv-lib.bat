@echo off
REM Generates mpv.lib from libmpv-2.dll for MSVC linking
REM Run from project root

set DLL_PATH=deps\mpv\lib\libmpv-2.dll
set DEF_PATH=deps\mpv\lib\mpv.def
set LIB_PATH=deps\mpv\lib\mpv.lib

if exist "%LIB_PATH%" (
    echo mpv.lib already exists, skipping generation.
    exit /b 0
)

echo Generating mpv.lib from DLL...

REM Extract exports from the DLL to create a .def file
echo LIBRARY libmpv-2> "%DEF_PATH%"
echo EXPORTS>> "%DEF_PATH%"

REM Use dumpbin to list exports, filter to just function names
for /f "tokens=4" %%a in ('dumpbin /exports "%DLL_PATH%" ^| findstr /r "^ "') do (
    echo %%a>> "%DEF_PATH%"
)

REM Generate .lib from .def
lib /DEF:"%DEF_PATH%" /OUT:"%LIB_PATH%" /MACHINE:X64
if errorlevel 1 (
    echo ERROR: Failed to generate mpv.lib
    exit /b 1
)

echo mpv.lib generated successfully.
