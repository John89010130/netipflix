export type UserRole = 'ADMIN_MASTER' | 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
}

export interface Permissions {
  user_id: string;
  can_tv: boolean;
  can_movies: boolean;
  allowed_categories: string[];
}

export interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  logo_url: string;
  stream_url: string;
  active: boolean;
}

export interface Movie {
  id: string;
  title: string;
  category: string;
  poster_url: string;
  backdrop_url?: string;
  stream_url: string;
  views_count: number;
  active: boolean;
  description?: string;
  year?: number;
  duration?: string;
  rating?: number;
}

export interface WatchHistory {
  id: string;
  user_id: string;
  content_type: 'TV' | 'MOVIE';
  content_id: string;
  watched_at: string;
  progress?: number;
}

export interface Favorite {
  id: string;
  user_id: string;
  content_type: 'TV' | 'MOVIE';
  content_id: string;
}

export interface ContentItem {
  id: string;
  title: string;
  poster_url: string;
  backdrop_url?: string;
  category: string;
  type: 'TV' | 'MOVIE';
  stream_url: string;
  description?: string;
  year?: number;
  duration?: string;
  rating?: number;
  views_count?: number;
  progress?: number; // Watch progress in seconds
  totalDuration?: number; // Total duration in seconds
}
