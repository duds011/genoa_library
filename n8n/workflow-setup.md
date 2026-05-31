# n8n Workflow Setup Guide

## Overview

One n8n workflow per teacher. When a new Google Meet transcript lands in the teacher's Google Drive folder, this workflow:

1. Detects the new file
2. Downloads the transcript text
3. Sends to OpenAI GPT-4o for structured lesson analysis
4. Inserts the draft lesson into Supabase
5. Emails the teacher to review

---

## Prerequisites

- n8n Cloud account (€25/mo → 5 workflows)
- Google Workspace account (for Google Drive + Gmail nodes)
- Supabase project set up with schema from `supabase/migrations/001_initial.sql`
- OpenAI API key

---

## Credentials to Set Up in n8n

### 1. Google OAuth2
- Go to n8n Credentials → New → Google OAuth2
- Follow the OAuth flow — use the teacher's Google account
- This gives access to Google Drive + Gmail

### 2. OpenAI
- Go to n8n Credentials → New → OpenAI API
- Paste your OpenAI API key

### 3. Supabase (HTTP Header Auth)
- Go to n8n Credentials → New → Header Auth
- Name: `Supabase Service Role`
- Header Name: `apikey`
- Header Value: your Supabase Service Role key (from Supabase dashboard → Settings → API)
- Also add a second header: `Authorization: Bearer <service_role_key>`

---

## Workflow Nodes

