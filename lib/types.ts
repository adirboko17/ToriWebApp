// Types for our database tables
export interface User {
  id: string;
  name: string;
  user_type: 'admin' | 'client';
  phone: string;
  /** YYYY-MM-DD when set */
  birth_date?: string | null;
  password_hash?: string;
  image_url?: string;
  push_token?: string;
  language?: 'he' | 'en' | 'ar' | 'ru';
  business_id: string;
  created_at: string;
  updated_at: string;
  /** false = pending admin approval; login blocked for clients */
  client_approved?: boolean;
  block?: boolean;
  /** YYYY-MM-DD in Asia/Jerusalem — last automated birthday notification (Edge) */
  birthday_notification_sent_date?: string | null;
  /** Client self-booking: allowed JS weekdays 0=Sun..6=Sat. Null/empty = all days. */
  booking_allowed_weekdays?: number[] | null;
  /** Client self-booking: earliest slot start HH:MM. Null = no start limit. */
  booking_allowed_from?: string | null;
  /** Client self-booking: latest slot start HH:MM. Null = no end limit. */
  booking_allowed_until?: string | null;
  /** Admin: push when a client books. Default true. */
  notify_new_appointment?: boolean;
  /** Admin: push when a client cancels. Default true. */
  notify_appointment_cancel?: boolean;
}


export interface Service {
  id: string;
  name: string;
  price: number;
  // Optional in type; DB has default 60 when not provided
  duration_minutes?: number;
  is_active: boolean;
  business_id: string;
  /** Admin/barber who owns this service (per-worker catalog). */
  worker_id?: string | null;
  order_index?: number;
  created_at: string;
  updated_at: string;
}

// ServiceCategory removed; categories are now static in constants/services.ts

export interface Design {
  id: string;
  name: string;
  image_url: string;
  // New: list of image URLs for designs with multiple images. First item should match image_url.
  image_urls?: string[];
  categories: string[];
  popularity: number;
  description?: string;
  price_modifier: number;
  is_featured: boolean;
  // New: user (barber) association - using existing users table
  user_id?: string | null;
  business_id: string;
  /** Lower = earlier on client home / gallery. */
  display_order?: number | null;
  created_at: string;
  updated_at: string;
}


export interface Appointment {
  id: string;
  service_name: string;
  service_id?: string;
  user_id?: string;
  /** Registered client (`users.id`, `user_type = client`) when set from admin booking flow. */
  client_user_id?: string | null;
  slot_date: string; // YYYY-MM-DD format
  slot_time: string; // HH:MM format
  is_available: boolean;
  client_name?: string;
  client_phone?: string;
  duration_minutes: number;
  business_id: string;
  barber_id?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
  created_at: string;
  updated_at: string;
  /** Set when automated client reminder notification was created (server cron). */
  client_reminder_sent_at?: string | null;
  /** Set when automated barber/admin reminder notification was created (server cron). */
  admin_reminder_sent_at?: string | null;
}

// Alias for backward compatibility
export type AvailableTimeSlot = Appointment;

// Business Hours interface
export interface BusinessHours {
  id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  break_start_time?: string | null; // HH:MM format, optional (null = no lunch break)
  break_end_time?: string | null; // HH:MM format, optional
  is_active: boolean;
  // New: optional per-day slot duration in minutes (e.g., 15, 20, 30, 45, 60). If not set, defaults to 60
  slot_duration_minutes?: number;
  // New: multiple breaks stored as JSON array of { start_time, end_time }
  breaks?: Array<{ start_time: string; end_time: string }>;
  // New: user (barber) association - using existing users table
  user_id?: string | null;
  business_id: string;
  created_at: string;
  updated_at: string;
}


/** Date-specific hours that replace the weekly `business_hours` template for that day. */
export interface BusinessHoursOverride {
  id: string;
  business_id: string;
  user_id?: string | null;
  date: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
  breaks?: Array<{ start_time: string; end_time: string }>;
  created_at: string;
  updated_at: string;
}

