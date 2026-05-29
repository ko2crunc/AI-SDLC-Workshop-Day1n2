# PRP 03: Recurring Todos

## Feature Overview

Allow todos to repeat on a schedule (daily, weekly, monthly, or yearly). When a recurring todo is completed, a new instance is automatically created with the next calculated due date, inheriting all metadata (priority, tags, reminder, recurrence pattern).

---

## User Stories

- **As a user**, I want to mark a todo as recurring so it automatically recreates itself after I complete it.
- **As a user**, I want to choose between daily, weekly, monthly, and yearly recurrence patterns.
- **As a user**, I want the next recurring instance to inherit my tags, priority, and reminder settings.
- **As a user**, I want to disable recurring on an existing todo without deleting it.
- **As a user**, I want a visual indicator (🔄) so I can easily see which todos are recurring.

---

## User Flow

### Create Recurring Todo
1. User opens the create todo form
2. User enters a title and sets a due date (required for recurring)
3. User checks the "Repeat" checkbox
4. A recurrence pattern dropdown appears: Daily / Weekly / Monthly / Yearly
5. User selects a pattern and submits
6. Todo appears with a 🔄 badge showing the pattern name

### Complete Recurring Todo
1. User toggles the completion checkbox on a recurring todo
2. The todo moves to the Completed section
3. A new todo is automatically created in the Active section with:
   - Same title, priority, tags, reminder, and recurrence settings
   - Due date calculated from the completed todo's due date + pattern interval

### Disable Recurring
1. User opens the edit modal for a recurring todo
2. User unchecks the "Repeat" checkbox
3. After save, the 🔄 badge disappears; completing the todo will NOT create a next instance

---

## Technical Requirements

### Database Schema

```sql
-- Added to todos table
ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT
  CHECK(recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly'));
```

### API Changes

**`PUT /api/todos/[id]`** — on `completed = true` for a recurring todo:
1. Mark the current todo as completed
2. Calculate next due date based on the completed todo's `due_date` and `recurrence_pattern`
3. Create a new todo with same metadata; copy tag associations

### TypeScript Types

```typescript
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface RecurringTodoFields {
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
}
```

### Due Date Calculation

All calculations use `lib/timezone.ts` and operate in `Asia/Singapore`:

```typescript
import { getSingaporeNow } from '@/lib/timezone';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

function calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
  const base = new Date(currentDueDate);
  switch (pattern) {
    case 'daily':   return addDays(base, 1).toISOString();
    case 'weekly':  return addWeeks(base, 1).toISOString();
    case 'monthly': return addMonths(base, 1).toISOString();
    case 'yearly':  return addYears(base, 1).toISOString();
  }
}
```

### Tag Inheritance on Next Instance

When creating the next recurring instance, copy all `todo_tags` associations:

```typescript
const existingTags = tagDB.getTagsForTodo(completedTodoId);
for (const tag of existingTags) {
  tagDB.addTagToTodo(newTodoId, tag.id);
}
```

---

## UI Components

### Recurring Checkbox & Pattern Dropdown (Form)

```tsx
<label>
  <input type="checkbox" checked={isRecurring} onChange={setIsRecurring} />
  Repeat
</label>
{isRecurring && (
  <select value={recurrencePattern} onChange={setRecurrencePattern} required>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
  </select>
)}
```

### Recurring Badge (Todo Card)

```tsx
{todo.is_recurring && (
  <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
    🔄 {todo.recurrence_pattern}
  </span>
)}
```

---

## Edge Cases

- **Recurring without due date**: Validation error — "A due date is required for recurring todos"
- **No recurrence pattern selected**: Validation error — "Please select a recurrence pattern"
- **Due date in the past for next instance**: Use the current due date as base, not today — the next instance may also be in the past if the original was overdue (accepted behaviour)
- **Monthly recurrence on day 31**: `addMonths` handles month overflow (e.g., Jan 31 → Feb 28/29)
- **Disable recurring mid-series**: Uncheck `is_recurring` on the current instance; does not affect already-created instances
- **Tag deletion**: If a tag is deleted after a recurring todo was set up, future instances won't include the deleted tag (handled by CASCADE on `todo_tags`)

---

## Acceptance Criteria

- [ ] All four recurrence patterns (daily, weekly, monthly, yearly) function correctly
- [ ] Recurring requires a due date — validation error shown otherwise
- [ ] Completing a recurring todo creates a new instance in the Active section
- [ ] New instance has correct next due date (Singapore timezone)
- [ ] New instance inherits: title, priority, tags, reminder, recurrence pattern
- [ ] 🔄 badge visible with pattern name on recurring todos
- [ ] Can disable recurring on an existing todo (no more next instance created)
- [ ] Monthly date overflow handled correctly (e.g., Jan 31 → Feb 28)

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/03-recurring-todos.spec.ts
test('Create daily recurring todo with due date')
test('Create weekly recurring todo with due date')
test('Create monthly recurring todo with due date')
test('Create yearly recurring todo with due date')
test('Recurring without due date shows validation error')
test('Complete daily recurring todo - creates next instance 1 day later')
test('Complete weekly recurring todo - creates next instance 1 week later')
test('Next instance inherits priority, tags, and reminder')
test('Disable recurring on existing todo - completing does not create next instance')
test('Recurring badge (🔄) shows pattern name on todo card')
```

### Unit Tests

```typescript
// tests/unit/recurrence.test.ts
test('calculateNextDueDate daily adds 1 day')
test('calculateNextDueDate weekly adds 7 days')
test('calculateNextDueDate monthly handles month-end overflow')
test('calculateNextDueDate yearly handles leap year')
test('Due date calculation uses Singapore timezone')
```

---

## Out of Scope

- Custom recurrence intervals (e.g., every 2 weeks)
- "End date" for recurrence series
- Recurrence exceptions (skip specific dates)
- Calendar view of recurring series
- Editing all future instances in a series

---

## Success Metrics

- All four recurrence patterns create correct next due dates
- Tag/priority/reminder inheritance works 100% of the time
- Completing a recurring todo creates next instance in < 500ms
- Date calculations accurate in Singapore timezone across DST (N/A — Singapore has no DST)
