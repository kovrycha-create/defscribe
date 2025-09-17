// NotesPanel.tsx
import React, { useState, useRef, useEffect } from 'react';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

interface NotesPanelProps {
  transcriptEntries?: any[];
  addToast?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ transcriptEntries = [], addToast }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  // Editor content is managed via editorRef to avoid resetting caret on re-renders
  const [noteTitle, setNoteTitle] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('defscribe-notes');
    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes);
      setNotes(parsedNotes.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      })));
    }
  }, []);

  // Save notes to localStorage whenever they change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('defscribe-notes', JSON.stringify(notes));
    }
  }, [notes]);

  // Load active note content
  useEffect(() => {
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId);
      if (note) {
        // Set editor content directly to avoid resetting caret on every render
        if (editorRef.current) {
          editorRef.current.innerHTML = note.content;
        }
        setNoteTitle(note.title);
        setNoteTags(note.tags);
      }
    }
  }, [activeNoteId, notes]);

  // Text formatting functions
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const createNewNote = () => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: []
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  if (editorRef.current) editorRef.current.innerHTML = '';
    setNoteTitle('Untitled Note');
    setNoteTags([]);
  };

  const saveCurrentNote = () => {
    if (!activeNoteId || !editorRef.current) return;
    
    const updatedNote = {
      id: activeNoteId,
      title: noteTitle,
      content: editorRef.current.innerHTML,
      createdAt: notes.find(n => n.id === activeNoteId)?.createdAt || new Date(),
      updatedAt: new Date(),
      tags: noteTags
    };

    setNotes(prev => prev.map(note => 
      note.id === activeNoteId ? updatedNote : note
    ));
    
    addToast?.('Note Saved', 'Your note has been saved successfully', 'success');
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    if (activeNoteId === noteId) {
      setActiveNoteId(null);
  if (editorRef.current) editorRef.current.innerHTML = '';
      setNoteTitle('');
      setNoteTags([]);
    }
    addToast?.('Note Deleted', 'The note has been deleted', 'info');
  };

  const exportNotes = () => {
    const dataStr = JSON.stringify(notes, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `notes-${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    addToast?.('Notes Exported', 'Your notes have been exported successfully', 'success');
  };

  const importNotes = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedNotes = JSON.parse(e.target?.result as string);
        setNotes(importedNotes.map((note: any) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt)
        })));
        addToast?.('Notes Imported', 'Your notes have been imported successfully', 'success');
      } catch (error) {
        addToast?.('Import Failed', 'Failed to import notes. Please check the file format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // AI Features
  const summarizeTranscript = async () => {
    if (!transcriptEntries || transcriptEntries.length === 0) {
      addToast?.('No Transcript', 'No transcript available to summarize', 'error');
      return;
    }

    setIsAiProcessing(true);
    
    // Simulate AI processing - in real implementation, this would call your AI service
    setTimeout(() => {
      const transcriptText = transcriptEntries.map(e => e.text).join('\n');
      const summary = `## Transcript Summary\n\n**Key Points:**\n- ${transcriptText.slice(0, 100)}...\n\n**Generated on:** ${new Date().toLocaleString()}`;
      
      if (editorRef.current) {
        editorRef.current.innerHTML += `<br><br>${summary.replace(/\n/g, '<br>')}`;
      }
      setIsAiProcessing(false);
      addToast?.('Summary Added', 'AI summary has been added to your note', 'success');
    }, 2000);
  };

  const generateActionItems = async () => {
    setIsAiProcessing(true);
    
    // Simulate AI processing
    setTimeout(() => {
      const actionItems = `<br><br><strong>Action Items:</strong><br>
        <ul>
          <li>Follow up on discussed topics</li>
          <li>Review meeting notes</li>
          <li>Schedule next session</li>
        </ul>`;
      
      if (editorRef.current) {
        editorRef.current.innerHTML += actionItems;
      }
      setIsAiProcessing(false);
      addToast?.('Action Items Added', 'AI-generated action items have been added', 'success');
    }, 1500);
  };

  const improveWriting = async () => {
    if (!editorRef.current || !editorRef.current.textContent) {
      addToast?.('No Content', 'Please write something first', 'error');
      return;
    }

    setIsAiProcessing(true);
    
    // Simulate AI processing
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString();
      
      if (selectedText) {
        // Improve selected text
        const improvedText = `[Improved: ${selectedText}]`;
        formatText('insertText', improvedText);
      } else {
        // Improve all content
        addToast?.('Content Improved', 'AI has enhanced your writing', 'success');
      }
      setIsAiProcessing(false);
    }, 1500);
  };

  // Filter notes based on search
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-full bg-slate-900">
      {/* Notes List Sidebar */}
      <div className="w-64 border-r border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <button
            onClick={createNewNote}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-plus"></i>
            New Note
          </button>
        </div>
        
        <div className="p-3 border-b border-slate-700">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              className={`p-3 border-b border-slate-800 cursor-pointer transition-colors ${
                activeNoteId === note.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
              }`}
            >
              <div className="font-semibold text-white truncate">{note.title}</div>
              <div className="text-xs text-slate-400 mt-1">
                {note.updatedAt.toLocaleDateString()}
              </div>
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-700 text-xs text-slate-300 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-700 flex gap-2">
          <button
            onClick={exportNotes}
            className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
            title="Export Notes"
          >
            <i className="fas fa-download"></i>
          </button>
          <label className="flex-1">
            <input
              type="file"
              accept=".json"
              onChange={importNotes}
              className="hidden"
            />
            <div className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm cursor-pointer text-center" title="Import Notes">
              <i className="fas fa-upload"></i>
            </div>
          </label>
        </div>
      </div>

      {/* Note Editor */}
      {activeNoteId ? (
        <div className="flex-1 flex flex-col">
          {/* Note Header */}
          <div className="p-4 border-b border-slate-700">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="w-full text-xl font-bold bg-transparent text-white border-none outline-none placeholder-slate-400"
              placeholder="Note Title"
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="Add tags (comma separated)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const newTags = e.currentTarget.value.split(',').map(t => t.trim()).filter(t => t);
                    setNoteTags(prev => [...new Set([...prev, ...newTags])]);
                    e.currentTarget.value = '';
                  }
                }}
                className="flex-1 px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              {noteTags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-slate-700 text-xs text-slate-300 rounded flex items-center gap-1">
                  {tag}
                  <button
                    onClick={() => setNoteTags(prev => prev.filter(t => t !== tag))}
                    className="hover:text-red-400"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="p-2 border-b border-slate-700 flex items-center gap-2">
            <button
              onClick={() => formatText('bold')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Bold"
            >
              <i className="fas fa-bold"></i>
            </button>
            <button
              onClick={() => formatText('italic')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Italic"
            >
              <i className="fas fa-italic"></i>
            </button>
            <button
              onClick={() => formatText('underline')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Underline"
            >
              <i className="fas fa-underline"></i>
            </button>
            <button
              onClick={() => formatText('strikeThrough')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Strikethrough"
            >
              <i className="fas fa-strikethrough"></i>
            </button>
            <div className="h-6 w-px bg-slate-700"></div>
            <button
              onClick={() => formatText('insertUnorderedList')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Bullet List"
            >
              <i className="fas fa-list-ul"></i>
            </button>
            <button
              onClick={() => formatText('insertOrderedList')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Numbered List"
            >
              <i className="fas fa-list-ol"></i>
            </button>
            <div className="h-6 w-px bg-slate-700"></div>
            <select
              onChange={(e) => formatText('formatBlock', e.target.value)}
              className="px-2 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded text-sm"
            >
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="pre">Code</option>
            </select>
            <div className="h-6 w-px bg-slate-700"></div>
            <button
              onClick={() => formatText('removeFormat')}
              className="px-3 py-1 text-slate-300 hover:bg-slate-800 rounded transition-colors"
              title="Clear Formatting"
            >
              <i className="fas fa-eraser"></i>
            </button>
          </div>

          {/* AI Toolbar */}
          <div className="p-2 border-b border-slate-700 flex items-center gap-2 bg-slate-800/50">
            <span className="text-xs text-slate-400 font-semibold">AI Tools:</span>
            <button
              onClick={summarizeTranscript}
              disabled={isAiProcessing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isAiProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain"></i>}
              Summarize Transcript
            </button>
            <button
              onClick={generateActionItems}
              disabled={isAiProcessing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isAiProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-tasks"></i>}
              Generate Actions
            </button>
            <button
              onClick={improveWriting}
              disabled={isAiProcessing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isAiProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
              Improve Writing
            </button>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-4">
            <div
                ref={editorRef}
                contentEditable
                dir="ltr"
                className="min-h-full text-white focus:outline-none prose prose-invert max-w-none"
                onInput={() => {
                  // Editor content updates are read from editorRef when needed (e.g., save)
                }}
                style={{
                  lineHeight: '1.6',
                  fontSize: '16px',
                  direction: 'ltr'
                }}
              />
          </div>

          {/* Save/Delete Actions */}
          <div className="p-3 border-t border-slate-700 flex justify-between">
            <button
              onClick={() => deleteNote(activeNoteId)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <i className="fas fa-trash"></i> Delete
            </button>
            <button
              onClick={saveCurrentNote}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <i className="fas fa-save"></i> Save Note
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <i className="fas fa-sticky-note text-6xl mb-4"></i>
            <p className="text-xl">Select a note or create a new one</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesPanel;