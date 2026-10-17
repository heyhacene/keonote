export type NoteType = 'voice' | 'text' | 'todo' | 'scan';

export interface NoteTodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  todos: NoteTodoItem[];
  tags: string[];
  type: NoteType;
  audioData?: string; // Base64 audio representation for local playback
  audioDurationSec?: number;
  isPinned: boolean;
  isArchived: boolean;
  color?: string;
  status?: 'processing' | 'ready' | 'error';
  processingError?: string;
  createdAt: number;
  updatedAt: number;
}

export type CategoryFilter = 'all' | 'voice' | 'todo' | 'pinned' | 'archived';

export interface NoteFilter {
  category: CategoryFilter;
  selectedTag?: string;
  searchQuery: string;
}

export interface GeminiStructureResult {
  title: string;
  summary: string;
  cleanContent: string;
  todos: string[];
  tags: string[];
}
