# PRP 09: Export & Import

## Feature Overview

Allow users to export all their todos (including subtasks, tags, and associations) as a versioned JSON file, and import a previously exported file to restore or migrate data. Import performs ID remapping and resolves tag name conflicts by reusing existing tags.

---

## User Stories

- **As a user**, I want to export my todos to a JSON file so I can back up my data.
- **As a user**, I want to import a JSON backup to restore my todos.
- **As a user**, I want the import to preserve subtasks, tags, and all metadata.
- **As a user**, I want clear feedback on how many todos, subtasks, and tags were imported.
- **As a user**, I want clear error messages if I try to import an invalid file.

---

## User Flow

### Export
1. User clicks the "Export" button in the toolbar
2. The browser downloads a file named `todos-export-YYYY-MM-DD.json`
3. File contains all todos, subtasks, tags, and associations in a versioned JSON format

### Import
1. User clicks the "Import" button in the toolbar
2. A file picker opens (accepts `.json` files only)
3. User selects an exported JSON file
4. App validates the file format and shows a preview: "Ready to import: 15 todos, 42 subtasks, 7 tags"
5. User confirms
6. Import runs; todos appear in the Active/Overdue/Completed sections
7. Success toast: "Imported 15 todos, 42 subtasks, 7 tags"

---

## Technical Requirements

### Export Format

```json
{
  "version": "1.0",
  "exported_at": "2025-01-15T10:30:00.000Z",
  "todos": [
    {
      "id": 1,
      "title": "Write report",
      "completed": false,
      "priority": "high",
      "due_date": "2025-01-20T09:00:00.000Z",
      "is_recurring": false,
      "recurrence_pattern": null,
      "reminder_minutes": 60,
      "subtasks": [
        { "id": 1, "title": "Outline", "completed": true, "position": 0 }
      ],
      "tags": [
        { "id": 2, "name": "Work", "color": "#3B82F6" }
      ]
    }
  ],
  "tags": [
    { "id": 1, "name": "Personal", "color": "#10B981" },
    { "id": 2, "name": "Work", "color": "#3B82F6" }
  ]
}
```

### API Endpoints

**`GET /api/todos/export`**
- Requires authentication
- Returns JSON response (not a file download — client triggers download)
- Fetches all todos with joined subtasks and tags for the current user
- Adds `version`, `exported_at` fields

**`POST /api/todos/import`**
- Requires authentication
- Request body: the full export JSON object
- Validates format (checks `version` field and required todo fields)
- Performs ID remapping and tag conflict resolution
- Returns: `{ imported: { todos: number, subtasks: number, tags: number } }`

### ID Remapping

