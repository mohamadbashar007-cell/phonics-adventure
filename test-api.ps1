# Test registration API
$body = @{
    jsonrpc = "2.0"
    id = 1
    method = "register"
    params = @{
        json = @{
            username = "testuser1"
            password = "password123"
            name = "Test User"
        } | ConvertTo-Json
    }
} | ConvertTo-Json -Depth 3

Write-Host "Sending request..."
Write-Host $body

try {
    $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/trpc/register' `
        -Method Post `
        -ContentType 'application/json' `
        -Body (@{
            username = "testuser1"
            password = "password123"
            name = "Test User"
        } | ConvertTo-Json)
    
    Write-Host "Response Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error: $_"
    Write-Host "Response: $($_.Exception.Response.Content | ConvertFrom-Json)"
}