// Business constraints (date-specific unavailable windows)
export interface BusinessConstraint {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;   // HH:MM or HH:MM:SS
  reason?: string | null;
  user_id?: string | null;
  business_id: string;
  created_at: string;
  updated_at: string;
}

/** Admin calendar sticky notes (`calendar_reminders`; optional if table was dropped in a migration). */
export interface CalendarReminder {
  id: string;
  business_id: string;
  user_id: string;
  event_date: string;
  start_time: string;
  duration_minutes: number;
  title: string;
  notes?: string | null;
  color_key?: string | null;
  created_at: string;
  updated_at: string;
}

// Waitlist interface
export interface WaitlistEntry {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  requested_date: string; // YYYY-MM-DD format
  time_period: 'morning' | 'afternoon' | 'evening' | 'any'; // Preferred time period
  status: 'waiting' | 'contacted' | 'booked' | 'cancelled';
  // New: user (barber) association - using existing users table
  user_id?: string | null;
  business_id: string;
  created_at: string;
  updated_at: string;
  /** Filled client-side when resolving `user_id` → staff display name (not a DB column). */
  staff_name?: string | null;
  /** Filled client-side from `users.image_url` when resolving staff (not a DB column). */
  staff_image_url?: string | null;
}

// Notification interface
export interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'appointment_reminder' | 'appointment_booked' | 'client_reminder' | 'admin_reminder' | 'promotion' | 'general' | 'home_broadcast' | 'system' | 'finance_monthly_review' | 'swap_request';
  recipient_name: string;
  recipient_phone: string;
  // Target user for admin/manager notifications (optional)
  user_id?: string | null;
  business_id: string;
  appointment_id?: string; // Optional reference to appointment for appointment-related notifications
  /** Set for type 'swap_request'. Dedupes push per recipient and deep-links into the swap feed. */
  swap_request_id?: string | null;
  created_at: string;
  is_read: boolean;
  read_at?: string;
  // Optional flag to indicate if a push was sent successfully
  push_sent?: boolean;
}

// Messages interface (broadcast messages shown in the app)
export interface Message {
  id: string;
  title: string;
  content: string;
  user_id?: string | null; // sender admin id
  business_id: string;
  ttl_hours: number; // how long the message is active on the home page
  published_at: string; // timestamptz
  expires_at?: string | null; // computed by trigger
  created_at: string;
  updated_at: string;
}

// Recurring appointments interface
export interface RecurringAppointment {
  id: string;
  service_name: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  time: string; // HH:MM format
  status: 'active' | 'inactive';
  admin_id?: string | null; // Reference to the admin/barber who manages this recurring appointment
  client_id?: string | null; // Reference to the client who has this recurring appointment
  business_id: string;
  created_at: string;
  updated_at: string;
}

