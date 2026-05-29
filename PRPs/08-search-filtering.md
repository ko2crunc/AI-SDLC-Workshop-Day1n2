# PRP 08: Search & Filtering

## Feature Overview

Provide real-time search and multi-criteria filtering so users can quickly find specific todos. Search is case-insensitive and matches todo titles and tag names. Priority and tag filters can be combined with AND logic. All filtering is client-side for instant response.

---

## User Stories

- **As a user**, I want to type in a search box and see matching todos in real time.
- **As a user**, I want search to match both todo titles and tag names.
- **As a user**, I want to filter todos by priority level.
- **As a user**, I want to click a tag badge to filter by that tag (covered in Feature 06 but integrated here).
- **As a user**, I want to combine multiple filters (e.g., "high priority + work tag").
- **As a user**, I want to see a clear summary of active filters and a button to clear all.
- **As a user**, I want to see a helpful message when no todos match the filters.

---

## User Flow

### Search by Title
1. User types in the search input at the top of the page
2. After 300ms debounce, the todo list filters in real time
3. Only todos whose title matches the search term (case-insensitive) remain visible
4. Each section (Overdue, Active, Completed) is filtered independently

### Search by Tag Name (Advanced)
1. User types a tag name in the search box
2. Todos that have a tag matching the search term are also shown
3. Results combine title matches and tag name matches (OR within search, AND with other filters)

### Filter by Priority
1. User selects a priority from the filter dropdown (High / Medium / Low / All)
2. Only todos with the selected priority are shown
3. A filter badge appears showing the active priority filter

### Combined Filtering
1. User has an active search term "meeting" and priority filter "High"
2. Only todos that match BOTH criteria are shown (AND logic)
3. Filter summary bar shows: `Search: "meeting"  Priority: High  [Clear All]`

### Clear Filters
1. User clicks "Clear All" in the filter summary bar
2. All filters are removed; full todo list is restored
3. Filter summary bar disappears

---

## Technical Requirements

### Filtering Logic (Client-Side)

```typescript
function filterTodos(
  todos: Todo[],
  searchTerm: string,
  priorityFilter: Priority | '',
  tagFilter: number | null,
): Todo[] {
  const lower = searchTerm.toLowerCase().trim();

  return todos.filter(todo => {
    // Search: match title OR any tag name
    const matchesSearch =
      !lower ||
      todo.title.toLowerCase().includes(lower) ||
      todo.tags?.some(tag => tag.name.toLowerCase().includes(lower));

    // Priority filter
    const matchesPriority = !priorityFilter || todo.priority === priorityFilter;

    // Tag filter (by tag ID, set when clicking a badge)
    const matchesTag = !tagFilter || todo.tags?.some(tag => tag.id === tagFilter);

    return matchesSearch && matchesPriority && matchesTag;
  });
}
```

### Search Debounce

```typescript
import { useDeferredValue, useState } from 'react';

function useSearch() {
  const [rawSearch, setRawSearch] = useState('');
  const debouncedSearch = useDeferredValue(rawSearch); // React 18 built-in
  return { rawSearch, setRawSearch, debouncedSearch };
}
```

Alternatively, use a `useEffect` with `setTimeout` for explicit 300ms debounce:

```typescript
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(rawSearch), 300);
  return () => clearTimeout(timer);
}, [rawSearch]);
```

### State Shape

```typescript
interface FilterState {
  searchTerm: string;
  priorityFilter: Priority | '';
  tagFilter: number | null;   // tag ID
}

const initialFilterState: FilterState = {
  searchTerm: '',
  priorityFilter: '',
  tagFilter: null,
};
```

---

## UI Components

### Search Input

```tsx
<div className="relative">
  <input
    type="search"
    placeholder="Search todos by title or tag..."
    value={searchTerm}
    onChange={e => setSearchTerm(e.target.value)}
    className="input pl-9 w-full"
  />
  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
</div>
```

### Priority Filter Dropdown

```tsx
<select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as Priority | '')}>
  <option value="">All Priorities</option>
  <option value="high">🔴 High</option>
  <option value="medium">🟡 Medium</option>
  <option value="low">🔵 Low</option>
</select>
```

