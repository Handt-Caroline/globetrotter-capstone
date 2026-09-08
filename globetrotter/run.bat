@echo off
REM Starts the whole GlobeTrotter app (API + React screens) on http://localhost:8000
setlocal enabledelayedexpansion

set "ROOT=%~dp0"

REM ---------------------------------------------------------------------------
REM 1. Build the React app.
REM
REM We always rebuild when npm is available. It only takes a couple of seconds
REM and it means every change - a new screen, a photo dropped into
REM frontend\src\assets\media\, anything - shows up on the next run without
REM having to delete frontend\dist by hand.
REM ---------------------------------------------------------------------------
where npm >nul 2>nul
if %errorlevel%==0 (
  echo ==^> Building the React app...
  cd /d "%ROOT%frontend"
  call npm install || goto :error
  call npm run build || goto :error
  if not exist "%ROOT%frontend\dist\index.html" (
    echo The build finished but frontend\dist\index.html is missing. Check the output above.
    goto :error
  )
) else (
  if not exist "%ROOT%frontend\dist" (
    echo npm is not installed. Install Node.js, or restore the frontend\dist folder.
    goto :error
  )
  echo ==^> npm not found - reusing the existing frontend\dist build.
)

REM ---------------------------------------------------------------------------
REM 2. Python virtual environment + backend requirements.
REM
REM requirements.txt is unchanged: the global chat and the routing proxy
REM (backend\app\routers\chat.py and routing.py) use only the Python standard
REM library, so there is nothing new to install.
REM ---------------------------------------------------------------------------
cd /d "%ROOT%backend"
if not exist ".venv" (
  echo ==^> Creating Python virtual environment...
  python -m venv .venv || goto :error
)
call .venv\Scripts\activate

echo ==^> Installing backend requirements...
pip install -q -r requirements.txt || goto :error

REM ---------------------------------------------------------------------------
REM 3. Optional configuration from backend\.env
REM
REM The backend reads plain environment variables (currently just
REM ORS_API_KEY). Setting one with "set" only lasts for the current terminal,
REM which is easy to lose. If backend\.env exists we load KEY=VALUE lines from
REM it here, so the key sticks between runs. Lines starting with # are ignored.
REM Copy backend\.env.example to backend\.env to get started. .env is
REM gitignored so your key never gets committed.
REM ---------------------------------------------------------------------------
if exist "%ROOT%backend\.env" (
  echo ==^> Loading settings from backend\.env
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ROOT%backend\.env") do (
    set "%%A=%%B"
  )
)

REM ---------------------------------------------------------------------------
REM 4. Note about real street routing.
REM
REM The map and each itinerary's page ask OpenRouteService for routes that
REM follow real streets, which needs a free API key. Without one the app still
REM works: it falls back to a straight-line estimate, draws it as a dashed
REM line, and says on screen that it is an estimate. So this is a note, not an
REM error.
REM ---------------------------------------------------------------------------
if not defined ORS_API_KEY (
  echo.
  echo ==^> Note: ORS_API_KEY is not set, so routes will be straight-line estimates.
  echo     For real street routing, get a free key at
  echo     https://openrouteservice.org/dev/#/signup then either:
  echo       set ORS_API_KEY=your_key_here        ^(this terminal only^)
  echo     or put   ORS_API_KEY=your_key_here   in backend\.env   ^(sticks^)
) else (
  echo ==^> OpenRouteService key found - routes will follow real streets.
)

echo.
echo ==^> GlobeTrotter is starting on http://localhost:8000
echo     API docs: http://localhost:8000/docs   (Ctrl+C to stop)
echo.
uvicorn app.main:app --reload --port 8000
goto :eof

:error
echo.
echo Something went wrong. Check the message above.
exit /b 1