### Node 1: Google Drive Trigger
- **Type**: Google Drive Trigger
- **Credential**: Google OAuth2
- **Trigger**: File Created
- **Folder ID**: paste the ID of the teacher's transcript folder
  (get it from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`)

### Node 2: Code (Parse Filename)
- **Type**: Code
- **Language**: JavaScript
- **Code**:
```javascript
// Expected filename format: "StudentName - YYYY-MM-DD"
// e.g. "James Cooker - 2026-05-22"

const fileName = $input.item.json.name || ''
const fileId = $input.item.json.id

// Remove extension if present
const baseName = fileName.replace(/\.(docx?|txt|vtt|gdoc)$/i, '').trim()

// Try to parse "Student Name - YYYY-MM-DD"
const match = baseName.match(/^(.+?)\s*-\s*(\d{4}-\d{2}-\d{2})$/)

return [{
  json: {
    fileId,
    fileName,
    studentName: match ? match[1].trim() : baseName,
    lessonDate: match ? match[2] : new Date().toISOString().split('T')[0],
  }
}]
```

### Node 3: Google Drive (Download File Content)
- **Type**: Google Drive
- **Operation**: Download
- **File ID**: `{{ $json.fileId }}`
- **Binary Property**: `transcriptFile`

### Node 4: Extract Text (Code Node)
- **Type**: Code
- **Code**:
```javascript
// Get the binary data and convert to text
const binaryData = $input.item.binary?.transcriptFile
if (!binaryData) return [{ json: { ...$input.item.json, fileContent: '' } }]

// Decode base64 content
const text = Buffer.from(binaryData.data, 'base64').toString('utf-8')

// Clean VTT format if needed (remove timestamps)
const cleaned = text
  .replace(/WEBVTT\n/g, '')
  .replace(/^\d{2}:\d{2}:\d{2}\.\d{3} --> .+$/gm, '')
  .replace(/^[0-9]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

return [{
  json: {
    ...$input.item.json,
    fileContent: cleaned,
  }
}]
```

### Node 5: OpenAI (Process Transcript)
- **Type**: OpenAI
- **Operation**: Message
- **Model**: `gpt-4o`
- **System Message**:
```
You are a Japanese lesson recap writer. Given a transcript of a Japanese lesson, return a JSON object with these fields:

- recap: 2-3 sentence plain summary of what was covered (no formatting)
- score: number 0.0–10.0 rating student performance
- talk_percentage: integer 0–100 estimate of how much the student spoke
- grammar_density: one of "Low", "Medium", "Medium-High", "High"
- confidence_label: one of "Building", "Developing", "Confident", "Very Confident"
- teacher_note: a warm, personal 2-3 sentence note from teacher to student about their progress
- audio_script: a clean reading script of all vocabulary and key phrases for the teacher to record
- vocabulary: array of new words, each with:
    word (Japanese), reading (romaji — ALWAYS required), definition (English), example_sentence (Japanese)
- homework: array of tasks mentioned, each with: description
- sections: array of lesson topic breakdowns. Each section has:
    title (e.g. "1. 迎えに来る: To Come Pick Someone Up")
    content (formatted text — see strict rules below)

STRICT CONTENT RULES — no exceptions:
- DO NOT use sub-headers like "Key Vocabulary:", "Key Phrases:", "Grammar Pattern:", "Example Sentences:" — never use these labels
- Start each section with exactly 1-2 short plain sentences introducing the topic. No more.
- Then go directly into bullet points. No labels before them.
- Every bullet point follows this exact 3-line pattern with a blank line between each:

- Japanese word or sentence.
Romaji pronunciation.
English meaning or translation.

- For vocabulary items use this compact format:
- 日本語 / romaji — English meaning

- For grammar patterns use ONE line starting with **Pattern:** followed by the structure
- For tips use ONE line starting with: Natural note: or Important:
- NEVER write more than 2 sentences of plain prose per section. Get to the bullets fast.
- Keep ALL sentences short. One idea per line.
- Aim for 6-14 sections total covering the key topics of the lesson.

Return ONLY valid JSON, no other text.
```
- **User Message**:
```
Student Name: {{ $json.studentName }}
Lesson Date: {{ $json.lessonDate }}

Transcript:
{{ $json.fileContent }}
```
- **Response Format**: Text (we'll parse it in the next node)

### Node 6: Code (Parse OpenAI Response)
- **Type**: Code
- **Code**:
```javascript
const responseText = $input.item.json.message?.content || $input.item.json.text || ''

// Extract JSON from response (handle markdown code blocks)
const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                  responseText.match(/```\n?([\s\S]*?)\n?```/) ||
                  [null, responseText]

let parsed
try {
  parsed = JSON.parse(jsonMatch[1] || responseText)
} catch {
  parsed = { recap: responseText, score: 7.0, talk_percentage: 40, vocabulary: [], homework: [] }
}

return [{
  json: {
    ...$input.item.json,
    aiResult: parsed,
  }
}]
```

### Node 7: HTTP Request (Look Up Student in Supabase)
- **Type**: HTTP Request
- **Method**: GET
- **URL**: `https://YOUR-PROJECT.supabase.co/rest/v1/students`
- **Query Parameters**: `select=id,full_name,email` and `full_name=eq.{{ $json.studentName }}`
- **Headers**:
  - `apikey`: your Supabase anon key
  - `Authorization`: `Bearer YOUR_ANON_KEY`

### Node 8: Code (Validate Student Found)
- **Type**: Code
- **Code**:
```javascript
const students = $input.item.json
if (!Array.isArray(students) || students.length === 0) {
  throw new Error(`Student not found: ${$('Parse Filename').item.json.studentName}`)
}
return [{ json: { 
  studentId: students[0].id,
  studentName: students[0].full_name,
  ...$('Parse OpenAI Response').item.json 
}}]
```

### Node 9: HTTP Request (Insert Lesson)
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `https://YOUR-PROJECT.supabase.co/rest/v1/lessons`
- **Headers**:
  - `apikey`: your Supabase service role key
  - `Authorization`: `Bearer SERVICE_ROLE_KEY`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=representation`
- **Body** (JSON):
```json
{
  "student_id": "{{ $json.studentId }}",
  "teacher_id": "YOUR_TEACHER_USER_ID",
  "lesson_date": "{{ $json.lessonDate }}",
  "status": "draft",
  "raw_transcript": "{{ $json.fileContent }}",
  "drive_file_id": "{{ $json.fileId }}"
}
```

### Node 10: HTTP Request (Insert Lesson Summary)
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `https://YOUR-PROJECT.supabase.co/rest/v1/lesson_summaries`
- **Body** (JSON):
```json
{
  "lesson_id": "{{ $json[0].id }}",
  "recap": "{{ $json.aiResult.recap }}",
  "score": {{ $json.aiResult.score }},
  "talk_percentage": {{ $json.aiResult.talk_percentage }}
}
```

### Node 11: SplitInBatches → HTTP Request (Insert Vocabulary)
- Split `{{ $json.aiResult.vocabulary }}` array
- For each item, POST to `/rest/v1/vocabulary_items`:
```json
{
  "lesson_id": "{{ $('Insert Lesson').item.json[0].id }}",
  "word": "{{ $json.word }}",
  "reading": "{{ $json.reading }}",
  "definition": "{{ $json.definition }}",
  "example_sentence": "{{ $json.example_sentence }}",
  "sort_order": {{ $itemIndex }}
}
```

### Node 12: SplitInBatches → HTTP Request (Insert Homework)
- Split `{{ $json.aiResult.homework }}` array
- For each item, POST to `/rest/v1/homework_items`:
```json
{
  "lesson_id": "{{ $('Insert Lesson').item.json[0].id }}",
  "description": "{{ $json.description }}",
  "sort_order": {{ $itemIndex }}
}
```

### Node 13: Gmail (Notify Teacher)
- **Type**: Gmail
- **Operation**: Send Email
- **To**: teacher's email address
- **Subject**: `📚 New draft lesson ready: {{ $('Parse Filename').item.json.studentName }} - {{ $('Parse Filename').item.json.lessonDate }}`
- **Body**:
```
Hi! A new lesson transcript has been processed.

Student: {{ $('Parse Filename').item.json.studentName }}
Date: {{ $('Parse Filename').item.json.lessonDate }}
Score: {{ $('Parse OpenAI Response').item.json.aiResult.score }}/10

Review and publish it here:
https://your-app.vercel.app/teacher/lessons/{{ $('Insert Lesson').item.json[0].id }}/edit
```

---

## "Check for New Recaps" Webhook Workflow (separate workflow)

This is a **second n8n workflow** triggered by the "Check for new recaps" button in the teacher dashboard. It scans the Google Drive folder on demand and processes any files not yet imported.

### Why it shows "No new files found" without doing anything

n8n webhooks respond **immediately** by default — before any processing nodes run. You must use the **"Respond to Webhook"** node at the END of the workflow, and set the webhook node to **"Wait for response"** mode.

### Setup

**Webhook node (Node 1):**
- **Type**: Webhook
- **HTTP Method**: POST
- **Path**: `check-drive` (this gives URL: `https://your-n8n.app.n8n.cloud/webhook/check-drive`)
- **Response Mode**: `Using Respond to Webhook Node` ← **CRITICAL — must set this**

**List Drive Files (Node 2):**
- **Type**: Google Drive
- **Operation**: List Files
- **Folder**: your transcript folder ID
- **Query**: `mimeType != 'application/vnd.google-apps.folder'`

**Check Already Processed (Node 3):**
- **Type**: Code
```javascript
// Filter out files already in drive_processing_log
const files = $input.all().map(i => i.json)
return files.map(f => ({ json: f }))
// (actual deduplication happens via Supabase query in next node)
```

**For each file — HTTP Request (Node 4): Check Supabase log**
- **Method**: GET
- **URL**: `https://YOUR-PROJECT.supabase.co/rest/v1/drive_processing_log?file_id=eq.{{ $json.id }}&select=file_id`
- **Headers**: apikey + Authorization

**IF node (Node 5): Skip already processed**
- Condition: response array is empty (file not yet processed)
- True branch → run the processing pipeline (same as Nodes 2–12 from the main workflow above)
- False branch → skip

**Respond to Webhook (last node):**
- **Type**: Respond to Webhook
- **Response Body**:
```json
{
  "processed": {{ $('SplitInBatches').context.noItemsLeft ? $('SplitInBatches').context.currentRunIndex : 0 }}
}
```

> **Simpler alternative:** Use a Code node just before "Respond to Webhook" to count how many files were processed and return `{ "processed": N }`.

### Quick fix for existing workflow

If you already have the `check-drive` webhook workflow in n8n but it returns `{}`:

1. Open the workflow in n8n
2. Click the **Webhook** node
3. Change **Response Mode** from `"Immediately"` to **`"Using Respond to Webhook Node"`**
4. Add a **"Respond to Webhook"** node at the end connected to your last processing node
5. Set its body to `{ "processed": 1 }` (hardcoded is fine for now — the button will show a result)
6. Save and make sure the workflow is **Active** (toggle on)

---

## Filename Convention

Teachers must name their transcript files:
```
StudentName - YYYY-MM-DD
```

Examples:
- `James Cooker - 2026-05-22`
- `Maria Santos - 2026-05-23`

Google Meet transcripts are saved as Google Docs in Drive. The Apps Script reads them automatically.

---

## Error Handling

Add an **Error Trigger** node at the start that catches any workflow errors and sends a Gmail notification to the teacher with the error details.

---

## Getting Your Teacher User ID

After creating the teacher's account:
1. Go to Supabase Dashboard → Authentication → Users
2. Copy the UUID of the teacher's account
3. Paste it in Node 9 as `teacher_id`
