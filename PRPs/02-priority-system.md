# PRP 02: Priority System

## Feature Overview

Implement a three-level priority system (High, Medium, Low) for todos. Todos display color-coded priority badges and are automatically sorted by priority within each section. Users can filter the todo list to show only todos of a specific priority level.

---

## User Stories

- **As a user**, I want to assign a priority to each todo so I know which tasks are most important.
- **As a user**, I want todos visually differentiated by priority so I can quickly assess urgency.
- **As a user**, I want todos automatically sorted by priority so high-priority items always appear first.
- **As a user**, I want to filter todos by priority so I can focus on a specific urgency level.

---

## User Flow

### Set Priority on Create
1. User opens the create todo form
2. Priority dropdown shows options: High, Medium (default), Low
3. User selects desired priority
4. Submitted todo appears sorted correctly in its section

### Change Priority via Edit
1. User opens the edit modal for a todo
2. Priority dropdown shows the current value
3. User selects a new priority
4. Todo re-sorts in the list after save

### Filter by Priority
1. User opens the priority filter dropdown (in the toolbar/header)
2. Selects "High", "Medium", or "Low"
3. Only todos matching the selected priority are shown
4. A filter indicator appears (e.g., "Filtered: High priority")
5. User clicks "Clear" or selects "All" to remove the filter

---

## Technical Requirements

### Database Schema

The `priority` column is added to the `todos` table:

```sql
ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'
  CHECK(priority IN ('high', 'medium', 'low'));
```

### API Changes

All existing todo endpoints accept and return `priority`:

- `POST /api/todos` — accepts `priority` in request body (default: `'medium'`)
- `GET /api/todos` — returns `priority` per todo; supports `?priority=high|medium|low` filter
- `PUT /api/todos/[id]` — accepts `priority` in request body

### TypeScript Types

```typescript
type Priority = 'high' | 'medium' | 'low';

// Priority badge colors
const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

// Sort order
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
```

### Sorting Logic

Within each section (Overdue, Active, Completed), todos sort by:
1. Priority (high → medium → low)
2. Due date (earliest first; no due date last)
3. Created date (newest first, as tiebreaker)

---

## UI Components

### Priority Badge

```tsx
// Displayed on each todo card
<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[todo.priority]}`}>
  {todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}
</span>
```

### Priority Dropdown (Form)

```tsx
<select name="priority" defaultValue="medium">
  <option value="high">🔴 High</option>
  <option value="medium">🟡 Medium</option>
  <option value="low">🔵 Low</option>
</select>
```

### Priority Filter (Toolbar)

```tsx
<select onChange={setPriorityFilter}>
  <option value="">All Priorities</option>
  <option value="high">High</option>
  <option value="medium">Medium</option>
  <option value="low">Low</option>
</select>
```

---

## Edge Cases

- **Missing priority on existing todos**: Migration sets default `'medium'` for all existing rows
- **Invalid priority value in API**: Return `400 Bad Request` with message "Invalid priority value"
- **Priority filter + tag filter combined**: AND logic — show todos matching both filters
- **Dark mode badge colors**: Use dark: Tailwind variants for proper contrast
- **WCAG AA contrast**: Ensure badge text/background meets 4.5:1 contrast ratio in both light and dark modes

---

## Acceptance Criteria

- [ ] Three priority levels (High, Medium, Low) are available in all todo forms
- [ ] Default priority is Medium when not specified
- [ ] Priority badge displays with correct color (red/yellow/blue)
- [ ] Todos auto-sort: High → Medium → Low within each section
- [ ] Priority filter dropdown shows only matching todos
- [ ] Filtering by priority shows an indicator with a clear button
- [ ] Dark mode badge colors are readable (WCAG AA compliant)
- [ ] Editing priority re-sorts the todo immediately

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/02-priority-system.spec.ts
test('Create todo with High priority - shows red badge')
test('Create todo with Low priority - shows blue badge')
test('Default priority is Medium when not selected')
test('Edit todo to change priority from Medium to High')
test('High priority todos appear before Medium in Active section')
test('Filter by High priority - shows only high priority todos')
test('Filter by Low priority - shows only low priority todos')
test('Clear priority filter - shows all todos again')
test('Priority filter combined with tag filter uses AND logic')
```

### Visual Tests

```typescript
// tests/02-priority-visual.spec.ts
test('Priority badge colors correct in light mode')
test('Priority badge colors correct in dark mode')
test('WCAG AA contrast for High badge in dark mode')
```

### Unit Tests

```typescript
// tests/unit/priority.test.ts
test('PRIORITY_ORDER sorts high before medium before low')
test('Invalid priority rejected with 400 status')
test('Default priority is medium when omitted')
```

---

## Out of Scope

- More than three priority levels
- Custom priority names or colors
- Priority-based notifications or alerts
- Priority statistics or reporting

---

## Success Metrics

- Priority badge visible and correctly colored on all todo cards
- Sort order correct in all three sections (Overdue, Active, Completed)
- Priority filter responds in < 100ms
- WCAG AA contrast met in both light and dark modes
