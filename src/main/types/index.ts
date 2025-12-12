// Типы для главного процесса Electron

export interface PasswordEntry {
  id: number;
  title: string;
  category_id: number | null;
  encrypted_data: string;
  tags: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  created_at: string;
}
