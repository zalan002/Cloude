'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const CATEGORIES = [
  'EGYÉB FELADATOK',
  'ÉRTÉKESÍTÉS',
  'JOG',
  'ASSZISZTENCIA/FELSZÁMOLÁS',
  'KÖNYVELÉS',
  'MUNKAÜGY',
];

export default function TaskSelector({ tasks, value, onChange, required, onTaskAdded }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedTask = tasks.find((t) => String(t.id) === String(value));

  const filtered = search.trim()
    ? tasks.filter((t) => {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q))
        );
      })
    : tasks;

  // Group by category
  const grouped = [];
  const categoryOrder = [];
  const categoryMap = {};

  filtered.forEach((t) => {
    const cat = t.category || 'Egyéb';
    if (!categoryMap[cat]) {
      categoryMap[cat] = [];
      categoryOrder.push(cat);
    }
    categoryMap[cat].push(t);
  });

  // Build flat list with category headers for keyboard navigation
  const flatItems = [];
  categoryOrder.forEach((cat) => {
    flatItems.push({ type: 'header', label: cat });
    categoryMap[cat].forEach((t) => {
      flatItems.push({ type: 'task', task: t });
    });
  });

  const selectableItems = flatItems.filter((item) => item.type === 'task');

  const MAX_VISIBLE = 50;
  const displayedItems = selectableItems.slice(0, MAX_VISIBLE);
  const hasMore = selectableItems.length > MAX_VISIBLE;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectTask = useCallback(
    (task) => {
      onChange(String(task.id));
      setSearch('');
      setIsOpen(false);
    },
    [onChange]
  );

  const clearSelection = () => {
    onChange('');
    setSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < displayedItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayedItems[highlightedIndex]) {
          selectTask(displayedItems[highlightedIndex].task);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Build display list grouped by category (limited to MAX_VISIBLE tasks)
  const buildDisplayList = () => {
    const result = [];
    let taskCount = 0;

    for (const cat of categoryOrder) {
      const catTasks = categoryMap[cat];
      const tasksToShow = [];

      for (const t of catTasks) {
        if (taskCount >= MAX_VISIBLE) break;
        tasksToShow.push(t);
        taskCount++;
      }

      if (tasksToShow.length > 0) {
        result.push({ type: 'header', label: cat });
        tasksToShow.forEach((t) => result.push({ type: 'task', task: t }));
      }

      if (taskCount >= MAX_VISIBLE) break;
    }

    return result;
  };

  const displayList = buildDisplayList();

  // Map task index for highlighting
  let taskIndex = -1;

  return (
    <div ref={containerRef} className="relative">
      {required && (
        <input
          type="text"
          value={value || ''}
          required
          tabIndex={-1}
          className="absolute opacity-0 h-0 w-0 pointer-events-none"
          onChange={() => {}}
        />
      )}

      {selectedTask && !isOpen ? (
        <div className="input-field flex items-center justify-between cursor-pointer">
          <div
            className="flex-1 min-w-0"
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <span className="font-semibold text-dark-text">
              {selectedTask.name}
            </span>
            {selectedTask.category && (
              <span className="text-mid-gray text-xs ml-2">
                ({selectedTask.category})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
            title="Kiválasztás törlése"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-mid-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Keresés feladat vagy kategória alapján..."
            className="input-field !pl-9"
            autoComplete="off"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {displayList.length === 0 ? (
            <div className="px-4 py-6 text-center text-mid-gray text-sm">
              {search
                ? `Nincs találat: "${search}"`
                : 'Nincsenek elérhető feladatok.'}
            </div>
          ) : (
            <ul ref={listRef} role="listbox">
              {displayList.map((item, i) => {
                if (item.type === 'header') {
                  return (
                    <li
                      key={`header-${item.label}`}
                      className="px-4 py-2 text-xs font-montserrat font-bold text-medium-blue uppercase tracking-wider bg-pale-blue/50 sticky top-0"
                    >
                      {item.label}
                    </li>
                  );
                }

                taskIndex++;
                const currentIndex = taskIndex;

                return (
                  <li
                    key={item.task.id}
                    role="option"
                    data-index={currentIndex}
                    aria-selected={String(item.task.id) === String(value)}
                    onClick={() => selectTask(item.task)}
                    onMouseEnter={() => setHighlightedIndex(currentIndex)}
                    className={`px-4 py-2.5 cursor-pointer text-sm transition-colors pl-6 ${
                      currentIndex === highlightedIndex
                        ? 'bg-medium-blue/10 text-deep-blue'
                        : 'text-dark-text hover:bg-gray-50'
                    } ${
                      String(item.task.id) === String(value)
                        ? 'font-semibold bg-medium-blue/5'
                        : ''
                    }`}
                  >
                    <span className="font-montserrat">{item.task.name}</span>
                  </li>
                );
              })}
              {hasMore && (
                <li className="px-4 py-2 text-center text-xs text-mid-gray bg-gray-50 border-t border-gray-100">
                  {selectableItems.length - MAX_VISIBLE} további feladat... Szűkítsd a keresést!
                </li>
              )}
            </ul>
          )}
          {onTaskAdded && (
            <div className="border-t border-gray-200">
              {showAddForm ? (
                <div className="p-3 space-y-2 bg-gray-50" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                    Kérjük, először győződjön meg róla, hogy a keresett feladat nem szerepel-e már a listában! Csak akkor vegyen fel újat, ha biztosan nincs megfelelő.
                  </p>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Új feladat neve..."
                    className="input-field !py-1.5 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="input-field !py-1.5 text-sm"
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <option value="">Kategória (opcionális)</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!newName.trim() || adding}
                      onClick={async () => {
                        setAdding(true);
                        const task = await onTaskAdded(newName.trim(), newCategory || null);
                        setAdding(false);
                        if (task) {
                          setNewName('');
                          setNewCategory('');
                          setShowAddForm(false);
                          setSearch('');
                          setIsOpen(false);
                          onChange(String(task.id));
                        }
                      }}
                      className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                    >
                      {adding ? 'Mentés...' : 'Hozzáadás'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setNewName(''); setNewCategory(''); }}
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      Mégse
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full px-4 py-2.5 text-sm text-medium-blue hover:bg-medium-blue/5 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Új feladat hozzáadása
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
