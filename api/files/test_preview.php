<?php
/**
 * Test Page for File Preview Functionality
 * Navigate to: /FlowDocs/api/files/test_preview.php
 */

require_once '../../session_config.php';
session_start();
require_once '../../database.php';

// Check if user is logged in
$loggedIn = isset($_SESSION['user_email']);
$userEmail = $loggedIn ? $_SESSION['user_email'] : 'Not logged in';

// Get some test files
$testFiles = [];
if ($conn && $loggedIn) {
    $stmt = $conn->prepare("
        SELECT 
            f.id,
            f.name,
            f.file_type,
            f.file_path,
            u.email as owner
        FROM files f
        LEFT JOIN users u ON f.owner_id = u.id
        LIMIT 10
    ");
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $testFiles[] = $row;
    }
    $stmt->close();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Preview Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 20px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .status {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            background: <?php echo $loggedIn ? '#d4edda' : '#f8d7da'; ?>;
            color: <?php echo $loggedIn ? '#155724' : '#721c24'; ?>;
            border: 1px solid <?php echo $loggedIn ? '#c3e6cb' : '#f5c6cb'; ?>;
        }
        .file-list {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .file-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .file-item:last-child {
            border-bottom: none;
        }
        .file-info {
            flex: 1;
        }
        .file-name {
            font-weight: 600;
            color: #333;
        }
        .file-meta {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
        .test-btn {
            padding: 8px 16px;
            background: #0461CE;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-left: 8px;
            font-size: 13px;
        }
        .test-btn:hover {
            background: #0350a8;
        }
        .test-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .test-result {
            margin-top: 10px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
        }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 0; }
        .library-check {
            display: inline-block;
            margin-right: 15px;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
        }
        .lib-loaded {
            background: #d4edda;
            color: #155724;
        }
        .lib-not-loaded {
            background: #f8d7da;
            color: #721c24;
        }
    </style>
</head>
<body>
    <h1>🔍 File Preview Test Page</h1>
    
    <div class="status">
        <strong>Session Status:</strong> <?php echo $loggedIn ? '✓ Logged in as ' . htmlspecialchars($userEmail) : '✗ Not logged in'; ?>
    </div>

    <div class="test-section">
        <h2>JavaScript Libraries</h2>
        <div id="libraryStatus">Checking...</div>
    </div>

    <?php if ($loggedIn && count($testFiles) > 0): ?>
    <div class="file-list">
        <h2>Test Files (<?php echo count($testFiles); ?> files)</h2>
        <?php foreach ($testFiles as $file): ?>
        <div class="file-item">
            <div class="file-info">
                <div class="file-name"><?php echo htmlspecialchars($file['name']); ?></div>
                <div class="file-meta">
                    ID: <?php echo $file['id']; ?> | 
                    Type: <?php echo htmlspecialchars($file['file_type']); ?> | 
                    Owner: <?php echo htmlspecialchars($file['owner']); ?>
                </div>
            </div>
            <div>
                <a href="preview.php?id=<?php echo $file['id']; ?>" target="_blank" class="test-btn">
                    Preview
                </a>
                <a href="download.php?id=<?php echo $file['id']; ?>" class="test-btn">
                    Download
                </a>
                <button class="test-btn" onclick="testFetch(<?php echo $file['id']; ?>, '<?php echo htmlspecialchars($file['file_type']); ?>')">
                    Test Fetch
                </button>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php elseif ($loggedIn): ?>
    <div class="file-list">
        <p>No files found in database.</p>
    </div>
    <?php else: ?>
    <div class="file-list">
        <p>Please <a href="../../login/login.php">log in</a> to test file previews.</p>
    </div>
    <?php endif; ?>

    <div class="test-section">
        <h2>Fetch Test Results</h2>
        <div id="fetchResults">Click "Test Fetch" on any file above to test the preview endpoint.</div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
    
    <script>
        // Check library loading
        const libraries = {
            'PDF.js': typeof pdfjsLib !== 'undefined',
            'Mammoth.js': typeof mammoth !== 'undefined',
            'SheetJS': typeof XLSX !== 'undefined'
        };

        let statusHTML = '';
        for (const [name, loaded] of Object.entries(libraries)) {
            statusHTML += `<span class="library-check ${loaded ? 'lib-loaded' : 'lib-not-loaded'}">${loaded ? '✓' : '✗'} ${name}</span>`;
        }
        document.getElementById('libraryStatus').innerHTML = statusHTML;

        // Test fetch functionality
        async function testFetch(fileId, fileType) {
            const resultsDiv = document.getElementById('fetchResults');
            resultsDiv.innerHTML = `<p>Testing file ID ${fileId} (${fileType})...</p>`;
            
            const basePath = window.location.pathname.split('/')[1];
            const previewUrl = `/${basePath}/api/files/preview.php?id=${fileId}`;
            
            try {
                const startTime = Date.now();
                const response = await fetch(previewUrl, {
                    credentials: 'same-origin'
                });
                const endTime = Date.now();
                
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                
                let result = `<strong>✓ Fetch Successful</strong>\n\n`;
                result += `URL: ${previewUrl}\n`;
                result += `Status: ${response.status} ${response.statusText}\n`;
                result += `Content-Type: ${contentType}\n`;
                result += `Content-Length: ${contentLength} bytes\n`;
                result += `Time: ${endTime - startTime}ms\n\n`;
                
                if (response.ok) {
                    // Try to read as blob
                    const blob = await response.blob();
                    result += `Blob size: ${blob.size} bytes\n`;
                    result += `Blob type: ${blob.type}\n\n`;
                    
                    // For docx/xlsx, try to read as arrayBuffer
                    if (['docx', 'doc', 'xlsx', 'xls'].includes(fileType)) {
                        const arrayBuffer = await blob.arrayBuffer();
                        result += `ArrayBuffer size: ${arrayBuffer.byteLength} bytes\n`;
                        
                        if (arrayBuffer.byteLength === 0) {
                            result += `\n⚠️ WARNING: Empty arrayBuffer!\n`;
                        } else {
                            result += `✓ ArrayBuffer has data\n`;
                        }
                    }
                    
                    resultsDiv.innerHTML = `<div class="test-result">${result}</div>`;
                } else {
                    result += `❌ Response not OK\n`;
                    const text = await response.text();
                    result += `Response body:\n${text}`;
                    resultsDiv.innerHTML = `<div class="test-result">${result}</div>`;
                }
                
            } catch (error) {
                resultsDiv.innerHTML = `<div class="test-result"><strong>❌ Fetch Failed</strong>\n\nError: ${error.message}\n\nStack:\n${error.stack}</div>`;
            }
        }
    </script>
</body>
</html>
