# PRP 01: Todo CRUD Operations

## Feature Overview

Implement the core Create, Read, Update, Delete (CRUD) operations for todos. This is the foundational feature that all other features build upon. Todos support a title, optional due date (Singapore timezone), and display in three sections: Overdue, Active, and Completed.

---

## User Stories

- **As a user**, I want to create a todo with just a title so I can quickly capture tasks.
- **As a user**, I want to create a todo with a due date, priority, recurring pattern, and reminder so I can plan ahead.
- **As a user**, I want to edit an existing todo to update its details.
- **As a user**, I want to mark a todo as complete to track my progress.
- **As a user**, I want to delete a todo I no longer need (with confirmation).
- **As a user**, I want todos automatically sorted by priority and due date so I can focus on what matters.
- **As a user**, I want to see overdue, active, and completed todos in separate sections.

---

## User Flow

### Create Todo
1. User clicks "Add Todo" button
2. Form appears with title input and optional fields (due date, priority, recurring, reminder)
3. User fills in at least the title
4. User submits form
5. Todo appears in Active section, sorted by priority and due date

### Edit Todo
1. User clicks edit icon on a todo
2. Edit modal opens pre-filled with current values
3. User modifies desired fields
4. User saves changes
5. Todo updates in place (optimistic UI)

### Toggle Completion
1. User clicks the checkbox on a todo
2. Todo immediately moves to Completed section (optimistic update)
3. If recurring, a new instance is automatically created

### Delete Todo
1. User clicks delete icon on a todo
2. Confirmation dialog appears: "Are you sure you want to delete this todo?"
3. User confirms
4. Todo is removed; subtasks and tag associations cascade-deleted

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
  due_date TEXT,                        -- ISO 8601, Singapore timezone
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT CHECK(recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  reminder_minutes INTEGER,
  last_notification_sent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/todos` | Create a new todo |
| `GET` | `/api/todos` | Get all todos for current user |
| `GET` | `/api/todos/[id]` | Get a single todo |
| `PUT` | `/api/todos/[id]` | Update a todo |
| `DELETE` | `/api/todos/[id]` | Delete a todo |

### TypeScript Types

```typescript
type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date?: string;          // ISO 8601, Singapore timezone
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number;
  last_notification_sent?: string;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
  tags?: Tag[];
}

interface CreateTodoInput {
  title: string;
  priority?: Priority;
  due_date?: string;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  reminder_minutes?: number;
}
```

### Validation Rules

- `title`: Required, non-empty after trimming, max 500 characters
- `due_date`: Must be in the future (minimum 1 minute from now, Singapore timezone)
- `recurrence_pattern`: Required if `is_recurring` is true
- `reminder_minutes`: Only valid if `due_date` is set
- `priority`: Must be one of `high`, `medium`, `low`; defaults to `medium`

---

## UI Components

### Todo List Sections
```
Active Section (sorted: high → medium → low → no priority, then by due_date ASC)
Overdue Section (past due_date, incomplete)
Completed Section (completed = true)
```

### Todo Card
- Checkbox (toggle completion)
- Title
- Priority badge (red/yellow/blue)
- Due date display (Singapore timezone, relative if close)
- Recurring badge (🔄) if applicable
- Reminder badge (🔔) if applicable
- Tag badges
- Edit button
- Delete button

### Create/Edit Form Fields
- Title (text input, required)
- Priority (dropdown: High / Medium / Low, default Medium)
- Due Date (datetime-local picker, Singapore timezone)
- Repeat (checkbox + pattern dropdown)
- Reminder (dropdown, disabled without due date)

---

## Edge Cases

- **Empty title**: Reject with validation error "Title is required"
- **Past due date**: Reject with "Due date must be in the future"
- **Recurring without due date**: Require due date when enabling recurring
- **Reminder without due date**: Disable reminder selection when no due date set
- **Concurrent edits**: Last-write-wins with `updated_at` timestamp
- **Delete with subtasks/tags**: Cascade delete all related records
- **Very long titles**: Truncate display with ellipsis, store full value

---

## Acceptance Criteria

- [ ] Can create a todo with only a title
- [ ] Can create a todo with priority, due date, recurring, and reminder
- [ ] Todos sorted by priority (high first) then due date (earliest first)
- [ ] Completed todos move to the Completed section immediately
- [ ] Overdue todos (past due date, not completed) appear in Overdue section
- [ ] Edit updates the todo in place
- [ ] Delete requires confirmation and removes the todo
- [ ] Deleting cascades to subtasks and tag associations
- [ ] Singapore timezone used for all date operations
- [ ] Optimistic UI updates (no loading spinner for toggle/delete)

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/01-todo-crud.spec.ts
test('Create todo with title only')
test('Create todo with all metadata (priority, due date, recurring, reminder)')
test('Edit todo - update title and priority')
test('Toggle todo completion - moves to Completed section')
test('Toggle completed todo - moves back to Active section')
test('Delete todo - shows confirmation dialog')
test('Delete todo - removes from list after confirmation')
test('Past due date rejected with validation error')
test('Empty title rejected with validation error')
test('Overdue todo appears in Overdue section')
```

### Unit Tests

```typescript
// tests/unit/todo-validation.test.ts
test('Title trimming removes whitespace')
test('Due date validation rejects past dates (Singapore timezone)')
test('Due date validation accepts future dates')
test('Recurring requires due date')
```

---

## Out of Scope

- Bulk operations (multi-select delete/complete)
- Drag-and-drop reordering
- Archiving (todos are either active or deleted)
- Sharing todos with other users
- Attachments or file uploads

---

## Success Metrics

- Todo creation completes in < 500ms
- All 5 CRUD operations function correctly
- Zero data loss on delete (cascade handled by DB)
- Singapore timezone consistent across create/display/edit
