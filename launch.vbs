' SodalStream launcher: starts the server (hidden) if it isn't running, then opens the app.
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = root

nodeExe = "node"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
  nodeExe = """C:\Program Files\nodejs\node.exe"""
End If

If Not IsUp() Then
  sh.Run nodeExe & " server\src\index.js", 0, False
End If

' Wait up to 15s for the server to come up before opening the browser
For i = 1 To 30
  If IsUp() Then Exit For
  WScript.Sleep 500
Next

sh.Run "http://localhost:4321", 1, False

Function IsUp()
  On Error Resume Next
  IsUp = False
  Dim http
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", "http://127.0.0.1:4321/api/status", False
  http.send
  If Err.Number = 0 Then
    If http.Status = 200 Then IsUp = True
  End If
  Err.Clear
End Function
