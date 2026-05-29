# PRP 07: Template System

## Feature Overview

Allow users to save a configured todo as a reusable template (including subtasks, priority, tags, recurrence pattern, and reminder). Users can later create new todos from a template, with a relative due date offset from today. Templates can be organized by category and managed via a modal.

---

## User Stories

- **As a user**, I want to save a todo as a template so I can quickly recreate it with the same settings.
- **As a user**, I want templates to include my subtasks, tags, priority, and other settings.
- **As a user**, I want to browse templates by category and preview their settings before using them.
- **As a user**, I want to create a new todo from a template with a recalculated due date.
- **As a user**, I want to edit or delete templates I no longer need.

---

## User Flow

### Save Todo as Template
1. User clicks "Save as Template" on an existing todo
2. A modal opens with fields: Template Name (pre-filled from todo title), Description, Category
3. User confirms
4. Template saved with all todo metadata and subtasks serialized as JSON

### Use a Template
1. User clicks "Use Template" button in the toolbar
2. A template selection modal opens with optional category filter
3. Each template shows a preview: name, description, priority, tags, subtasks count, recurrence
4. User selects a template and clicks "Create Todo"
5. A new todo is created with:
   - Title from template
   - Priority, recurrence, reminder from template
   - Tags from template (re-associated)
   - Subtasks recreated from JSON
   - Due date = today + `due_date_offset` days (if offset was stored)

