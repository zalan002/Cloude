'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export default function ProjectSelector({ projects, value, onChange, required, onProjectAdded }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedProject = projects.find((p) => String(p.id) === String(value));

  const filtered = search.trim()
    ? projects.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category_name && p.category_name.toLowerCase().includes(q)) ||
          String(p.minicrm_id).includes(q)
        );
      })
    : projects;

  // Limit displayed items for performance
  const MAX_VISIBLE = 50;
  const displayedProjects = filtered.slice(0, MAX_VISIBLE);
  const hasMore = filtered.length > MAX_VISIBLE;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.children[highlightedIndex];
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectProject = useCallback(
    (project) => {
      onChange(String(project.id));
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
          prev < displayedProjects.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (displayedProjects[highlightedIndex]) {
          selectProject(displayedProjects[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form validation */}
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

      {selectedProject && !isOpen ? (
        /* Selected state */
        <div className="input-field flex items-center justify-between cursor-pointer">
          <div
            className="flex-1 min-w-0"
            onClick={() => {
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <span className="font-semibold text-dark-text">
              {selectedProject.name}
            </span>
            {selectedProject.category_name && (
              <span className="text-mid-gray text-xs ml-2">
                ({selectedProject.category_name})
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
        /* Search input */
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
            placeholder="Keresés projekt név alapján..."
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

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {displayedProjects.length === 0 ? (
            <div className="px-4 py-6 text-center text-mid-gray text-sm">
              {search
                ? `Nincs találat: "${search}"`
                : 'Nincsenek elérhető projektek.'}
            </div>
          ) : (
            <ul ref={listRef} role="listbox">
              {displayedProjects.map((project, index) => (
                <li
                  key={project.id}
                  role="option"
                  aria-selected={String(project.id) === String(value)}
                  onClick={() => selectProject(project)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                    index === highlightedIndex
                      ? 'bg-medium-blue/10 text-deep-blue'
                      : 'text-dark-text hover:bg-gray-50'
                  } ${
                    String(project.id) === String(value)
                      ? 'font-semibold bg-medium-blue/5'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-montserrat truncate">{project.name}</span>
                    {project.category_name && (
                      <span className="text-xs text-mid-gray ml-2 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
                        {project.category_name}
                      </span>
                    )}
                  </div>
                </li>
              ))}
              {hasMore && (
                <li className="px-4 py-2 text-center text-xs text-mid-gray bg-gray-50 border-t border-gray-100">
                  {filtered.length - MAX_VISIBLE} további projekt... Szűkítsd a keresést!
                </li>
              )}
            </ul>
          )}
          {onProjectAdded && (
            <div className="border-t border-gray-200">
              {showAddForm ? (
                <div className="p-3 space-y-2 bg-gray-50" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Új projekt neve..."
                    className="input-field !py-1.5 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!newName.trim() || adding}
                      onClick={async () => {
                        setAdding(true);
                        const project = await onProjectAdded(newName.trim());
                        setAdding(false);
                        if (project) {
                          setNewName('');
                          setShowAddForm(false);
                          setSearch('');
                          setIsOpen(false);
                          onChange(String(project.id));
                        }
                      }}
                      className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                    >
                      {adding ? 'Mentés...' : 'Hozzáadás'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setNewName(''); }}
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
                  Új projekt hozzáadása
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