### Active Filter Summary Bar

```tsx
{hasActiveFilters && (
  <div className="flex flex-wrap items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
    {searchTerm && (
      <span className="filter-chip">
        Search: &quot;{searchTerm}&quot;
        <button onClick={() => setSearchTerm('')}>×</button>
      </span>
    )}
    {priorityFilter && (
      <span className="filter-chip">
        Priority: {priorityFilter}
        <button onClick={() => setPriorityFilter('')}>×</button>
      </span>
    )}
    {tagFilter && (
      <span className="filter-chip">
        Tag: {tags.find(t => t.id === tagFilter)?.name}
        <button onClick={() => setTagFilter(null)}>×</button>
      </span>
    )}
    <button onClick={clearAllFilters} className="ml-auto text-red-500 hover:text-red-700">
      Clear All
    </button>
  </div>
)}
```

### Empty State

```tsx
{filteredTodos.length === 0 && hasActiveFilters && (
  <div className="text-center py-12 text-gray-500">
    <p className="text-lg">No todos match your filters</p>
    <p className="text-sm mt-1">Try adjusting your search or clearing filters</p>
    <button onClick={clearAllFilters} className="btn-secondary mt-4">Clear Filters</button>
  </div>
)}
```

---

## Edge Cases

- **Search with no results**: Show empty state with "Clear Filters" button
- **Search with special regex characters**: Use `String.includes()`, not regex, to avoid injection
- **Very long search term**: Truncate filter badge display but search full term
- **Whitespace-only search**: Treat as empty (trim before filtering)
- **Filter with 1000+ todos**: Client-side filtering should complete in < 100ms (JavaScript array filter is O(n))
- **Section visibility**: If a section (Overdue, Active, Completed) has no results after filtering, hide the section header too
- **Search clears between page navigations**: Intentional — filters are not persisted in URL for simplicity (calendar month IS persisted separately in feature 10)

---

## Acceptance Criteria

- [ ] Search is case-insensitive
- [ ] Search matches todo titles
- [ ] Search matches tag names assigned to todos
- [ ] Priority filter shows only matching priority todos
- [ ] Tag filter (from clicking badge) shows only todos with that tag
- [ ] Multiple active filters combine with AND logic
- [ ] Filter summary bar shows all active filters with individual clear buttons
- [ ] "Clear All" button removes all active filters
- [ ] Empty state shown when no todos match
- [ ] Search debounced at ~300ms to avoid excessive re-renders
- [ ] Filter updates < 100ms for up to 1000 todos

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/08-search-filtering.spec.ts
test('Search by title - matching todos shown')
test('Search is case-insensitive')
test('Search by tag name - todos with matching tag shown')
test('No results shows empty state message')
test('Filter by priority - only matching priority todos shown')
test('Filter by tag (click badge) - only matching tag todos shown')
test('Search + priority filter combined - AND logic applied')
test('Clear individual filter chip removes that filter only')
test('Clear All removes all active filters')
test('Empty sections hidden when filtered')
```

### Performance Tests

```typescript
// tests/08-search-performance.spec.ts
test('Filter 1000 todos by search term completes in < 100ms')
test('Filter by priority on 1000 todos completes in < 100ms')
```

### Unit Tests

```typescript
// tests/unit/filter.test.ts
test('filterTodos: empty search returns all todos')
test('filterTodos: case-insensitive title match')
test('filterTodos: tag name match')
test('filterTodos: priority filter')
test('filterTodos: AND logic for combined filters')
test('filterTodos: whitespace-only search treated as empty')
```

---

## Out of Scope

- Server-side search (all filtering is client-side)
- Full-text search across todo descriptions or subtask titles
- Search history or saved searches
- Regular expression search
- URL-persisted filter state

---

## Success Metrics

- Search responds within 300ms (debounce) + < 100ms filter time
- Filter 1000 todos in < 100ms on a mid-range device
- Filter summary bar always accurately reflects active filters
- Zero false negatives for case-insensitive title matches
