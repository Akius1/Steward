import type { CurrencyCode } from '@/utils/currency';

export type IncomeType = 'SALARY' | 'FREELANCE' | 'BUSINESS' | 'GIFT' | 'SIDE INCOME';

export interface IncomeSource {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  type: IncomeType;
  amount: number;
  subtitle: string | null;
  created_at: string;
}

export interface Allocation {
  id: string;
  user_id: string;
  household_id: string | null;
  month: number;
  year: number;
  bucket_name: string;
  amount: number;
  pct: number;
  created_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  target_amount: number;
  saved_amount: number;
  monthly_saving: number;
  deadline_months: number | null;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  currency: CurrencyCode;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  currency: CurrencyCode;
  created_at: string;
}

export interface HouseholdMember {
  household_id?: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  // flattened from get_household_members() RPC:
  name?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      income_sources: {
        Row: IncomeSource;
        Insert: Omit<IncomeSource, 'id' | 'created_at'>;
        Update: Partial<Omit<IncomeSource, 'id' | 'user_id' | 'created_at'>>;
      };
      allocations: {
        Row: Allocation;
        Insert: Omit<Allocation, 'id' | 'created_at'>;
        Update: Partial<Omit<Allocation, 'id' | 'user_id' | 'created_at'>>;
      };
      milestones: {
        Row: Milestone;
        Insert: Omit<Milestone, 'id' | 'created_at'>;
        Update: Partial<Omit<Milestone, 'id' | 'user_id' | 'created_at'>>;
      };
      households: {
        Row: Household;
        Insert: Omit<Household, 'id' | 'created_at'>;
        Update: Partial<Omit<Household, 'id' | 'owner_id' | 'created_at'>>;
      };
      household_members: {
        Row: HouseholdMember;
        Insert: Omit<HouseholdMember, 'joined_at' | 'profile'>;
        Update: Partial<Pick<HouseholdMember, 'role'>>;
      };
    };
  };
}