Old IDs from the export file must not be used directly (they belong to the exporting user's DB). Map old IDs to new auto-incremented IDs:

```typescript
function importTodos(data: ExportData, userId: number) {
  const tagIdMap = new Map<number, number>();  // oldId → newId
  const todoIdMap = new Map<number, number>(); // oldId → newId

  // 1. Import tags (reuse existing if name matches)
  for (const tag of data.tags) {
    const existing = tagDB.findByName(userId, tag.name);
    if (existing) {
      tagIdMap.set(tag.id, existing.id);
    } else {
      const newTag = tagDB.create({ user_id: userId, name: tag.name, color: tag.color });
      tagIdMap.set(tag.id, newTag.id);
    }
  }

  // 2. Import todos
  for (const todo of data.todos) {
    const newTodo = todoDB.create({
      user_id: userId,
      title: todo.title,
      completed: todo.completed ? 1 : 0,
      priority: todo.priority,
      due_date: todo.due_date,
      is_recurring: todo.is_recurring ? 1 : 0,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
    });
    todoIdMap.set(todo.id, newTodo.id);

    // 3. Import subtasks
    for (const subtask of todo.subtasks ?? []) {
      subtaskDB.create({
        todo_id: newTodo.id,
        title: subtask.title,
        completed: subtask.completed ? 1 : 0,
        position: subtask.position,
      });
    }

    // 4. Re-associate tags
    for (const tag of todo.tags ?? []) {
      const newTagId = tagIdMap.get(tag.id);
      if (newTagId) tagDB.addTagToTodo(newTodo.id, newTagId);
    }
  }

  return {
    todos: todoIdMap.size,
    subtasks: data.todos.reduce((sum, t) => sum + (t.subtasks?.length ?? 0), 0),
    tags: tagIdMap.size,
  };
}
```

### TypeScript Types

```typescript
interface ExportData {
  version: string;
  exported_at: string;
  todos: ExportedTodo[];
  tags: ExportedTag[];
}

interface ExportedTodo {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date?: string;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number;
  subtasks: ExportedSubtask[];
  tags: ExportedTag[];
}

interface ExportedSubtask {
  id: number;
  title: string;
  completed: boolean;
  position: number;
}

interface ExportedTag {
  id: number;
  name: string;
  color: string;
}

interface ImportResult {
  imported: {
    todos: number;
    subtasks: number;
    tags: number;
  };
}
```

### Validation

```typescript
function validateExportData(data: unknown): data is ExportData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.version !== '1.0') return false;
  if (!Array.isArray(d.todos)) return false;
  if (!Array.isArray(d.tags)) return false;
  for (const todo of d.todos as unknown[]) {
    const t = todo as Record<string, unknown>;
    if (typeof t.title !== 'string' || !t.title.trim()) return false;
  }
  return true;
}
```

---

## UI Components

### Export Button

```tsx
<button onClick={exportTodos} className="btn-secondary">
  ⬇️ Export
</button>

async function exportTodos() {
  const res = await fetch('/api/todos/export');
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todos-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Import Button

```tsx
<label className="btn-secondary cursor-pointer">
  ⬆️ Import
  <input
    type="file"
    accept=".json"
    className="hidden"
    onChange={handleImport}
  />
</label>

async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    const res = await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      showError(err.error);
      return;
    }
    const result: ImportResult = await res.json();
    showSuccess(`Imported ${result.imported.todos} todos, ${result.imported.subtasks} subtasks, ${result.imported.tags} tags`);
    refreshTodos();
  } catch {
    showError('Invalid JSON file. Please select a valid export file.');
  }
}
```

---

## Edge Cases

- **Invalid JSON file**: Client-side `JSON.parse` throws; show "Invalid JSON file" error
- **Wrong format (missing version)**: API returns `400 Bad Request` with "Invalid export format"
- **Tag name conflict**: Reuse existing tag by name — do NOT create a duplicate
- **Import into non-empty list**: Imported todos are added alongside existing ones (not a replace)
- **Completed todos in export**: Imported with `completed = true` — appear in Completed section
- **Overdue todos in export**: Past due dates preserved — appear in Overdue section
- **Empty export file**: `{ todos: [], tags: [] }` — import succeeds with counts of 0
- **Duplicate todo titles**: Allowed — no deduplication during import
- **Large file**: No enforced size limit on import; large files may take several seconds

---

## Acceptance Criteria

- [ ] Export creates a valid JSON file with all todos, subtasks, and tags
- [ ] Export filename includes the current date
- [ ] Import validates the file format (version field and required fields)
- [ ] Import preserves all todo metadata (priority, due date, recurring, reminder)
- [ ] Import recreates subtasks for each todo
- [ ] Import re-associates tags by name (reuses existing tags, no duplicates)
- [ ] Success message shows count of imported todos, subtasks, and tags
- [ ] Invalid JSON file shows a clear error message
- [ ] Invalid format (wrong version) shows a clear error message
- [ ] Imported todos appear immediately in the todo list

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/09-export-import.spec.ts
test('Export creates downloadable JSON file')
test('Export JSON contains all todos with subtasks and tags')
test('Import valid export file - todos appear in list')
test('Import preserves priority, due date, and metadata')
test('Import preserves subtasks')
test('Import re-associates tags by name')
test('Import does not create duplicate tags')
test('Import invalid JSON - shows error message')
test('Import wrong format (missing version) - shows error')
test('Import empty export - succeeds with 0 counts')
```

### Unit Tests

```typescript
// tests/unit/export-import.test.ts
test('ID remapping creates new IDs for all todos')
test('Tag conflict resolution reuses existing tag by name')
test('validateExportData returns false for missing version')
test('validateExportData returns false for empty todo title')
test('importTodos returns correct counts')
```

---

## Out of Scope

- CSV export format
- Selective export (exporting a subset of todos)
- Import merge conflict resolution UI (silent reuse of existing tags)
- Cloud backup integrations (Dropbox, Google Drive)
- Scheduled automatic backups

---

## Success Metrics

- Export completes in < 2 seconds for 500 todos
- Import of 500 todos completes in < 5 seconds
- Zero data loss during export → import roundtrip
- No duplicate tags created during import
