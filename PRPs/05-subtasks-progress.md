# PRP 05: Subtasks & Progress Tracking

## Feature Overview

Allow users to break a todo into smaller checklist items (subtasks). An expandable section on each todo card shows the subtask list with add/toggle/delete controls. A visual progress bar displays completion percentage, turning green at 100%.

---

## User Stories

- **As a user**, I want to break a large todo into subtasks so I can track incremental progress.
- **As a user**, I want to check off individual subtasks as I complete them.
- **As a user**, I want a progress bar that shows how many subtasks are done.
- **As a user**, I want to delete individual subtasks I no longer need.
- **As a user**, I want subtasks to be automatically deleted when their parent todo is deleted.

---

## User Flow

### Add Subtasks
1. User expands the subtasks section on a todo card (click ▶ Subtasks)
2. An input field appears at the bottom of the subtask list
3. User types a subtask title and presses Enter or clicks "Add"
4. Subtask appears in the list with an unchecked checkbox
5. Progress bar updates (e.g., 0/1 completed — 0%)

### Complete a Subtask
1. User clicks the checkbox next to a subtask
2. Subtask is marked with a strikethrough and the checkbox fills
3. Progress bar updates (e.g., 1/2 completed — 50%)
4. At 100%, progress bar turns green

### Delete a Subtask
1. User hovers over a subtask (or taps on mobile)
2. A delete (×) button appears
3. User clicks it; subtask is removed
4. Progress bar recalculates

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_subtasks_todo_id ON subtasks(todo_id);
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/todos/[id]/subtasks` | Create a subtask |
| `PUT` | `/api/subtasks/[id]` | Update subtask (title or completed) |
| `DELETE` | `/api/subtasks/[id]` | Delete a subtask |

Subtasks are returned as a nested array on `GET /api/todos` and `GET /api/todos/[id]`.

### TypeScript Types

```typescript
interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

interface CreateSubtaskInput {
  title: string;
}

interface UpdateSubtaskInput {
  title?: string;
  completed?: boolean;
}
```

### Progress Calculation

```typescript
function calculateProgress(subtasks: Subtask[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  if (subtasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
  const completed = subtasks.filter(s => s.completed).length;
  return {
    completed,
    total: subtasks.length,
    percentage: Math.round((completed / subtasks.length) * 100),
  };
}
```

---

## UI Components

### Expandable Subtasks Section

```tsx
<details className="mt-2">
  <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
    ▶ Subtasks ({progress.completed}/{progress.total})
  </summary>

  {/* Progress Bar */}
  {subtasks.length > 0 && (
    <div className="mt-2">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            progress.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {progress.completed}/{progress.total} completed ({progress.percentage}%)
      </p>
    </div>
  )}

  {/* Subtask List */}
  <ul className="mt-2 space-y-1">
    {subtasks.map(subtask => (
      <li key={subtask.id} className="flex items-center gap-2 group">
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={() => toggleSubtask(subtask.id)}
        />
        <span className={subtask.completed ? 'line-through text-gray-400' : ''}>
          {subtask.title}
        </span>
        <button
          onClick={() => deleteSubtask(subtask.id)}
          className="ml-auto opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
        >
          ×
        </button>
      </li>
    ))}
  </ul>

  {/* Add Subtask */}
  <form onSubmit={addSubtask} className="mt-2 flex gap-2">
    <input
      type="text"
      placeholder="Add subtask..."
      value={newSubtask}
      onChange={e => setNewSubtask(e.target.value)}
      className="input flex-1"
    />
    <button type="submit" className="btn-primary text-sm">Add</button>
  </form>
</details>
```

---

## Edge Cases

- **No subtasks**: Progress bar hidden; section shows "No subtasks yet"
- **Empty subtask title**: Validation error — "Subtask title is required"
- **Parent todo deleted**: `ON DELETE CASCADE` removes all subtasks automatically
- **All subtasks completed**: Progress bar turns green; parent todo is NOT auto-completed (user must manually toggle)
- **Subtask with 100+ items**: No enforced limit; list should scroll within the expandable section
- **Subtask title too long**: Truncate display with ellipsis; store full value (max 500 chars)
- **Re-ordering**: Not supported in this version (position field reserved for future use)

---

## Acceptance Criteria

- [ ] Can add multiple subtasks to a todo
- [ ] Can toggle subtask completion (checkbox)
- [ ] Progress bar updates in real-time after each toggle
- [ ] Progress bar is blue at < 100%, green at 100%
- [ ] Progress label shows "X/Y completed (Z%)"
- [ ] Can delete individual subtasks
- [ ] Deleting the parent todo removes all its subtasks
- [ ] Empty subtask title rejected with validation error
- [ ] Subtasks section collapses and expands correctly

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/05-subtasks-progress.spec.ts
test('Expand subtasks section on a todo card')
test('Add subtask - appears in list')
test('Add multiple subtasks - all appear in list')
test('Toggle subtask completion - progress bar updates')
test('Progress bar turns green at 100%')
test('Progress label shows correct counts (X/Y completed Z%)')
test('Delete subtask - removed from list, progress recalculates')
test('Delete parent todo - subtasks also removed (cascade)')
test('Empty subtask title shows validation error')
```

### Unit Tests

```typescript
// tests/unit/progress.test.ts
test('calculateProgress returns 0% for empty subtasks')
test('calculateProgress returns 50% for 1/2 completed')
test('calculateProgress returns 100% for all completed')
test('calculateProgress rounds to nearest integer')
```

---

## Out of Scope

- Nested subtasks (subtasks of subtasks)
- Drag-and-drop reordering of subtasks
- Due dates on individual subtasks
- Assignees for subtasks
- Auto-completing parent todo when all subtasks done

---

## Success Metrics

- Progress bar renders correctly for 0%, 50%, and 100% states
- Adding/toggling/deleting subtasks reflects in < 300ms
- Cascade delete verified — zero orphan subtask rows after parent delete
- Unit test for `calculateProgress` passes for all boundary cases
