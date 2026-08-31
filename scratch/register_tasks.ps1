$action = New-ScheduledTaskAction -Execute "py.exe" -Argument "ScrapedDuck-master/scrape.py" -WorkingDirectory "C:\Users\LazyT\Documents\PoGo_Website"

$triggerHourly = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask -TaskName "PoGoScrapedDuck_Hourly" -Action $action -Trigger $triggerHourly -Description "Scrapes PoGo website data every 1 hour and updates Firebase Firestore" -User $env:USERNAME -Force

Register-ScheduledTask -TaskName "PoGoScrapedDuck_Startup" -Action $action -Trigger $triggerLogon -Description "Scrapes PoGo website data on Windows startup/logon and updates Firebase Firestore" -User $env:USERNAME -Force

Write-Host "Successfully registered PoGoScrapedDuck tasks in Windows Task Scheduler!"
