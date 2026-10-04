// Tipi del database scritti a mano, allineati a supabase/migrations.
// Quando lo schema cresce si possono rigenerare con:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type Sex = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";
export type Plan = "free" | "pro";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  sex: Sex | null;
  height_cm: number | null;
  birth_year: number | null;
  birth_month: number | null;
  activity_level: ActivityLevel | null;
  goal: Goal | null;
  kcal_goal: number | null;
  protein_goal_g: number | null;
  goals_source: "auto" | "manual";
  goals_weight_kg: number | null;
  disclaimer_version: string | null;
  disclaimer_accepted_at: string | null;
  onboarding_completed_at: string | null;
  timezone: string;
  plan: Plan;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<
  Pick<
    ProfileRow,
    | "display_name"
    | "sex"
    | "height_cm"
    | "birth_year"
    | "birth_month"
    | "activity_level"
    | "goal"
    | "kcal_goal"
    | "protein_goal_g"
    | "goals_source"
    | "goals_weight_kg"
    | "timezone"
  >
>;

export type BodyWeightRow = {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: ProfileUpdate;
        Relationships: [];
      };
      body_weights: {
        Row: BodyWeightRow;
        Insert: { measured_on?: string; weight_kg: number };
        Update: { measured_on?: string; weight_kg?: number };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_disclaimer: { Args: { p_version: string }; Returns: undefined };
      complete_onboarding: { Args: Record<string, never>; Returns: undefined };
      current_user_is_adult: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
