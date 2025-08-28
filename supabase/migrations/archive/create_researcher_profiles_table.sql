-- Créer la table researcher_profiles
CREATE TABLE IF NOT EXISTS public.researcher_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  institution TEXT NOT NULL,
  department TEXT,
  role TEXT NOT NULL DEFAULT 'researcher' CHECK (role IN ('admin', 'clinical_specialist', 'researcher')),
  access_level TEXT NOT NULL DEFAULT 'basic' CHECK (access_level IN ('full', 'advanced', 'basic')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_login TIMESTAMP WITH TIME ZONE
);

-- Activer RLS (Row Level Security)
ALTER TABLE public.researcher_profiles ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir et modifier leur propre profil
CREATE POLICY "Users can view own profile" ON public.researcher_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.researcher_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Politique: Seuls les admins peuvent insérer de nouveaux profils
CREATE POLICY "Admins can insert profiles" ON public.researcher_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.researcher_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    ) OR 
    -- Permettre l'insertion du premier profil admin
    NOT EXISTS (SELECT 1 FROM public.researcher_profiles WHERE role = 'admin')
  );

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour updated_at
CREATE TRIGGER update_researcher_profiles_updated_at 
  BEFORE UPDATE ON public.researcher_profiles 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insérer un profil pour l'utilisateur actuel (remplacer l'email par le vôtre)
INSERT INTO public.researcher_profiles (id, full_name, institution, department, role, access_level)
SELECT 
  id,
  'Researcher User',
  'GHOSTLY Research Lab',
  'EMG Analysis Department',
  'researcher',
  'full'
FROM auth.users 
WHERE email = 'researcher@ghostly.be'
ON CONFLICT (id) DO NOTHING;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_researcher_profiles_role ON public.researcher_profiles(role);
CREATE INDEX IF NOT EXISTS idx_researcher_profiles_access_level ON public.researcher_profiles(access_level);