### Manage Templates
1. User opens the template management modal (same as "Use Template" or a dedicated "Manage" link)
2. User can edit a template (opens edit form) or delete it (with confirmation)

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT CHECK(recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  reminder_minutes INTEGER,
  due_date_offset INTEGER,   -- days from today when creating from template
  subtasks_json TEXT,        -- JSON array of { title: string, position: number }
  tags_json TEXT,            -- JSON array of tag names (re-matched on use)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates` | List all templates for current user (optionally filtered by category) |
| `POST` | `/api/templates` | Create a new template |
| `PUT` | `/api/templates/[id]` | Update a template |
| `DELETE` | `/api/templates/[id]` | Delete a template |
| `POST` | `/api/templates/[id]/use` | Create a todo from a template |

### TypeScript Types

```typescript
interface Template {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  category?: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number;
  due_date_offset?: number;    // days
  subtasks_json?: string;      // JSON array
  tags_json?: string;          // JSON array of tag names
  created_at: string;
  updated_at: string;
}

interface SubtaskTemplate {
  title: string;
  position: number;
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number;
  due_date_offset?: number;
  subtasks?: SubtaskTemplate[];
  tag_names?: string[];
}
```

### Subtasks JSON Serialization

```typescript
// When saving template
const subtasksJson = JSON.stringify(
  todo.subtasks?.map((s, i) => ({ title: s.title, position: i })) ?? []
);

// When using template
const subtaskTemplates: SubtaskTemplate[] = JSON.parse(template.subtasks_json ?? '[]');
for (const st of subtaskTemplates) {
  subtaskDB.create({ todo_id: newTodo.id, title: st.title, position: st.position });
}
```

### Due Date Offset Calculation

```typescript
import { getSingaporeNow } from '@/lib/timezone';
import { addDays } from 'date-fns';

function calculateDueDateFromOffset(offset?: number): string | undefined {
  if (offset == null) return undefined;
  return addDays(getSingaporeNow(), offset).toISOString();
}
```

### Tag Re-association on Use

```typescript
// Match tag names to current user's tags; skip tags that no longer exist
const userTags = tagDB.getTagsForUser(userId);
const tagNames: string[] = JSON.parse(template.tags_json ?? '[]');
for (const name of tagNames) {
  const tag = userTags.find(t => t.name === name);
  if (tag) tagDB.addTagToTodo(newTodo.id, tag.id);
}
```

---

## UI Components

### Save as Template Button (Todo Card)

```tsx
<button onClick={() => openSaveTemplateModal(todo)} className="btn-secondary text-sm">
  📋 Save as Template
</button>
```

### Save Template Modal

```tsx
<Modal title="Save as Template">
  <input type="text" label="Template Name" defaultValue={todo.title} />
  <textarea label="Description (optional)" />
  <input type="text" label="Category (optional)" placeholder="e.g., Work, Personal" />
  <button type="submit">Save Template</button>
</Modal>
```

### Use Template Modal

```tsx
<Modal title="Use a Template">
  {/* Category Filter */}
  <select onChange={setCategoryFilter}>
    <option value="">All Categories</option>
    {categories.map(c => <option key={c} value={c}>{c}</option>)}
  </select>

  {/* Template List */}
  {filteredTemplates.map(template => (
    <div key={template.id} className="border rounded p-3">
      <h3 className="font-medium">{template.name}</h3>
      {template.description && <p className="text-sm text-gray-500">{template.description}</p>}
      <div className="flex gap-2 flex-wrap mt-1 text-xs">
        <span>Priority: {template.priority}</span>
        {template.is_recurring && <span>🔄 {template.recurrence_pattern}</span>}
        {template.reminder_minutes && <span>🔔 Reminder set</span>}
        {template.subtasks_json && (
          <span>{JSON.parse(template.subtasks_json).length} subtasks</span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => useTemplate(template.id)} className="btn-primary text-sm">
          Create Todo
        </button>
        <button onClick={() => editTemplate(template)} className="btn-secondary text-sm">Edit</button>
        <button onClick={() => deleteTemplate(template.id)} className="btn-danger text-sm">Delete</button>
      </div>
    </div>
  ))}
</Modal>
```

---

## Edge Cases

- **Empty template name**: Validation error — "Template name is required"
- **Duplicate template name**: Allowed (templates are identified by ID, not name)
- **Tag deleted since template was saved**: Skip the missing tag silently when using template
- **No templates yet**: Empty state — "No templates yet. Save a todo as a template to get started."
- **Template with no subtasks**: `subtasks_json` = `'[]'`; no subtasks created on use
- **Template with no due date offset**: New todo created without a due date
- **Very long subtasks list**: No limit enforced, JSON serialization handles all sizes
- **Concurrent use of same template**: Each use creates an independent new todo

---

## Acceptance Criteria

- [ ] Can save a todo as a template (captures name, priority, recurrence, reminder, subtasks, tags)
- [ ] Templates listed in "Use Template" modal with preview
- [ ] Category filter in template modal works
- [ ] Using a template creates a new todo with all settings
- [ ] Subtasks from template are recreated on the new todo
- [ ] Tags from template are re-associated (by name) on the new todo
- [ ] Due date calculated as today + offset (if offset was stored)
- [ ] Can edit an existing template
- [ ] Can delete a template (does not affect todos created from it)

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/07-template-system.spec.ts
test('Save todo as template - appears in Use Template modal')
test('Create todo from template - inherits title and priority')
test('Create todo from template - subtasks recreated')
test('Create todo from template - tags re-associated')
test('Template preview shows correct settings')
test('Filter templates by category')
test('Edit template name and description')
test('Delete template - no longer in list')
test('Using template does not modify original todo')
```

### Unit Tests

```typescript
// tests/unit/template.test.ts
test('Subtask JSON serialization: subtasks → JSON → subtasks')
test('Tag names serialized and matched on use')
test('Due date offset calculation uses Singapore timezone')
test('Missing tags on use are skipped without error')
```

---

## Out of Scope

- Sharing templates between users
- Template versioning or history
- Importing/exporting templates separately (covered by Export/Import feature)
- Template marketplace or public templates
- Template groups or folders beyond category string

---

## Success Metrics

- Template creation completes in < 500ms
- Using a template creates a fully configured todo in < 500ms
- Subtask JSON roundtrip preserves all subtask titles and positions
- Tag re-association correctly handles missing tags without crashing
