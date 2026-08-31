$action = New-ScheduledTaskAction -Execute "C:\Users\LazyT\AppData\Local\Programs\Python\Python311\pythonw.exe" -Argument "ScrapedDuck-master\scrape.py" -WorkingDirectory "C:\Users\LazyT\Documents\PoGo_Website"

$triggerHourly = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName "PoGoScrapedDuck_Hourly" `
    -Action $action `
    -Trigger $triggerHourly `
    -User $env:USERNAME `
    -Description "Scrapes PoGo website data every hour completely in background using pythonw.exe" `
    -Force

Write-Host "Task PoGoScrapedDuck_Hourly updated to run silently with pythonw.exe!"
