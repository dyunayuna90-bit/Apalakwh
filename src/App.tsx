import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- TYPE DEFINITIONS ---
// Kita define dulu biar TypeScript ga rewel sama Custom Elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'm3e-theme': any;
      'm3e-top-app-bar': any;
      'm3e-icon-button': any;
      'm3e-icon': any;
      'm3e-fab': any;
      'm3e-card': any;
      'm3e-outlined-field': any;
      'm3e-text-button': any;
      'm3e-filled-button': any;
      'm3e-tonal-button': any;
      'm3e-dialog': any;
      'm3e-chip': any;
      'm3e-navigation-drawer': any; // Asumsi nama komponen drawer
      'm3e-list-item': any;
      'm3e-divider': any;
      'm3e-switch': any;
    }
  }
}

interface Note {
  id: string;
  title: string;
  content: string;
  labels: string[];
  color: string; // Hex color for custom styling if needed
  createdAt: number;
}

interface Label {
  id: string;
  name: string;
}

// --- UTILS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// --- MAIN COMPONENT ---
export default function App() {
  // STATE: Data
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([
    { id: '1', name: 'Kuliah' }, 
    { id: '2', name: 'Personal' },
    { id: '3', name: 'Ide Lukisan' }
  ]);
  
  // STATE: UI Logic
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // STATE: Editor Inputs
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorLabels, setEditorLabels] = useState<string[]>([]);

  // REFS (For Gestures)
  const clickTimeoutRef = useRef<any>(null);
  const longPressTimeoutRef = useRef<any>(null);
  const touchStartPos = useRef<{x: number, y: number} | null>(null);
  const isSwiping = useRef(false);

  // --- LIFECYCLE: Load & Save ---
  useEffect(() => {
    const savedNotes = localStorage.getItem('dinduy_notes');
    const savedLabels = localStorage.getItem('dinduy_labels');
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedLabels) setLabels(JSON.parse(savedLabels));
  }, []);

  useEffect(() => {
    localStorage.setItem('dinduy_notes', JSON.stringify(notes));
    localStorage.setItem('dinduy_labels', JSON.stringify(labels));
  }, [notes, labels]);

  // --- LOGIC: Selection ---
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    
    setSelectedIds(newSet);
    if (newSet.size === 0) setSelectionMode(false);
  };

  const selectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(notes.map(n => n.id)));
      setSelectionMode(true);
    }
  };

  // --- LOGIC: CRUD ---
  const handleSaveNote = () => {
    if (!editorTitle.trim() && !editorContent.trim()) {
      setEditorOpen(false);
      return;
    }

    if (editingNote) {
      // Update
      setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, title: editorTitle, content: editorContent, labels: editorLabels } : n));
    } else {
      // Create New
      const newNote: Note = {
        id: generateId(),
        title: editorTitle,
        content: editorContent,
        labels: editorLabels,
        color: 'surface',
        createdAt: Date.now()
      };
      setNotes(prev => [newNote, ...prev]);
    }
    setEditorOpen(false);
    resetEditor();
  };

  const deleteSelected = () => {
    setNotes(prev => prev.filter(n => !selectedIds.has(n.id)));
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const deleteSingle = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const resetEditor = () => {
    setEditingNote(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorLabels([]);
  };

  const openEditor = (note?: Note) => {
    if (note) {
      setEditingNote(note);
      setEditorTitle(note.title);
      setEditorContent(note.content);
      setEditorLabels(note.labels);
    } else {
      resetEditor();
    }
    setEditorOpen(true);
  };

  // --- LOGIC: Import / Export ---
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ notes, labels }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "dinduy_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.notes) setNotes(json.notes);
        if (json.labels) setLabels(json.labels);
        alert("Backup berhasil dipulihkan!");
      } catch (err) {
        alert("File backup rusak/salah format.");
      }
    };
    reader.readAsText(file);
  };

  // --- RENDERERS ---
  
  // Custom Card Component with Gesture Logic
  const NoteCardItem = ({ note }: { note: Note }) => {
    const isSelected = selectedIds.has(note.id);
    const isExpanded = expandedId === note.id;
    const cardRef = useRef<HTMLDivElement>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);

    // Gesture Handlers
    const onTouchStart = (e: React.TouchEvent) => {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isSwiping.current = false;

      // Start Long Press Timer
      longPressTimeoutRef.current = setTimeout(() => {
        if (!isSwiping.current) {
          // Trigger Long Press
          navigator.vibrate?.(50); // Haptic feedback
          if (!selectionMode) {
            setSelectionMode(true);
            toggleSelection(note.id);
          }
        }
      }, 500); // 500ms for long press
    };

    const onTouchMove = (e: React.TouchEvent) => {
      if (!touchStartPos.current) return;
      const dx = e.touches[0].clientX - touchStartPos.current.x;
      const dy = e.touches[0].clientY - touchStartPos.current.y;

      // If moving horizontally significantly more than vertically -> SWIPE
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isSwiping.current = true;
        clearTimeout(longPressTimeoutRef.current); // Cancel long press
        setSwipeOffset(dx);
      } else if (Math.abs(dy) > 10) {
        // Scrolling vertical, cancel gestures
        clearTimeout(longPressTimeoutRef.current);
        isSwiping.current = true; // Mark as movement so we don't trigger tap
      }
    };

    const onTouchEnd = () => {
      clearTimeout(longPressTimeoutRef.current);
      
      // Handle Swipe Action
      if (Math.abs(swipeOffset) > 150) { // Threshold delete
         // Swipe right or left to delete
         deleteSingle(note.id);
      } else {
        setSwipeOffset(0); // Reset position
      }

      // Handle Taps if NOT swiping and NOT selection mode
      if (!isSwiping.current && Math.abs(swipeOffset) < 5) {
        if (selectionMode) {
          toggleSelection(note.id);
        } else {
          // Double Tap Logic
          if (clickTimeoutRef.current) {
            // DOUBLE TAP DETECTED
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
            setExpandedId(prev => prev === note.id ? null : note.id); // Toggle Expand
          } else {
            // Wait for potential second tap
            clickTimeoutRef.current = setTimeout(() => {
              // SINGLE TAP ACTION
              clickTimeoutRef.current = null;
              openEditor(note);
            }, 250);
          }
        }
      }
      
      touchStartPos.current = null;
      isSwiping.current = false;
    };

    return (
      <div 
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.3s ease',
          opacity: Math.abs(swipeOffset) > 150 ? 0 : 1,
          gridColumn: isExpanded ? '1 / -1' : 'auto', // CSS Grid magic for Expand
          zIndex: isExpanded ? 10 : 1,
        }}
        className={`note-wrapper ${isExpanded ? 'expanded' : ''}`}
      >
        <m3e-card 
          variant={isSelected ? "filled" : "elevated"} 
          style={{ 
            height: '100%', 
            position: 'relative',
            border: isSelected ? '2px solid var(--md-sys-color-primary)' : 'none',
            overflow: 'hidden'
          }}
        >
          {/* Content */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', opacity: 0.9 }}>{note.title || '(Tanpa Judul)'}</span>
              {isSelected && <m3e-icon name="check_circle" style={{color: 'var(--md-sys-color-primary)'}}></m3e-icon>}
            </div>
            
            <p style={{ 
              margin: 0, 
              opacity: 0.7, 
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? 'none' : 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap'
            }}>
              {note.content}
            </p>

            {/* Labels */}
            {note.labels.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                {note.labels.map(l => (
                  <m3e-chip key={l} label={l} style={{ height: '24px', fontSize: '12px' }}></m3e-chip>
                ))}
              </div>
            )}
          </div>
        </m3e-card>
      </div>
    );
  };

  // --- MAIN LAYOUT ---
  return (
    <m3e-theme source-color="#006A6A" fallback-style="dark">
      {/* GLOBAL STYLES for Grid & Layout */}
      <style>{`
        body { margin: 0; background: var(--md-sys-color-background); font-family: 'Roboto', sans-serif; overflow-x: hidden; }
        .app-layout { 
          display: flex; 
          flex-direction: column; 
          height: 100vh; 
          width: 100%;
        }
        .masonry-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
          padding: 16px;
          padding-bottom: 80px; /* Space for FAB */
          align-items: start;
        }
        /* Mobile adjustment */
        @media (max-width: 600px) {
          .masonry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        /* Drawer Overlay */
        .drawer-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); z-index: 99;
          opacity: 0; pointer-events: none; transition: opacity 0.3s;
        }
        .drawer-overlay.open { opacity: 1; pointer-events: auto; }
        
        .drawer-content {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 280px; background: var(--md-sys-color-surface-container-high);
          z-index: 100; transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
          padding: 24px 12px; display: flex; flex-direction: column;
        }
        .drawer-content.open { transform: translateX(0); }
      `}</style>

      <div className="app-layout">
        {/* HEADER / TOOLBAR */}
        <m3e-top-app-bar 
          headline={selectionMode ? `${selectedIds.size} Dipilih` : "Dinduy"}
          type="small"
        >
          {selectionMode ? (
            <>
              <m3e-icon-button slot="leading-icon" onClick={() => setSelectionMode(false)}>
                <m3e-icon name="close"></m3e-icon>
              </m3e-icon-button>
              <m3e-icon-button slot="trailing-icon" onClick={selectAll}>
                <m3e-icon name="select_all"></m3e-icon>
              </m3e-icon-button>
              <m3e-icon-button slot="trailing-icon" onClick={deleteSelected}>
                <m3e-icon name="delete"></m3e-icon>
              </m3e-icon-button>
            </>
          ) : (
            <>
              <m3e-icon-button slot="leading-icon" onClick={() => setShowDrawer(true)}>
                <m3e-icon name="menu"></m3e-icon>
              </m3e-icon-button>
              
              <m3e-icon-button slot="trailing-icon" onClick={() => {
                // Toggle Grid/List view logic could go here
                alert('Tampilan diubah (Fitur Demo)');
              }}>
                <m3e-icon name="grid_view"></m3e-icon>
              </m3e-icon-button>
              
              <div slot="trailing-icon" style={{position: 'relative', width: '32px', height: '32px', overflow: 'hidden', borderRadius: '50%'}}>
                 {/* No Profile Pic as requested, replaced with generic icon or empty */}
                 <m3e-icon name="account_circle"></m3e-icon>
              </div>
            </>
          )}
        </m3e-top-app-bar>

        {/* SIDE DRAWER (Custom Implementation) */}
        <div className={`drawer-overlay ${showDrawer ? 'open' : ''}`} onClick={() => setShowDrawer(false)}></div>
        <div className={`drawer-content ${showDrawer ? 'open' : ''}`}>
          {/* Logo Typography */}
          <div style={{ padding: '0 16px 24px 16px', fontSize: '28px', fontWeight: 'bold', fontFamily: 'sans-serif', color: 'var(--md-sys-color-on-surface)' }}>
            Dinduy
          </div>
          
          <m3e-filled-button style={{width: '100%', marginBottom: '16px'}} onClick={() => { setShowDrawer(false); openEditor(); }}>
            <m3e-icon slot="icon" name="add"></m3e-icon>
            Catatan Baru
          </m3e-filled-button>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '8px 16px', fontWeight: 'bold', opacity: 0.7 }}>Label</div>
            {labels.map(l => (
              <m3e-text-button key={l.id} style={{width: '100%', justifyContent: 'flex-start'}} onClick={() => {}}>
                <m3e-icon slot="icon" name="label"></m3e-icon>
                {l.name}
              </m3e-text-button>
            ))}
            
            <m3e-divider style={{margin: '16px 0'}}></m3e-divider>
            
            <div style={{ padding: '8px 16px', fontWeight: 'bold', opacity: 0.7 }}>Pengaturan</div>
            
            <label style={{ display: 'block', margin: '8px 16px', cursor: 'pointer' }}>
              <span style={{display: 'block', fontSize: '14px', marginBottom: '4px'}}>Backup Data</span>
              <div style={{display:'flex', gap: '8px'}}>
                <m3e-tonal-button onClick={handleExport}>
                   <m3e-icon slot="icon" name="download"></m3e-icon> Export
                </m3e-tonal-button>
                <input type="file" id="importFile" hidden onChange={handleImport} accept=".json" />
                <m3e-tonal-button onClick={() => document.getElementById('importFile')?.click()}>
                   <m3e-icon slot="icon" name="upload"></m3e-icon> Import
                </m3e-tonal-button>
              </div>
            </label>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div className="masonry-grid">
           {notes.length === 0 && (
             <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '100px', opacity: 0.5 }}>
               <m3e-icon name="lightbulb" style={{ fontSize: '48px', marginBottom: '16px' }}></m3e-icon>
               <p>Belum ada catatan. Buat satu untuk Dinda!</p>
             </div>
           )}
           {notes.map(note => (
             <NoteCardItem key={note.id} note={note} />
           ))}
        </div>

        {/* FAB (Floating Action Button) */}
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 5 }}>
          <m3e-fab variant="primary" onClick={() => openEditor()}>
            <m3e-icon slot="icon" name="add"></m3e-icon>
          </m3e-fab>
        </div>

        {/* EDITOR DIALOG (Full Screen-ish) */}
        {editorOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--md-sys-color-background)',
            zIndex: 200, display: 'flex', flexDirection: 'column',
            animation: 'slideUp 0.3s cubic-bezier(0.2, 0, 0, 1)'
          }}>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            
            {/* Editor Toolbar */}
            <div style={{ padding: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <m3e-icon-button onClick={() => setEditorOpen(false)}>
                <m3e-icon name="arrow_back"></m3e-icon>
              </m3e-icon-button>
              <div style={{display:'flex', gap:'8px'}}>
                 <m3e-icon-button><m3e-icon name="push_pin"></m3e-icon></m3e-icon-button>
                 <m3e-icon-button><m3e-icon name="palette"></m3e-icon></m3e-icon-button>
                 <m3e-button variant="filled" onClick={handleSaveNote}>Simpan</m3e-button>
              </div>
            </div>

            {/* Editor Inputs */}
            <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                type="text" 
                placeholder="Judul" 
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '24px', fontWeight: 'bold', color: 'var(--md-sys-color-on-background)',
                  width: '100%'
                }}
              />
              <textarea 
                placeholder="Catatan..." 
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '16px', lineHeight: '1.6', color: 'var(--md-sys-color-on-background)',
                  resize: 'none', fontFamily: 'Roboto'
                }}
              />
            </div>
            
            {/* Bottom Bar for Editor */}
            <div style={{ padding: '12px', background: 'var(--md-sys-color-surface-container)', display: 'flex', gap: '8px' }}>
              <m3e-icon-button><m3e-icon name="add_box"></m3e-icon></m3e-icon-button>
              <m3e-icon-button><m3e-icon name="image"></m3e-icon></m3e-icon-button>
              <span style={{flex: 1, textAlign: 'center', fontSize: '12px', opacity: 0.6, alignSelf: 'center'}}>
                 Diedit {formatDate(Date.now())}
              </span>
              <m3e-icon-button><m3e-icon name="more_vert"></m3e-icon></m3e-icon-button>
            </div>
          </div>
        )}

      </div>
    </m3e-theme>
  );
}

