-- Hilex Portal: Supabase Database Schema

-- 1. Create Profile Roles Enum
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- 2. Create Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Projects Table
CREATE TABLE IF NOT EXISTS bespoke_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    ui_config JSONB DEFAULT '{}',
    overarching_score NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Project Insights Table
CREATE TABLE IF NOT EXISTS project_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES bespoke_projects(id) ON DELETE CASCADE,
    type TEXT,
    title TEXT,
    value NUMERIC,
    sentiment TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 0
);

-- 5. Create Project Requests Table
CREATE TABLE IF NOT EXISTS project_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    project_type TEXT,
    data_type TEXT,
    ideal_outcome TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bespoke_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requests ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies

-- Profiles: Users see own, Admins see all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Projects: Users see own, Admins see all
CREATE POLICY "Users can view own projects" ON bespoke_projects FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Admins can view all projects" ON bespoke_projects FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Requests: Users can view/create own, Admins see all
CREATE POLICY "Users can view own requests" ON project_requests FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Users can create requests" ON project_requests FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Admins can manage all requests" ON project_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Insights: Inherit from Project access
CREATE POLICY "Users can view insights for own projects" ON project_insights FOR SELECT USING (
    EXISTS (SELECT 1 FROM bespoke_projects WHERE id = project_id AND client_id = auth.uid())
);
CREATE POLICY "Admins can view all insights" ON project_insights FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 8. Automatic Profile Creation on Signup
-- This function inserts a row into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