// Business profile (single-row table storing social links and address)
export interface BusinessProfile {
  id: string;
  display_name?: string;
  address?: string;
  phone?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  // Home page marquee / hero images (public URLs)
  home_hero_images?: string[];
  /** `marquee` = tiled animation (`home_hero_images`); `single_fullbleed` = one image or video (`home_hero_single_*`). */
  home_hero_mode?: 'marquee' | 'single_fullbleed';
  /** Public URL when `home_hero_mode` is `single_fullbleed`. */
  home_hero_single_url?: string | null;
  home_hero_single_kind?: 'image' | 'video' | null;
  /** Public URL for home header logo (Storage); unset = bundled client branding logo */
  home_logo_url?: string | null;
  /** Public URL for app icon / non-transparent onboarding logo; unset = bundled branding */
  icon_url?: string | null;
  /** When true (default), home header shows logo; when false, shows `display_name` text. */
  home_header_show_logo?: boolean;
  /** When logo is hidden: optional header title; empty/null uses `display_name`. */
  home_header_text_without_logo?: string | null;
  /** When logo is hidden: optional font preset (`system`…`display`); null = system. */
  home_header_title_font?: string | null;
  /** When logo is hidden: custom font size (px); null = default (32). */
  home_header_title_font_size?: number | null;
  /** Home header logo box height in px; null = default (52). Width scales with aspect. */
  home_header_logo_height?: number | null;
  /** Client booking staff picker: `large_cards` (tall photo carousel) or `avatar_list` (stacked rows). */
  staff_selection_style?: 'large_cards' | 'avatar_list' | string | null;
  // Legacy global break minutes (int column named "break" in DB)
  break?: number;
  // New per-barber break minutes map: { [userId: string]: number }
  break_by_user?: Record<string, number>;
  // Per barber: minutes before a booking to notify this admin (optional; null = off)
  reminder_minutes_by_user?: Record<string, number | null>;
  /** Business-wide: minutes before appointment to notify clients (all barbers). Null/0 = off. */
  client_reminder_minutes?: number | null;
  min_cancellation_hours?: number;
  /** When false, clients cannot use appointment swap with other clients. Defaults to true if unset. */
  client_swap_enabled?: boolean;
  /** When true, new registrations need admin approval (client_approved=false). Defaults to true if unset. */
  require_client_approval?: boolean;
  /** When true, clients may select multiple services in one booking. Default false in DB. */
  allow_multi_service_booking?: boolean;
  /** When true, client home may show `home_fixed_message` (app-enforced). Kept in sync with audience ≠ off. */
  home_fixed_message_enabled?: boolean;
  /**
   * Who sees the fixed home message: `off` | `everyone` | `registered`.
   * `registered` = logged-in clients who are not awaiting approval.
   */
  home_fixed_message_audience?: 'off' | 'everyone' | 'registered' | string | null;
  /** Fixed banner text for client home when audience is not `off`. */
  home_fixed_message?: string | null;
  /**
   * Who sees the home availability meter: `off` | `everyone` | `registered`.
   * Kept in sync with legacy `availability_meter_approved_only` (true when registered).
   */
  availability_meter_audience?: 'off' | 'everyone' | 'registered' | string | null;
  /**
   * When true, only logged-in approved clients see the home availability meter.
   * Legacy flag — prefer `availability_meter_audience`.
   */
  availability_meter_approved_only?: boolean;
  /**
   * Who sees the home quick-slots shortcut: `off` | `everyone` | `registered`.
   */
  quick_slots_audience?: 'off' | 'everyone' | 'registered' | string | null;
  primary_color?: string; // Hex color code for primary UI color
  // Number of days forward to open booking window; defaults to 7 on server (legacy - now use booking_open_days_by_user)
  booking_open_days?: number;
  // New per-barber booking open days map: { [userId: string]: number }
  booking_open_days_by_user?: Record<string, number>;
  business_number?: string;
  /** Storage folder `branding/<name>/` — matches CLIENT_NAME in pulled .env */
  branding_client_name?: string | null;
  pulseem_user_id?: string | null;
  pulseem_password?: string | null;
  pulseem_from_number?: string | null;
  pulseem_has_password?: boolean;
  pulseem_api_key?: string | null;
  pulseem_has_api_key?: boolean;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory = 'rent' | 'supplies' | 'equipment' | 'marketing' | 'other';

export interface BusinessExpense {
  id: string;
  business_id: string;
  amount: number;
  description?: string;
  category: ExpenseCategory;
  expense_date: string; // YYYY-MM-DD
  receipt_url?: string | null;
  created_at: string;
}

// Swap request interface for appointment swapping between clients
export interface SwapRequest {
  id: string;
  business_id: string;
  appointment_id: string;
  requester_phone: string;
  requester_name?: string;
  original_date: string;
  original_time: string;
  original_service_name?: string;
  original_duration_minutes: number;
  original_barber_id?: string;
  /** Snapshot of the appointment's service. Swaps require an identical service so slot length never changes. */
  original_service_id?: string | null;
  preferred_dates: string[];
  preferred_time_from: string;
  preferred_time_to: string;
  /** Selected bands (morning/afternoon/evening). Matching uses each band separately. */
  preferred_time_slots?: string[] | null;
  status: 'active' | 'matched' | 'completed' | 'cancelled';
  matched_appointment_id?: string;
  matched_user_phone?: string;
  created_at: string;
  updated_at: string;
}

// Product interface for products table
export interface Product {
  id: string;
  business_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
