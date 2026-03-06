-- COMPLETE AUTH RESET SCRIPT
-- RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR

-- 1. Clean up existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Clean up existing tables (Warning: This deletes existing profiles and projects)
DROP TABLE IF EXISTS project_insights CASCADE;
DROP TABLE IF EXISTS project_requests CASCADE;
DROP TABLE IF EXISTS bespoke_projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. Drop Enum if we need to recreate it
DROP TYPE IF EXISTS user_role CASCADE;

-- 4. Recreate Profile Roles Enum
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- 5. Recreate Profiles Table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable RLS on Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 7. Define SIMPLE RLS Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 8. The Bulletproof Auto-Profile Trigger
-- This ensures that whenever someone signs up, a profile is ALWAYS created.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    new.raw_user_meta_data->>'avatar_url', 
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Recreate Other Tables (simplified for now to ensure auth works)
CREATE TABLE bespoke_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    ui_config JSONB DEFAULT '{}',
    overarching_score NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES bespoke_projects(id) ON DELETE CASCADE,
    type TEXT,
    title TEXT,
    value NUMERIC,
    sentiment TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 0
);

CREATE TABLE project_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    project_type TEXT,
    data_type TEXT,
    ideal_outcome TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bespoke_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;

-- Simple Policies for other tables (Users see their own stuff)
CREATE POLICY "Users can view own projects" ON bespoke_projects FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Users can view own requests" ON project_requests FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Users can create requests" ON project_requests FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Users can view own insights" ON project_insights FOR SELECT USING (
    EXISTS (SELECT 1 FROM bespoke_projects WHERE id = project_id AND client_id = auth.uid())
);
